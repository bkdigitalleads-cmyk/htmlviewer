import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme, UI_FONT_FILES, space, type } from './src/theme';
import { AppProvider, useApp, ONBOARDED_KEY } from './src/state';
import { kvGet, kvSet, sweepCache } from './src/store';
import { afterOnboardingPaywall, dayKey, laterDayLaunch } from './src/rules';
import { keepAsksPro } from './src/gates';
import { typeInfo } from './src/filetypes';
import { mainFile, Refused } from './src/library';
import { maybeRequestReview } from './src/reviews';
import { shareFileAt } from './src/exporting';
import { PRIVACY_URL } from './src/links';
import { DataProvider, useData } from './src/data';
import type { FileRow } from './src/db/repo';
import Home from './src/screens/Home';
import Viewer from './src/screens/Viewer';
import Editor from './src/screens/Editor';
import PdfExport from './src/screens/PdfExport';
import Settings from './src/screens/Settings';
import PaywallModal from './src/screens/Paywall';
import Intro, { TrialSteps } from './src/screens/Intro';
import { Drawer, Note, Notice, Primary } from './src/ui/Kit';

/** A screen over Home. Back pops one. */
type Over = { name: 'viewer'; id: string } | { name: 'editor'; id: string; path: string } | { name: 'pdf'; id: string; path: string; mode: 'page' | 'source' } | { name: 'settings' };

/** Waits for a closing sheet or picker, so the next modal can show (iOS presents one at a time). */
export const settle = () => new Promise<void>((r) => setTimeout(r, 450));

/** Only files handed over by iOS (Open in, the share sheet) are taken from a URL. */
const isFileUrl = (url: string | null | undefined): url is string => !!url && /^file:\/\//i.test(url);

function Shell() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, notice, isPro, askPro } = useApp();
  const data = useData();
  const [stack, setStack] = useState<Over[]>([]);
  const push = (o: Over) => setStack((s) => [...s, o]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // New installs: three screens, the trial and reminder screens, then the paywall.
  const [step, setStep] = useState<'intro' | 'trial' | 'paywall'>('intro');
  // After the onboarding paywall is closed with the X: the small "Reading is free" sheet.
  const [claim, setClaim] = useState(false);
  const paywallOpened = useRef(false);
  const keepAsked = useRef(false);
  const launchChecked = useRef(false);
  // Files handed over before the app is ready (or during onboarding) wait here.
  const [pending, setPending] = useState<string[]>([]);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    sweepCache();
  }, []);

  // Open in and the share sheet: iOS starts or wakes the app with a file URL (a copy in Documents/Inbox).
  useEffect(() => {
    const take = (url: string | null) => {
      if (isFileUrl(url) && !handled.current.has(url)) setPending((p) => [...p, url]);
    };
    Linking.getInitialURL().then(take).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => take(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready || !data.loaded || onboarded !== null) return;
    (async () => {
      if ((await kvGet(ONBOARDED_KEY)) === '1') return setOnboarded(true);
      // Anyone who already opened a file, or is Pro, has used the app: no onboarding.
      if (isPro || data.files.length > 0) {
        kvSet(ONBOARDED_KEY, '1').catch(() => {});
        return setOnboarded(true);
      }
      setOnboarded(false);
    })().catch(() => setOnboarded(true)); // fail open: never trap anyone
  }, [ready, data.loaded, onboarded, isPro, data.files.length]);

  // The rating ask on a later-day launch, once three files have been opened.
  useEffect(() => {
    if (!onboarded || !data.loaded || launchChecked.current) return;
    launchChecked.current = true;
    if (laterDayLaunch(data.installDay, dayKey(Date.now()), data.keptEver)) setTimeout(() => maybeRequestReview('laterDayLaunch'), 2500);
  }, [onboarded, data.loaded, data.installDay, data.keptEver]);

  /** Shows a kept file. On the free plan, the fourth file kept opens the paywall first (once per launch); the file opens either way. */
  const show = useCallback(
    async (row: FileRow, keptBefore: number) => {
      if (keepAsksPro(isPro, keptBefore, keepAsked.current)) {
        keepAsked.current = true;
        // The Files picker or the paste drawer is still closing; iOS shows one modal at a time.
        await settle();
        await askPro('recents');
      }
      setStack([{ name: 'viewer', id: row.id }]);
    },
    [isPro, askPro]
  );

  const keep = useCallback(
    async (make: () => Promise<FileRow>) => {
      const before = data.files.length;
      try {
        const row = await make();
        await show(row, before);
      } catch (e: any) {
        Alert.alert(e instanceof Refused ? 'This file did not open' : 'The file did not open', e?.message ?? 'Try once more.');
      }
    },
    [data.files.length, show]
  );

  // Handle waiting files once the app is ready and onboarding is done.
  useEffect(() => {
    if (!onboarded || !data.loaded || pending.length === 0) return;
    const [url, ...rest] = pending;
    setPending(rest);
    if (handled.current.has(url)) return;
    handled.current.add(url);
    keep(() => data.keepIncoming(url));
  }, [onboarded, data.loaded, pending, keep, data]);

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      await keep(() => data.keepPicked(res.assets.map((a) => ({ uri: a.uri, name: a.name }))));
    } catch (e: any) {
      Alert.alert('The Files picker did not open', e?.message ?? 'Try once more.');
    }
  };

  const shareFile = async (row: FileRow) => {
    try {
      const info = typeInfo(row.kind);
      await shareFileAt(mainFile(row).uri, info.mime, info.uti, row.name);
      maybeRequestReview('firstExport');
    } catch (e: any) {
      Alert.alert('The file did not go out', e?.message ?? 'Try once more.');
    }
  };

  const openOnboardingPaywall = () => {
    if (paywallOpened.current) return;
    paywallOpened.current = true;
    setStep('paywall');
    askPro('pro').then((pro) => {
      if (afterOnboardingPaywall(pro) === 'claim' && pending.length === 0) setTimeout(() => setClaim(true), 450);
      kvSet(ONBOARDED_KEY, '1').catch(() => {});
      setOnboarded(true);
    });
  };

  if (!ready || !data.loaded || onboarded === null) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (data.failed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.l, paddingTop: insets.top + space.xxl }}>
        <Text style={[type.title, { color: theme.ink }]}>Your files did not open.</Text>
        <Text style={[type.body, { color: theme.inkSoft, marginTop: space.s }]}>Close the app and open it again. If it keeps happening, write to support from the App Store page. ({data.failed})</Text>
      </View>
    );
  }

  if (!onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        {step === 'intro' && <Intro onDone={() => setStep('trial')} />}
        {(step === 'trial' || step === 'paywall') && <TrialSteps onDone={openOnboardingPaywall} />}
        <PaywallModal privacyUrl={PRIVACY_URL} onboarding />
      </View>
    );
  }

  const top = stack[stack.length - 1];
  const fileOf = (id: string) => data.files.find((f) => f.id === id) ?? null;
  let body: React.ReactNode = null;
  if (top?.name === 'viewer') {
    const f = fileOf(top.id);
    if (f)
      body = (
        <Viewer
          key={f.id}
          file={f}
          onBack={() => {
            data.touch(f.id);
            pop();
          }}
          onEdit={(path) => push({ name: 'editor', id: f.id, path })}
          onPdf={(path, mode) => push({ name: 'pdf', id: f.id, path, mode })}
          onShare={() => shareFile(f)}
        />
      );
  } else if (top?.name === 'editor') {
    const f = fileOf(top.id);
    if (f)
      body = (
        <Editor
          file={f}
          path={top.path}
          onClose={pop}
          onSaved={(row) => setStack((s) => (row.id === f.id ? s.slice(0, -1) : [{ name: 'viewer', id: row.id }]))}
        />
      );
  } else if (top?.name === 'pdf') {
    const f = fileOf(top.id);
    if (f) body = <PdfExport file={f} path={top.path} mode={top.mode} onBack={pop} />;
  } else if (top?.name === 'settings') {
    body = (
      <Settings
        onBack={pop}
        onSample={() => keep(() => data.keepSample())}
        onReplayOnboarding={() => {
          paywallOpened.current = false;
          setStack([]);
          setStep('intro');
          setOnboarded(false);
        }}
      />
    );
  }
  if (!body)
    body = (
      <Home
        onOpen={(f) => {
          data.touch(f.id);
          setStack([{ name: 'viewer', id: f.id }]);
        }}
        onPick={pick}
        onPaste={(text) => keep(() => data.keepPaste(text))}
        onSample={() => keep(() => data.keepSample())}
        onSettings={() => push({ name: 'settings' })}
        onShare={shareFile}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{body}</View>
      <PaywallModal privacyUrl={PRIVACY_URL} />
      <Drawer theme={theme} visible={claim} onClose={() => setClaim(false)} title="Reading is free.">
        <View style={{ gap: space.l, paddingBottom: space.l }}>
          <Note theme={theme} style={{ fontSize: 16, lineHeight: 22 }}>
            Open and read any file, see its code, find in it and copy it. Your first PDF is on us, and your last three files stay in Recent.
          </Note>
          <Primary theme={theme} label="Start reading" onPress={() => setClaim(false)} />
        </View>
      </Drawer>
      <Notice theme={theme} text={notice} top={insets.top} />
    </View>
  );
}

/** A failure while a screen renders: shown instead of a frozen screen. Nothing is lost on disk. */
class Guard extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#F6F5F2', padding: space.l, paddingTop: 80 }}>
        <Text style={[type.title, { color: '#16171A' }]}>Something went wrong on this screen.</Text>
        <Text style={[type.body, { color: '#16171A', marginTop: space.s }]}>Close the app and open it again. Your files are kept.</Text>
        <Text style={{ fontSize: 12, color: '#7D7F86', marginTop: space.l }}>{error.message}</Text>
      </View>
    );
  }
}

export default function App() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({ ...UI_FONT_FILES });
  // If the fonts are still not in after a few seconds, open anyway with the system font.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), 6000);
    return () => clearTimeout(t);
  }, []);
  // The background colour while fonts load, so launch never flashes white.
  if (!fontsLoaded && !fontError && !gaveUp) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return (
    <Guard>
      <SafeAreaProvider>
        <AppProvider>
          <DataProvider>
            <Shell />
          </DataProvider>
        </AppProvider>
      </SafeAreaProvider>
    </Guard>
  );
}

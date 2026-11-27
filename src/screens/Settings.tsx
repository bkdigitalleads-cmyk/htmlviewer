import React, { useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme, space, type, SOURCE_THEMES } from '../theme';
import { useData } from '../data';
import { useApp, ONBOARDED_KEY } from '../state';
import { canStyleSource, FREE_RECENTS } from '../gates';
import { stepSourceSize } from '../rules';
import { restorePurchases } from '../purchases';
import { cancelTrialReminder } from '../reminder';
import { kvSet } from '../store';
import { PRIVACY_URL, SUPPORT_EMAIL, SUPPORT_MAIL_URL, SUPPORT_URL, TERMS_URL } from '../links';
import Glyph from '../ui/Glyph';
import { Caps, Card, Drawer, IconTap, Row, SwitchRow, TopBar } from '../ui/Kit';

/** Reading, files, Pro, restore, help and About. Test tools behind seven taps on the version line, in test builds only. */
export default function Settings({ onBack, onSample, onReplayOnboarding }: { onBack: () => void; onSample: () => void; onReplayOnboarding: () => void }) {
  const theme = useTheme();
  const data = useData();
  const { isPro, setIsPro, askPro, testBuild, actFree, setActFree, resetFreeUse, say } = useApp();
  const [restoring, setRestoring] = useState(false);
  const [themes, setThemes] = useState(false);
  const [taps, setTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = `${Constants.expoConfig?.version ?? '1.0.0'} (${Constants.expoConfig?.ios?.buildNumber ?? '1'})`;
  const { prefs, setPrefs } = data;
  const styled = canStyleSource(isPro);

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    const res = await restorePurchases();
    setRestoring(false);
    if (res.ok) cancelTrialReminder();
    if (res.ok && res.isPro) {
      setIsPro(true);
      Alert.alert('Pro is back on', 'Editing, every PDF and every recent file are back.');
    } else if (res.ok) Alert.alert('Nothing to restore', 'This Apple ID has no HTML Viewer Pro purchase.');
    else Alert.alert('Restore did not work', res.error ?? 'Try once more.');
  };

  const versionTap = () => {
    if (!testBuild) return;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTaps(0), 2000);
    setTaps((t) => t + 1);
  };

  const pickTheme = async () => {
    if (styled || (await askPro('themes'))) setThemes(true);
  };
  const size = async (dir: 1 | -1) => {
    if (styled || (await askPro('themes'))) setPrefs({ sourceSize: stepSourceSize(prefs.sourceSize, dir) });
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <Caps theme={theme}>Source</Caps>
          <Card theme={theme}>
            <SwitchRow theme={theme} first glyph="wrap" label="Wrap long lines" value={prefs.wrap} onChange={(v) => setPrefs({ wrap: v })} />
            <Row theme={theme} glyph="code" label="Theme" sub={styled && prefs.sourceTheme !== 'system' ? SOURCE_THEMES[prefs.sourceTheme].name : 'Paper in light, Night in dark'} onPress={pickTheme} right={styled ? undefined : <Glyph name="lock" size={16} color={theme.inkFaint} />} />
            <Row
              theme={theme}
              glyph="textSize"
              label="Font size"
              sub={styled ? undefined : 'With Pro'}
              right={
                <View style={styles.stepper}>
                  <IconTap theme={theme} glyph="minus" label="Smaller code" onPress={() => size(-1)} />
                  <Text style={[type.strong, styles.stepValue, { color: theme.ink }]}>{styled ? prefs.sourceSize : 13}</Text>
                  <IconTap theme={theme} glyph="plus" label="Larger code" onPress={() => size(1)} />
                </View>
              }
            />
          </Card>
        </View>

        <View>
          <Caps theme={theme}>Files</Caps>
          <Card theme={theme}>
            <Row theme={theme} first glyph="sample" label="Open the sample page" sub="A page with its style sheet and picture beside it" onPress={onSample} />
            <Row theme={theme} glyph="mail" label="Open a file from Mail" sub="Tap the attachment, tap Share, then HTML Viewer. The app keeps its own copy; the email is not changed." />
          </Card>
        </View>

        <View>
          <Caps theme={theme}>Pro</Caps>
          <Card theme={theme}>
            {isPro ? (
              <Row theme={theme} first glyph="check" label="HTML Viewer Pro is on" sub="Editing, every PDF, every recent file, folders and source themes" />
            ) : (
              <Row theme={theme} first glyph="star" label="HTML Viewer Pro" sub={`Reading is free. Pro adds editing, every PDF after the first, more than ${FREE_RECENTS} recent files with folders, and source themes.`} onPress={() => askPro('pro')} />
            )}
            <Row theme={theme} glyph="undo" label={restoring ? 'Restoring' : 'Restore purchases'} onPress={restore} right={<View />} />
          </Card>
        </View>

        <View>
          <Caps theme={theme}>Help</Caps>
          <Card theme={theme}>
            <Row theme={theme} first label="Support and questions" sub="How to open, read, edit and save files" onPress={() => Linking.openURL(SUPPORT_URL)} />
            <Row theme={theme} label="Email support" sub={SUPPORT_EMAIL} hint="Opens Mail with the subject HTML Viewer support" onPress={() => Linking.openURL(SUPPORT_MAIL_URL).catch(() => Alert.alert('Mail did not open', `Write to ${SUPPORT_EMAIL}.`))} />
            <Row theme={theme} label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
            <Row theme={theme} label="Terms of Use (EULA)" onPress={() => Linking.openURL(TERMS_URL)} />
          </Card>
        </View>

        <View>
          <Caps theme={theme}>About</Caps>
          <Card theme={theme} style={styles.about}>
            <Text style={[type.body, { color: theme.ink }]}>Reads web pages, code and text files on this iPhone. It does not browse the web.</Text>
            <Text style={[type.small, { color: theme.inkSoft }]}>No account. Your files stay on this iPhone unless you share them.</Text>
            <Text style={[type.small, { color: theme.inkFaint, paddingVertical: space.xs }]} onPress={versionTap} accessibilityRole="text">
              Version {version}
            </Text>
          </Card>
        </View>

        {testBuild && taps >= 7 ? (
          <View>
            <Caps theme={theme}>Testing (test builds only)</Caps>
            <Card theme={theme}>
              <Row theme={theme} first label="Act as a free user" right={<Switch value={actFree} onValueChange={(v) => setActFree(v)} />} />
              <Row
                theme={theme}
                label="Make the first PDF free again"
                onPress={() => {
                  resetFreeUse();
                  say('Free use reset.');
                }}
                right={<View />}
              />
              <Row
                theme={theme}
                label="Show onboarding again"
                onPress={() => {
                  kvSet(ONBOARDED_KEY, '0').catch(() => {});
                  onReplayOnboarding();
                }}
                right={<View />}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <Drawer theme={theme} visible={themes} onClose={() => setThemes(false)} title="Source theme">
        <Card theme={theme} style={{ marginBottom: space.l }}>
          <Row theme={theme} first label="Match the system" sub="Paper in light, Night in dark" right={prefs.sourceTheme === 'system' ? <Glyph name="check" size={20} color={theme.ink} /> : <View />} onPress={() => setPrefs({ sourceTheme: 'system' })} />
          {Object.values(SOURCE_THEMES).map((t) => (
            <Row key={t.id} theme={theme} label={t.name} right={prefs.sourceTheme === t.id ? <Glyph name="check" size={20} color={theme.ink} /> : <View />} onPress={() => setPrefs({ sourceTheme: t.id })} />
          ))}
        </Card>
      </Drawer>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.xl, paddingBottom: space.xxl },
  about: { padding: space.l, gap: space.s },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepValue: { minWidth: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
});

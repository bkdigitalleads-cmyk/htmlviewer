import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import type { FileRow } from '../db/repo';
import { folderUrl, writeView } from '../library';
import { pageCopy, svgPage, findFragment } from '../page';
import { classifyNav } from '../nav';
import { kindOf } from '../filetypes';
import { Theme, space, type } from '../theme';

/**
 * The page, from the app's own copy, in a web view that can read only the
 * file's own folder (loadFileURL with read access to that folder). Links
 * follow src/nav.ts: web links open in the browser on a tap, sibling files
 * open in the viewer, nothing else loads. Scripts run only when the
 * person turns them on for this file; the web view is rebuilt when that
 * changes, because the setting is fixed when it is made. No cookies or
 * storage are kept (incognito), long-press link previews are off, and
 * phone numbers are not turned into links.
 */
export default function PageView({
  theme,
  file,
  path,
  html,
  scripts,
  remote,
  scale,
  dark,
  find,
  findIndex,
  onCount,
  onSibling,
}: {
  theme: Theme;
  file: FileRow;
  /** The file shown, inside the folder: the main file or a sibling. */
  path: string;
  /** Its text (unused for SVG, which shows as a picture). */
  html: string;
  scripts: boolean;
  remote: boolean;
  scale: number;
  dark: boolean;
  find: string;
  findIndex: number;
  onCount: (n: number) => void;
  onSibling: (path: string) => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const isSvg = kindOf(path) === 'svg';

  // The page copy: rewritten when the page or its settings change, not when the find moves.
  const view = useMemo(() => {
    try {
      const opts = { scripts, remote, dark, scale, find };
      if (isSvg) {
        const name = path.split('/').pop() ?? path;
        return { uri: writeView(file, path, svgPage(encodeURIComponent(name), opts)), count: 0 };
      }
      const copy = pageCopy(html, opts);
      return { uri: writeView(file, path, copy.html), count: copy.count };
    } catch (e: any) {
      return { uri: null, count: 0, error: e?.message ?? 'The page could not be prepared.' };
    }
  }, [file, path, html, scripts, remote, scale, dark, find, isSvg]);

  useEffect(() => onCount(view.count), [view.count, onCount]);
  useEffect(() => setFailed(null), [view.uri]);

  const folder = folderUrl(file);
  const uri = view.uri && find && findIndex >= 0 && view.count > 0 ? `${view.uri}#${findFragment(findIndex)}` : view.uri;

  const decide = (req: { url: string; navigationType?: string; isTopFrame?: boolean }) => {
    const d = classifyNav(req, { pageUrl: view.uri ?? '', folderUrl: folder, remote });
    if (d.action === 'allow') return true;
    if (d.action === 'browser' || d.action === 'system') Linking.openURL(d.url).catch(() => {});
    if (d.action === 'sibling') onSibling(d.path);
    return false;
  };

  if (!view.uri) {
    return <Failure theme={theme} text={'error' in view ? String(view.error) : 'The page could not be shown.'} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#121314' : '#FFFFFF' }}>
      <WebView
        // Scripts and web content are fixed when the web view is made, so a change makes a new one.
        key={`${scripts ? 's' : '-'}${remote ? 'r' : '-'}`}
        source={{ uri: uri! }}
        allowingReadAccessToURL={folder}
        originWhitelist={['*']}
        javaScriptEnabled={scripts}
        javaScriptCanOpenWindowsAutomatically={false}
        onShouldStartLoadWithRequest={(r: ShouldStartLoadRequest) => decide({ url: r.url, navigationType: r.navigationType, isTopFrame: r.isTopFrame })}
        onOpenWindow={(e) => decide({ url: e.nativeEvent.targetUrl, navigationType: 'click', isTopFrame: true })}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        dataDetectorTypes="none"
        incognito
        cacheEnabled={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback
        fraudulentWebsiteWarningEnabled={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: dark ? '#121314' : '#FFFFFF' }]}>
            <ActivityIndicator color={theme.inkFaint} />
          </View>
        )}
        onError={(e) => setFailed(e.nativeEvent.description || 'The page could not be shown.')}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        accessibilityLabel={`Page preview of ${file.name}`}
      />
      {failed ? <Failure theme={theme} text={failed} overlay /> : null}
    </View>
  );
}

function Failure({ theme, text, overlay = false }: { theme: Theme; text: string; overlay?: boolean }) {
  return (
    <View style={[overlay ? StyleSheet.absoluteFill : { flex: 1 }, styles.center, { backgroundColor: theme.bg, padding: space.xl }]}>
      <Text style={[type.strong, { color: theme.ink, textAlign: 'center' }]}>This page could not be shown.</Text>
      <Text style={[type.small, { color: theme.inkSoft, textAlign: 'center', marginTop: space.s }]}>{text} Its code is in Source.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

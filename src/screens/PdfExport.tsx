import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme, space, type } from '../theme';
import { useData } from '../data';
import { useApp } from '../state';
import type { FileRow } from '../db/repo';
import { kindOf } from '../filetypes';
import { folderFiles, readText } from '../library';
import { inlineForPrint, pageCopy, sourcePrintHtml, svgPage } from '../page';
import { pdfName } from '../names';
import { pdfDecision } from '../gates';
import { pageFlags } from '../rules';
import { makePdf, printPdf, shareFileAt } from '../exporting';
import { maybeRequestReview } from '../reviews';
import { Note, Primary, Quiet, TopBar } from '../ui/Kit';
import { doneHaptic } from '../ui/motion';

/**
 * Print or save the page as a PDF. The PDF is made on the phone from the
 * page copy: pictures and styles from the file's folder inlined, scripts
 * out, nothing from the web unless Web content is on. A code or text file
 * prints as its text. The first PDF is free; after that, Pro.
 */
export default function PdfExport({ file, path, mode, onBack }: { file: FileRow; path: string; mode: 'page' | 'source'; onBack: () => void }) {
  const theme = useTheme();
  const data = useData();
  const { isPro, askPro, pdfUsed, notePdf, say } = useApp();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'share' | 'print' | 'files'>(null);
  const started = useRef(false);
  const name = path.split('/').pop() ?? path;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const gate = pdfDecision(isPro, pdfUsed);
      if (!gate.allowed && !(await askPro('pdf'))) return onBack();
      try {
        const text = readText(file, path).text;
        const kind = kindOf(path) ?? file.kind;
        let html: string;
        if (mode === 'page' && kind === 'html') {
          const inlined = inlineForPrint(text, folderFiles(file), path);
          html = pageCopy(inlined, { scripts: false, remote: pageFlags(file).remote, dark: false, scale: 1, print: true }).html;
        } else if (mode === 'page' && kind === 'svg') {
          const b64 = folderFiles(file).get(path.toLowerCase())?.base64 ?? '';
          html = svgPage(`data:image/svg+xml;base64,${b64}`, { scripts: false, remote: false, dark: false, scale: 1, print: true });
        } else {
          html = sourcePrintHtml(text, name);
        }
        const out = await makePdf(html, pdfName(name), data.paper);
        if (gate.usesFree) notePdf();
        setUri(out);
        doneHaptic();
        say('Saved as PDF.');
      } catch (e: any) {
        setFailed(e?.message ?? 'The PDF could not be made.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (how: 'share' | 'print' | 'files') => {
    if (!uri || busy) return;
    setBusy(how);
    try {
      if (how === 'print') await printPdf(uri);
      else await shareFileAt(uri, 'application/pdf', 'com.adobe.pdf', how === 'files' ? 'Save to Files' : pdfName(name));
      maybeRequestReview('firstExport');
    } catch (e: any) {
      Alert.alert('The PDF did not go out', e?.message ?? 'Try once more.');
    } finally {
      setBusy(null);
    }
  };

  const folder = uri ? uri.slice(0, uri.lastIndexOf('/') + 1) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title={pdfName(name)} sub={`${data.paper.name}, ${mode === 'page' ? 'the page as it prints' : 'the code as text'}`} onBack={onBack} />
      <View style={[styles.paper, { backgroundColor: theme.well }]}>
        {uri ? (
          <WebView source={{ uri }} allowingReadAccessToURL={folder} originWhitelist={['file://*']} javaScriptEnabled={false} incognito allowsLinkPreview={false} style={{ flex: 1, backgroundColor: 'transparent' }} accessibilityLabel={`PDF of ${name}`} />
        ) : failed ? (
          <View style={styles.center}>
            <Text style={[type.strong, { color: theme.ink, textAlign: 'center' }]}>The PDF could not be made.</Text>
            <Note theme={theme} style={{ textAlign: 'center', marginTop: space.s }}>{failed}</Note>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={theme.inkFaint} />
            <Note theme={theme} style={{ marginTop: space.m }}>Making the PDF on this iPhone</Note>
          </View>
        )}
      </View>
      <View style={[styles.foot, { backgroundColor: theme.card, borderTopColor: theme.rule }]}>
        <Primary theme={theme} label="Share" glyph="share" onPress={() => send('share')} busy={busy === 'share'} disabled={!uri} />
        <View style={styles.pair}>
          <Quiet theme={theme} label="Print" glyph="print" grow onPress={() => send('print')} disabled={!uri || busy != null} />
          <Quiet theme={theme} label="Save to Files" glyph="save" grow onPress={() => send('files')} disabled={!uri || busy != null} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, padding: space.l, gap: space.s },
  pair: { flexDirection: 'row', gap: space.s },
});

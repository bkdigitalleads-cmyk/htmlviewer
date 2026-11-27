import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme, radius, space, type, Theme } from '../theme';
import { useData } from '../data';
import { useApp } from '../state';
import type { FileRow } from '../db/repo';
import { canUseFolders, cleanFolder, folderNames, inFolder, visibleRecents } from '../gates';
import { openedLabel } from '../rules';
import { sizeLabel } from '../text';
import Glyph from '../ui/Glyph';
import { Caps, Card, Drawer, Field, IconTap, KindTag, Note, Primary, Quiet, Row, Tap } from '../ui/Kit';

/**
 * Home: the recent files and one large Open a file button. Paste code
 * makes a new file from the clipboard through the system paste button
 * (no paste prompt). On the free plan the last three files are listed;
 * older ones stay on the phone and come back with Pro.
 */
export default function Home({
  onOpen,
  onPick,
  onPaste,
  onSample,
  onSettings,
  onShare,
}: {
  onOpen: (f: FileRow) => void;
  onPick: () => void;
  onPaste: (text: string) => void;
  onSample: () => void;
  onSettings: () => void;
  onShare: (f: FileRow) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useData();
  const { isPro, askPro } = useApp();
  const [folder, setFolder] = useState('');
  const [pasting, setPasting] = useState(false);
  const [acting, setActing] = useState<FileRow | null>(null);
  const [moving, setMoving] = useState<FileRow | null>(null);
  const [newFolder, setNewFolder] = useState('');

  const folders = useMemo(() => folderNames(data.files), [data.files]);
  const { shown, hidden } = useMemo(() => visibleRecents(isPro, inFolder(data.files, isPro ? folder : '')), [isPro, data.files, folder]);
  const now = Date.now();
  const empty = data.files.length === 0;

  const pasteFallback = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    setPasting(false);
    if (!text.trim()) return Alert.alert('The clipboard is empty', 'Copy some code first, then tap Paste code.');
    onPaste(text);
  };

  const moveTo = async (f: FileRow, name: string) => {
    await data.setFolder(f.id, name);
    setMoving(null);
    setNewFolder('');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[type.caps, { color: theme.inkFaint }]}>HTML Viewer</Text>
          {empty ? null : (
            <Text style={[type.display, { color: theme.ink, marginTop: 2 }]} accessibilityRole="header">
              Recent
            </Text>
          )}
        </View>
        <IconTap theme={theme} glyph="settings" label="Settings" onPress={onSettings} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, empty && { flexGrow: 1 }]}>
        {isPro && folders.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {['', ...folders].map((name) => {
              const on = folder === name;
              return (
                <Tap key={name || 'all'} onPress={() => setFolder(name)} style={[styles.chip, { backgroundColor: on ? theme.ink : theme.well }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  {name ? <Glyph name="folder" size={16} color={on ? theme.bg : theme.inkSoft} /> : null}
                  <Text style={[type.small, { color: on ? theme.bg : theme.ink, fontWeight: '600' }]}>{name || 'All files'}</Text>
                </Tap>
              );
            })}
          </ScrollView>
        ) : null}

        {empty ? (
          <EmptyState theme={theme} />
        ) : (
          <>
            <Card theme={theme}>
              {shown.map((f, i) => (
                <Row
                  key={f.id}
                  theme={theme}
                  first={i === 0}
                  lead={<KindTag theme={theme} kind={f.kind} />}
                  label={f.name}
                  sub={[openedLabel(f.openedAt, now, data.locale.tag), sizeLabel(f.size), f.folder && !folder ? f.folder : ''].filter(Boolean).join(', ')}
                  onPress={() => onOpen(f)}
                  onLongPress={() => setActing(f)}
                  hint="Opens the file. Hold for more."
                  right={<IconTap theme={theme} glyph="more" label={`More for ${f.name}`} onPress={() => setActing(f)} color={theme.inkFaint} size={36} />}
                />
              ))}
            </Card>
            {hidden > 0 ? (
              <Tap onPress={() => askPro('recents')} style={styles.hidden} accessibilityRole="button" accessibilityHint="Opens HTML Viewer Pro">
                <Glyph name="lock" size={16} color={theme.inkSoft} />
                <Note theme={theme} style={{ flex: 1 }}>
                  {hidden === 1 ? '1 older file is kept on this iPhone.' : `${hidden} older files are kept on this iPhone.`} Pro lists every file.
                </Note>
              </Tap>
            ) : null}
            <Note theme={theme} style={styles.how}>
              From Mail, Files or Messages: tap Share on an .html file, then HTML Viewer.
            </Note>
          </>
        )}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, space.l) }]}>
        <Primary theme={theme} label="Open a file" glyph="open" onPress={onPick} hint="Opens the Files picker. Pick a page with its pictures and styles to keep them together." />
        <View style={styles.pair}>
          <Quiet theme={theme} label="Paste code" glyph="paste" grow onPress={() => setPasting(true)} />
          {empty ? <Quiet theme={theme} label="Sample page" glyph="sample" grow onPress={onSample} /> : null}
        </View>
      </View>

      <Drawer theme={theme} visible={pasting} onClose={() => setPasting(false)} title="Paste code">
        <View style={{ gap: space.l, paddingBottom: space.l }}>
          <Note theme={theme}>HTML, CSS, JavaScript, JSON or any text. It opens as a new file in this app.</Note>
          {Clipboard.isPasteButtonAvailable ? (
            <View style={{ alignItems: 'center' }}>
              <Clipboard.ClipboardPasteButton
                acceptedContentTypes={['plain-text']}
                displayMode="iconAndLabel"
                cornerStyle="large"
                backgroundColor={theme.accent}
                foregroundColor={theme.onAccent}
                style={{ width: 220, height: 50 }}
                onPress={(d) => {
                  setPasting(false);
                  if (d.type === 'text' && d.text.trim()) onPaste(d.text);
                  else Alert.alert('The clipboard is empty', 'Copy some code first, then tap Paste code.');
                }}
              />
            </View>
          ) : (
            <Primary theme={theme} label="Paste" glyph="paste" onPress={pasteFallback} />
          )}
        </View>
      </Drawer>

      <Drawer theme={theme} visible={acting != null} onClose={() => setActing(null)} title={acting?.name}>
        {acting ? (
          <Card theme={theme} style={{ marginBottom: space.l }}>
            <Row
              theme={theme}
              first
              glyph="folder"
              label="Move to folder"
              sub={acting.folder || 'Not in a folder'}
              right={canUseFolders(isPro) ? undefined : <Glyph name="lock" size={16} color={theme.inkFaint} />}
              onPress={async () => {
                const f = acting;
                setActing(null);
                // The drawer closes before anything else opens; iOS shows one modal at a time.
                await new Promise((r) => setTimeout(r, 450));
                if (canUseFolders(isPro) || (await askPro('folders'))) setTimeout(() => setMoving(f), 450);
              }}
            />
            <Row
              theme={theme}
              glyph="share"
              label="Share the file"
              onPress={() => {
                const f = acting;
                setActing(null);
                setTimeout(() => onShare(f), 350);
              }}
            />
            <Row
              theme={theme}
              glyph="trash"
              tone="danger"
              label="Delete from this iPhone"
              right={<View />}
              onPress={() => {
                const f = acting;
                setActing(null);
                Alert.alert(`Delete ${f.name}?`, 'This removes the app’s copy. The file in Mail or Files is not touched.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => data.remove(f.id) },
                ]);
              }}
            />
          </Card>
        ) : null}
      </Drawer>

      <Drawer theme={theme} visible={moving != null} onClose={() => setMoving(null)} title="Move to folder">
        {moving ? (
          <View style={{ gap: space.m, paddingBottom: space.l }}>
            <Card theme={theme}>
              <Row theme={theme} first label="Not in a folder" right={!moving.folder ? <Glyph name="check" size={20} color={theme.ink} /> : <View />} onPress={() => moveTo(moving, '')} />
              {folders.map((name) => (
                <Row key={name} theme={theme} glyph="folder" label={name} right={moving.folder === name ? <Glyph name="check" size={20} color={theme.ink} /> : <View />} onPress={() => moveTo(moving, name)} />
              ))}
            </Card>
            <Caps theme={theme}>New folder</Caps>
            <View style={styles.pair}>
              <Field theme={theme} style={{ flex: 1 }} value={newFolder} onChangeText={setNewFolder} placeholder="Bank, School, Work" maxLength={30} returnKeyType="done" accessibilityLabel="New folder name" onSubmitEditing={() => cleanFolder(newFolder) && moveTo(moving, newFolder)} />
              <Quiet theme={theme} label="Add" onPress={() => cleanFolder(newFolder) && moveTo(moving, newFolder)} disabled={!cleanFolder(newFolder)} />
            </View>
          </View>
        ) : null}
      </Drawer>
    </View>
  );
}

/** Nothing opened yet: one line, and a quiet drawing of a page beside its code. */
function EmptyState({ theme }: { theme: Theme }) {
  return (
    <View style={styles.empty}>
      <View style={styles.art} accessible accessibilityLabel="A page beside its code">
        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.edge, transform: [{ rotate: '-4deg' }] }]}>
          <View style={[styles.bar, { width: '70%', backgroundColor: theme.ink }]} />
          <View style={[styles.bar, { width: '90%', backgroundColor: theme.rule }]} />
          <View style={[styles.bar, { width: '80%', backgroundColor: theme.rule }]} />
          <View style={[styles.block, { backgroundColor: theme.accentWash }]} />
          <View style={[styles.bar, { width: '60%', backgroundColor: theme.rule }]} />
        </View>
        <View style={[styles.sheet, styles.codeSheet, { backgroundColor: theme.isDark ? '#151618' : '#FFFFFF', borderColor: theme.edge, transform: [{ rotate: '5deg' }] }]}>
          <Glyph name="code" size={30} color={theme.accent} weight={1.8} />
          {[0.8, 0.55, 0.7, 0.4].map((w, i) => (
            <View key={i} style={[styles.bar, { width: `${w * 100}%`, backgroundColor: theme.rule, marginLeft: i % 2 ? 12 : 0 }]} />
          ))}
        </View>
      </View>
      <Text style={[type.title, { color: theme.ink, textAlign: 'center' }]}>Open an HTML file to read it here.</Text>
      <Note theme={theme} style={{ textAlign: 'center', marginTop: space.s }}>
        From Mail, Files or Messages: tap Share on the file, then HTML Viewer. Or open it from the Files picker below.
      </Note>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.l + space.xs, paddingTop: space.m, paddingBottom: space.m },
  scroll: { paddingHorizontal: space.l, paddingBottom: space.xl, gap: space.m },
  chips: { gap: space.s, paddingBottom: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: radius.round, paddingHorizontal: space.m },
  hidden: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.xs, minHeight: 44 },
  how: { paddingHorizontal: space.xs, marginTop: space.xs },
  foot: { paddingHorizontal: space.l, paddingTop: space.m, gap: space.s },
  pair: { flexDirection: 'row', gap: space.s },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.l, paddingBottom: space.xl },
  art: { width: 230, height: 190, marginBottom: space.xl },
  sheet: { position: 'absolute', width: 132, height: 166, borderRadius: radius.control, borderWidth: 1, padding: space.m, gap: 9, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  codeSheet: { right: 8, top: 18 },
  bar: { height: 7, borderRadius: 4 },
  block: { height: 38, borderRadius: 6 },
});

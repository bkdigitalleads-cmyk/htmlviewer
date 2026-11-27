import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme, space, type, sourceTheme, SOURCE_THEMES } from '../theme';
import { useData } from '../data';
import { useApp } from '../state';
import type { FileRow } from '../db/repo';
import { kindOf, previews, typeInfo } from '../filetypes';
import { readText, Refused } from '../library';
import { hasRemote, hasScripts } from '../page';
import { findInLines, stepMatch } from '../find';
import { splitLines } from '../text';
import { canStyleSource, canEdit } from '../gates';
import { pageFlags, REMOTE_OFF_LINE, SCRIPTS_OFF_LINE, scaleLabel, stepScale, stepSourceSize } from '../rules';
import PageView from '../ui/PageView';
import CodeView, { CodeViewHandle } from '../ui/CodeView';
import FindBar from '../ui/FindBar';
import Glyph from '../ui/Glyph';
import { Card, Drawer, IconTap, Note, Row, Segments, SwitchRow, Tap, ToolItem, Toolbar, TopBar } from '../ui/Kit';

type Mode = 'page' | 'source';

/**
 * A file: Page (HTML and SVG) and Source. Page has text size, scripts,
 * web content, dark page, find and pinch to zoom; Source has coloring,
 * line numbers, wrap, find and Copy all. The toolbar: Find, Edit (Pro),
 * PDF (the first is free), Share.
 */
export default function Viewer({
  file,
  onBack,
  onEdit,
  onPdf,
  onShare,
}: {
  file: FileRow;
  onBack: () => void;
  onEdit: (path: string) => void;
  onPdf: (path: string, mode: Mode) => void;
  onShare: () => void;
}) {
  const theme = useTheme();
  const data = useData();
  const { isPro, askPro, say } = useApp();
  const [path, setPath] = useState(file.main);
  const kind = kindOf(path) ?? file.kind;
  const canPreview = previews(kind);
  const [mode, setMode] = useState<Mode>(canPreview ? 'page' : 'source');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [liveQuery, setLiveQuery] = useState('');
  const [index, setIndex] = useState(-1);
  const [pageCount, setPageCount] = useState(0);
  const [options, setOptions] = useState(false);
  const [themes, setThemes] = useState(false);
  const code = useRef<CodeViewHandle>(null);
  const flags = pageFlags(file);
  const { prefs, setPrefs } = data;

  useEffect(() => {
    setText(null);
    setError(null);
    try {
      setText(readText(file, path).text);
    } catch (e: any) {
      setError(e instanceof Refused ? e.message : 'This file could not be read.');
    }
  }, [file.id, file.updatedAt, path]);

  // The page is re-marked a moment after typing stops; Source follows at once.
  useEffect(() => {
    const t = setTimeout(() => setLiveQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setIndex(-1), [liveQuery, mode]);

  const lines = useMemo(() => (text == null ? [] : splitLines(text)), [text]);
  const sourceMatches = useMemo(() => (mode === 'source' && finding ? findInLines(lines, query) : []), [mode, finding, lines, query]);
  const total = mode === 'page' ? (finding ? pageCount : 0) : sourceMatches.length;

  const step = (dir: 1 | -1) => {
    const next = stepMatch(index, total, dir);
    setIndex(next);
    if (mode === 'source' && next >= 0) code.current?.showLine(sourceMatches[next].line);
  };
  useEffect(() => {
    // The first match shows as soon as there is one.
    if (finding && index === -1 && total > 0) {
      setIndex(0);
      if (mode === 'source') code.current?.showLine(sourceMatches[0].line);
    }
  }, [finding, index, total, mode, sourceMatches]);

  const onCount = useCallback((n: number) => setPageCount(n), []);
  const name = path.split('/').pop() ?? path;
  const noticeLine = mode === 'page' && text != null && kind === 'html' ? [!flags.scripts && hasScripts(text) ? 'scripts' : null, !flags.remote && hasRemote(text) ? 'web' : null].filter(Boolean) : [];
  const source = sourceTheme(prefs.sourceTheme, isPro, theme.isDark);

  const edit = async () => {
    if (canEdit(isPro) || (await askPro('edit'))) onEdit(path);
  };

  const copyAll = async () => {
    if (text == null) return;
    await Clipboard.setStringAsync(text);
    say('Copied.');
  };

  /** The paywall from inside the options drawer: the drawer closes first, since iOS shows one modal at a time. */
  const askFromDrawer = async () => {
    setOptions(false);
    await new Promise((r) => setTimeout(r, 450));
    return askPro('themes');
  };
  const pickTheme = async () => {
    if (canStyleSource(isPro)) {
      setOptions(false);
      setTimeout(() => setThemes(true), 450);
      return;
    }
    if (await askFromDrawer()) setTimeout(() => setThemes(true), 450);
  };
  const changeSize = async (dir: 1 | -1) => {
    if (canStyleSource(isPro) || (await askFromDrawer())) setPrefs({ sourceSize: stepSourceSize(prefs.sourceSize, dir) });
  };

  let body: React.ReactNode;
  if (error) {
    body = (
      <View style={styles.center}>
        <Text style={[type.strong, { color: theme.ink, textAlign: 'center' }]}>{error}</Text>
      </View>
    );
  } else if (text == null) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.inkFaint} />
      </View>
    );
  } else if (mode === 'page' && canPreview) {
    body = (
      <PageView
        theme={theme}
        file={file}
        path={path}
        html={text}
        scripts={flags.scripts}
        remote={flags.remote}
        scale={prefs.scale}
        dark={prefs.dark}
        find={finding ? liveQuery : ''}
        findIndex={index}
        onCount={onCount}
        onSibling={(p) => {
          setPath(p);
          setMode(previews(kindOf(p) ?? 'txt') ? 'page' : 'source');
        }}
      />
    );
  } else {
    body = <CodeView ref={code} theme={theme} source={source} text={text} lang={typeInfo(kind).lang} size={canStyleSource(isPro) ? prefs.sourceSize : 13} wrap={prefs.wrap} matches={sourceMatches} current={index} />;
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <TopBar
        theme={theme}
        title={name}
        sub={path !== file.main ? `In ${file.name}` : undefined}
        onBack={path !== file.main ? () => setPath(file.main) : onBack}
        right={<IconTap theme={theme} glyph={mode === 'page' ? 'textSize' : 'wrap'} label={mode === 'page' ? 'Page options' : 'Source options'} onPress={() => setOptions(true)} />}
      />
      {canPreview ? (
        <View style={styles.segments}>
          <Segments
            theme={theme}
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'page', label: 'Page', glyph: 'page' },
              { id: 'source', label: 'Source', glyph: 'code' },
            ]}
          />
        </View>
      ) : null}
      {noticeLine.length > 0 ? (
        <Tap onPress={() => setOptions(true)} style={[styles.notice, { borderBottomColor: theme.rule }]} accessibilityRole="button" accessibilityHint="Opens the page options">
          <Glyph name={noticeLine[0] === 'scripts' ? 'script' : 'web'} size={17} color={theme.inkSoft} />
          <Text style={[type.small, { color: theme.inkSoft, flex: 1 }]} numberOfLines={2}>
            {noticeLine.length === 2 ? 'Scripts and web content are off for files from other apps.' : noticeLine[0] === 'scripts' ? SCRIPTS_OFF_LINE : REMOTE_OFF_LINE}
          </Text>
          <Text style={[type.small, { color: theme.ink, fontWeight: '600' }]}>Change</Text>
        </Tap>
      ) : null}
      <View style={{ flex: 1 }}>{body}</View>

      {finding ? (
        <FindBar
          theme={theme}
          query={query}
          onQuery={setQuery}
          current={index}
          total={total}
          onStep={step}
          onDone={() => {
            setFinding(false);
            setQuery('');
            setLiveQuery('');
          }}
        />
      ) : (
        <Toolbar theme={theme}>
          <ToolItem theme={theme} glyph="find" label={mode === 'page' ? 'Find in page' : 'Find'} onPress={() => setFinding(true)} disabled={text == null} />
          {mode === 'source' ? <ToolItem theme={theme} glyph="copy" label="Copy all" onPress={copyAll} disabled={text == null} /> : null}
          <ToolItem theme={theme} glyph="edit" label="Edit" onPress={edit} disabled={text == null} badge={canEdit(isPro) ? undefined : 'lock'} />
          <ToolItem theme={theme} glyph="pdf" label="PDF" onPress={() => onPdf(path, mode)} disabled={text == null} />
          <ToolItem theme={theme} glyph="share" label="Share" onPress={onShare} />
        </Toolbar>
      )}

      <Drawer theme={theme} visible={options && mode === 'page'} onClose={() => setOptions(false)} title="Page">
        <View style={{ gap: space.m, paddingBottom: space.l }}>
          <Card theme={theme}>
            <Row
              theme={theme}
              first
              glyph="textSize"
              label="Text size"
              right={
                <View style={styles.stepper}>
                  <IconTap theme={theme} glyph="minus" label="Smaller text" onPress={() => setPrefs({ scale: stepScale(prefs.scale, -1) })} />
                  <Text style={[type.strong, styles.stepValue, { color: theme.ink }]}>{scaleLabel(prefs.scale)}</Text>
                  <IconTap theme={theme} glyph="plus" label="Larger text" onPress={() => setPrefs({ scale: stepScale(prefs.scale, 1) })} />
                </View>
              }
            />
            <SwitchRow theme={theme} glyph="moon" label="Dark page" value={prefs.dark} onChange={(v) => setPrefs({ dark: v })} line="Turns a light page dark for reading at night." />
          </Card>
          <Card theme={theme}>
            <SwitchRow
              theme={theme}
              first
              glyph="script"
              label="Scripts"
              value={flags.scripts}
              onChange={(v) => data.setFlags(file.id, { scripts: v })}
              line={file.origin === 'outside' ? SCRIPTS_OFF_LINE : 'On for files made in this app.'}
            />
            <SwitchRow
              theme={theme}
              glyph="web"
              label="Web content"
              value={flags.remote}
              onChange={(v) => data.setFlags(file.id, { remote: v })}
              line={file.origin === 'outside' ? REMOTE_OFF_LINE : 'Pictures, styles and fonts from the web load.'}
            />
          </Card>
          <Note theme={theme}>Pinch to zoom the page. Links to the web open in the browser. The page can only read files in its own folder.</Note>
        </View>
      </Drawer>

      <Drawer theme={theme} visible={options && mode === 'source'} onClose={() => setOptions(false)} title="Source">
        <View style={{ gap: space.m, paddingBottom: space.l }}>
          <Card theme={theme}>
            <SwitchRow theme={theme} first glyph="wrap" label="Wrap long lines" value={prefs.wrap} onChange={(v) => setPrefs({ wrap: v })} />
            <Row theme={theme} glyph="code" label="Theme" sub={canStyleSource(isPro) && prefs.sourceTheme !== 'system' ? SOURCE_THEMES[prefs.sourceTheme].name : 'Paper in light, Night in dark'} onPress={pickTheme} right={canStyleSource(isPro) ? undefined : <Glyph name="lock" size={16} color={theme.inkFaint} />} />
            <Row
              theme={theme}
              glyph="textSize"
              label="Font size"
              right={
                <View style={styles.stepper}>
                  <IconTap theme={theme} glyph="minus" label="Smaller code" onPress={() => changeSize(-1)} />
                  <Text style={[type.strong, styles.stepValue, { color: theme.ink }]}>{canStyleSource(isPro) ? prefs.sourceSize : 13}</Text>
                  <IconTap theme={theme} glyph="plus" label="Larger code" onPress={() => changeSize(1)} />
                </View>
              }
            />
          </Card>
          {!canStyleSource(isPro) ? <Note theme={theme}>Themes and font size come with Pro.</Note> : null}
        </View>
      </Drawer>

      <Drawer theme={theme} visible={themes} onClose={() => setThemes(false)} title="Source theme">
        <Card theme={theme} style={{ marginBottom: space.l }}>
          <Row theme={theme} first label="Match the system" sub="Paper in light, Night in dark" right={prefs.sourceTheme === 'system' ? <Glyph name="check" size={20} color={theme.ink} /> : <View />} onPress={() => setPrefs({ sourceTheme: 'system' })} />
          {Object.values(SOURCE_THEMES).map((t) => (
            <Row
              key={t.id}
              theme={theme}
              lead={<View style={[styles.swatch, { backgroundColor: t.bg, borderColor: theme.edge }]}><Text style={{ color: t.colors.tag, fontSize: 12 }}>{'<'}</Text><Text style={{ color: t.colors.value, fontSize: 12 }}>a</Text></View>}
              label={t.name}
              right={prefs.sourceTheme === t.id ? <Glyph name="check" size={20} color={theme.ink} /> : <View />}
              onPress={() => setPrefs({ sourceTheme: t.id })}
            />
          ))}
        </Card>
      </Drawer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  segments: { paddingHorizontal: space.l, paddingVertical: space.s },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, paddingVertical: space.s, borderBottomWidth: StyleSheet.hairlineWidth },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepValue: { minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  swatch: { width: 34, height: 26, borderRadius: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

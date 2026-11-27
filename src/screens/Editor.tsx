import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InputAccessoryView, KeyboardAvoidingView, NativeSyntheticEvent, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputSelectionChangeEventData, useWindowDimensions, View } from 'react-native';
import { useTheme, fonts, space, type, sourceTheme } from '../theme';
import { useData } from '../data';
import { useApp } from '../state';
import type { FileRow } from '../db/repo';
import { kindOf, previews } from '../filetypes';
import { readText } from '../library';
import { findAll, replaceAll, replaceOne, stepMatch } from '../find';
import { canStyleSource } from '../gates';
import { pageFlags } from '../rules';
import { CODE_KEYS, EMPTY_HISTORY, History, insertAt, isSmallEdit, record, redo, Sel, undo } from '../undo';
import PageView from '../ui/PageView';
import FindBar from '../ui/FindBar';
import Glyph from '../ui/Glyph';
import { Card, Drawer, Field, IconTap, Note, Quiet, Row, Tap, TopBar } from '../ui/Kit';
import { doneHaptic } from '../ui/motion';

const KEYS_ID = 'hv-code-keys';

/**
 * The editor (Pro): a plain code editor with the live page above it (for
 * HTML and SVG), undo and redo, find and replace, and a row of code
 * characters above the keyboard. Save goes over the app's copy or makes a
 * new file; the original in the other app is never changed.
 */
export default function Editor({ file, path, onClose, onSaved }: { file: FileRow; path: string; onClose: () => void; onSaved: (row: FileRow) => void }) {
  const theme = useTheme();
  const data = useData();
  const { isPro, setEditing, say } = useApp();
  const { height } = useWindowDimensions();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [original, setOriginal] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const sel = useRef<Sel>({ start: 0, end: 0 });
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [index, setIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  const kind = kindOf(path) ?? file.kind;
  const live = previews(kind);
  const flags = pageFlags(file);
  const source = sourceTheme(data.prefs.sourceTheme, isPro, theme.isDark);
  const size = canStyleSource(isPro) ? data.prefs.sourceSize : 13;
  const dirty = text !== original;

  useEffect(() => {
    setEditing(true);
    return () => setEditing(false);
  }, [setEditing]);

  useEffect(() => {
    try {
      const t = readText(file, path).text;
      setText(t);
      setOriginal(t);
      setPreview(t);
    } catch (e: any) {
      setFailed(e?.message ?? 'This file could not be read.');
    }
  }, [file, path]);

  // The live page follows a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setPreview(text), 450);
    return () => clearTimeout(t);
  }, [text]);

  const matches = useMemo(() => (finding ? findAll(text, query) : []), [finding, text, query]);

  const apply = (next: string, nextSel: Sel, small: boolean) => {
    setHistory((h) => record(h, { text, sel: sel.current }, Date.now(), small));
    setText(next);
    sel.current = nextSel;
    requestAnimationFrame(() => input.current?.setSelection(nextSel.start, nextSel.end));
  };

  const onChange = (next: string) => {
    setHistory((h) => record(h, { text, sel: sel.current }, Date.now(), isSmallEdit(text, next)));
    setText(next);
  };

  const onSel = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    sel.current = e.nativeEvent.selection;
  };

  const doUndo = () => {
    const r = undo(history, { text, sel: sel.current });
    if (!r) return;
    setHistory(r.h);
    setText(r.snap.text);
    sel.current = r.snap.sel;
    requestAnimationFrame(() => input.current?.setSelection(r.snap.sel.start, r.snap.sel.end));
  };
  const doRedo = () => {
    const r = redo(history, { text, sel: sel.current });
    if (!r) return;
    setHistory(r.h);
    setText(r.snap.text);
    sel.current = r.snap.sel;
    requestAnimationFrame(() => input.current?.setSelection(r.snap.sel.start, r.snap.sel.end));
  };

  const key = (insert: string) => {
    const r = insertAt(text, sel.current, insert);
    apply(r.text, r.sel, true);
  };

  const showMatch = (k: number) => {
    setIndex(k);
    const m = matches[k];
    if (!m) return;
    sel.current = { start: m.start, end: m.end };
    input.current?.focus();
    requestAnimationFrame(() => input.current?.setSelection(m.start, m.end));
  };

  const replaceCurrent = () => {
    const m = matches[index] ?? matches[0];
    if (!m) return;
    const r = replaceOne(text, m, replacement);
    apply(r.text, { start: r.caret, end: r.caret }, false);
  };
  const replaceEvery = () => {
    const r = replaceAll(text, query, replacement);
    if (r.count === 0) return;
    apply(r.text, { start: 0, end: 0 }, false);
    say(r.count === 1 ? 'Replaced 1.' : `Replaced ${r.count}.`);
  };

  const close = () => {
    if (!dirty) return onClose();
    Alert.alert('Discard your changes?', 'The app’s copy stays as it was.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async (how: 'over' | 'new') => {
    setSaving(false);
    try {
      const row = how === 'over' ? await data.saveOver(file.id, text) : await data.saveAsNew(file.id, text);
      setOriginal(text);
      doneHaptic();
      say(how === 'over' ? 'Saved.' : `Saved as ${row.name}.`);
      onSaved(row);
    } catch (e: any) {
      Alert.alert('The file was not saved', e?.message ?? 'Try once more. Your changes are still on screen.');
    }
  };

  const previewHeight = Math.round(height * 0.3);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <TopBar
        theme={theme}
        title={path.split('/').pop() ?? path}
        sub={dirty ? 'Edited' : 'No changes'}
        onBack={close}
        closeGlyph="close"
        right={
          <>
            <IconTap theme={theme} glyph="find" label="Find and replace" onPress={() => setFinding((f) => !f)} on={finding} />
            <Tap onPress={() => setSaving(true)} disabled={!dirty || failed != null} style={styles.save} accessibilityRole="button" accessibilityState={{ disabled: !dirty }}>
              <Text style={[type.strong, { color: dirty ? theme.accent : theme.inkFaint }]}>Save</Text>
            </Tap>
          </>
        }
      />

      {live && !failed ? (
        <View style={{ height: showPreview ? previewHeight : 34, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.rule }}>
          <Tap onPress={() => setShowPreview((s) => !s)} style={[styles.previewHead, { backgroundColor: theme.card }]} accessibilityRole="button" accessibilityLabel={showPreview ? 'Hide the live page' : 'Show the live page'}>
            <Glyph name="page" size={15} color={theme.inkSoft} />
            <Text style={[type.caps, { color: theme.inkSoft, flex: 1, fontSize: 11 }]}>Live page</Text>
            <Glyph name={showPreview ? 'up' : 'down'} size={16} color={theme.inkSoft} />
          </Tap>
          {showPreview ? (
            <PageView theme={theme} file={file} path={path} html={preview} scripts={flags.scripts} remote={flags.remote} scale={1} dark={false} find="" findIndex={-1} onCount={noop} onSibling={noop} />
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <View style={styles.center}>
          <Text style={[type.strong, { color: theme.ink }]}>{failed}</Text>
        </View>
      ) : (
        <TextInput
          ref={input}
          value={text}
          onChangeText={onChange}
          onSelectionChange={onSel}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          smartInsertDelete={false}
          autoComplete="off"
          textContentType="none"
          dataDetectorTypes="none"
          keyboardAppearance={theme.isDark ? 'dark' : 'light'}
          inputAccessoryViewID={KEYS_ID}
          scrollEnabled
          textAlignVertical="top"
          selectionColor={theme.accent}
          accessibilityLabel={`Code of ${path.split('/').pop()}`}
          style={[styles.editor, { backgroundColor: source.bg, color: source.text, fontFamily: fonts.mono, fontSize: size, lineHeight: Math.round(size * 1.55) }]}
        />
      )}

      {finding ? (
        <FindBar theme={theme} query={query} onQuery={(q) => (setQuery(q), setIndex(-1))} current={index} total={matches.length} onStep={(d) => showMatch(stepMatch(index, matches.length, d))} onDone={() => setFinding(false)}>
          <View style={styles.replaceRow}>
            <Field theme={theme} value={replacement} onChangeText={setReplacement} placeholder="Replace with" autoCorrect={false} autoCapitalize="none" spellCheck={false} style={{ flex: 1, minHeight: 40 }} accessibilityLabel="Replace with" />
            <Quiet theme={theme} label="Replace" onPress={replaceCurrent} disabled={matches.length === 0} />
            <Quiet theme={theme} label="All" onPress={replaceEvery} disabled={matches.length === 0} />
          </View>
        </FindBar>
      ) : null}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KEYS_ID}>
          <View style={[styles.keys, { backgroundColor: theme.card, borderTopColor: theme.rule }]}>
            <IconTap theme={theme} glyph="undo" label="Undo" onPress={doUndo} disabled={history.past.length === 0} size={40} />
            <IconTap theme={theme} glyph="redo" label="Redo" onPress={doRedo} disabled={history.future.length === 0} size={40} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.keyRow}>
              {CODE_KEYS.map((k) => (
                <Tap key={k.label} onPress={() => key(k.insert)} style={[styles.key, { backgroundColor: theme.well }, k.label === 'Tab' && { paddingHorizontal: 12 }]} pressedStyle={{ opacity: 0.6 }} accessibilityRole="button" accessibilityLabel={k.a11y ?? k.label}>
                  <Text style={{ fontFamily: fonts.monoMedium, fontSize: 16, color: theme.ink }}>{k.label}</Text>
                </Tap>
              ))}
            </ScrollView>
            <IconTap theme={theme} glyph="keyboard" label="Hide the keyboard" onPress={() => input.current?.blur()} size={40} />
          </View>
        </InputAccessoryView>
      ) : null}

      <Drawer theme={theme} visible={saving} onClose={() => setSaving(false)} title="Save">
        <View style={{ gap: space.m, paddingBottom: space.l }}>
          <Card theme={theme}>
            <Row theme={theme} first glyph="save" label="Save" sub="Over the app’s copy of this file" onPress={() => save('over')} />
            <Row theme={theme} glyph="plus" label="Save as a new file" sub="Keeps this one as it was" onPress={() => save('new')} />
          </Card>
          <Note theme={theme}>The file in Mail, Files or the app it came from is never changed.</Note>
        </View>
      </Drawer>
    </KeyboardAvoidingView>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  save: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.m },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: space.s, height: 34, paddingHorizontal: space.l },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  editor: { flex: 1, paddingHorizontal: space.m, paddingTop: space.m, paddingBottom: space.xl },
  replaceRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.xs },
  keys: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.xs, height: 48 },
  keyRow: { gap: 6, paddingHorizontal: space.xs, alignItems: 'center' },
  key: { minWidth: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

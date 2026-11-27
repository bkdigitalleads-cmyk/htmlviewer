import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colorLines, paintLine, Token } from '../highlight';
import type { Lang } from '../filetypes';
import type { LineMatch } from '../find';
import { fonts, SourceTheme, Theme } from '../theme';

export interface CodeViewHandle {
  /** Scrolls so a line is in view, a third of the way down. */
  showLine: (line: number) => void;
}

/**
 * The source: line numbers, syntax coloring, wrap on or off, and find
 * matches painted over the colors (the current one in the accent). Lines
 * are a virtualized list, so a long file opens at once. Each line can be
 * selected and copied; Copy all is on the screen's toolbar.
 */
const CodeView = forwardRef<CodeViewHandle, { theme: Theme; source: SourceTheme; text: string; lang: Lang; size: number; wrap: boolean; matches: LineMatch[]; current: number }>(function CodeView(
  { theme, source, text, lang, size, wrap, matches, current },
  ref
) {
  const list = useRef<FlatList<Token[]>>(null);
  const lines = useMemo(() => colorLines(text, lang), [text, lang]);
  const lineHeight = Math.round(size * 1.55);
  const digits = String(lines.length).length;
  const gutter = Math.max(2, digits) * size * 0.62 + 20;
  const longest = useMemo(() => lines.reduce((m, l) => Math.max(m, l.reduce((n, t) => n + t.s.length, 0)), 0), [lines]);
  const byLine = useMemo(() => {
    const m = new Map<number, { start: number; end: number; k: number }[]>();
    matches.forEach((x, k) => {
      const list2 = m.get(x.line) ?? [];
      list2.push({ start: x.start, end: x.end, k });
      m.set(x.line, list2);
    });
    return m;
  }, [matches]);

  useImperativeHandle(ref, () => ({
    showLine: (line: number) => {
      if (line < 0 || line >= lines.length) return;
      list.current?.scrollToIndex({ index: line, viewPosition: 0.3, animated: true });
    },
  }));

  const markBg = theme.accentWash;
  const currentBg = theme.accent;
  const renderLine = ({ item, index }: { item: Token[]; index: number }) => {
    const ms = byLine.get(index) ?? [];
    const cur = ms.findIndex((x) => x.k === current);
    const parts = paintLine(item, ms, cur);
    return (
      <View style={[styles.line, { minHeight: lineHeight }]}>
        <Text style={[styles.num, { width: gutter, fontSize: size - 1, lineHeight, color: source.gutterText, backgroundColor: source.gutter, fontFamily: fonts.mono }]} accessible={false} selectable={false}>
          {index + 1}
        </Text>
        <Text selectable style={[styles.code, { fontSize: size, lineHeight, color: source.text, fontFamily: fonts.mono }, !wrap && { flexShrink: 0 }]} maxFontSizeMultiplier={1.6}>
          {parts.length === 0 ? ' ' : null}
          {parts.map((p, i) => (
            <Text
              key={i}
              style={[
                { color: p.mark === 2 ? theme.onAccent : source.colors[p.t] },
                p.mark === 1 && { backgroundColor: markBg },
                p.mark === 2 && { backgroundColor: currentBg },
                (p.t === 'heading' || p.t === 'tag') && { fontFamily: fonts.monoMedium },
              ]}
            >
              {p.s}
            </Text>
          ))}
        </Text>
      </View>
    );
  };

  const body = (
    <FlatList
      ref={list}
      data={lines}
      keyExtractor={(_, i) => String(i)}
      renderItem={renderLine}
      initialNumToRender={60}
      maxToRenderPerBatch={80}
      windowSize={12}
      extraData={`${current}:${matches.length}:${size}:${wrap}:${source.id}`}
      getItemLayout={wrap ? undefined : (_, index) => ({ length: lineHeight, offset: lineHeight * index, index })}
      onScrollToIndexFailed={(info) => {
        list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.3, animated: true }), 80);
      }}
      contentContainerStyle={{ paddingBottom: 48 }}
      style={{ backgroundColor: source.bg }}
      accessibilityLabel={`Source, ${lines.length} lines`}
    />
  );

  if (wrap) return <View style={{ flex: 1, backgroundColor: source.bg }}>{body}</View>;
  const width = gutter + Math.max(longest, 20) * size * 0.61 + 32;
  return (
    <ScrollView horizontal style={{ flex: 1, backgroundColor: source.bg }} contentContainerStyle={{ minWidth: '100%', width }} directionalLockEnabled>
      <View style={{ flex: 1, width }}>{body}</View>
    </ScrollView>
  );
});

export default CodeView;

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start' },
  num: { flexShrink: 0, textAlign: 'right', paddingRight: 10, alignSelf: 'stretch' },
  code: { flex: 1, paddingLeft: 10, paddingRight: 12 },
});

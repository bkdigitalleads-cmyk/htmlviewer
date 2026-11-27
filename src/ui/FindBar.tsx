import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, space, type } from '../theme';
import { matchLabel } from '../find';
import Glyph from './Glyph';
import { Field, IconTap, Tap } from './Kit';

/** Find: a field, "3 of 12", previous and next, Done. Sits where the toolbar was, above the keyboard. */
export default function FindBar({
  theme,
  query,
  onQuery,
  current,
  total,
  onStep,
  onDone,
  children,
}: {
  theme: Theme;
  query: string;
  onQuery: (q: string) => void;
  current: number;
  total: number;
  onStep: (dir: 1 | -1) => void;
  onDone: () => void;
  /** Extra rows under the field (replace, in the editor). */
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: theme.card, borderTopColor: theme.rule, paddingBottom: children ? space.s : Math.max(insets.bottom - space.s, space.s) }]}>
      <View style={styles.row}>
        <View style={[styles.field, { backgroundColor: theme.well }]}>
          <Glyph name="find" size={18} color={theme.inkFaint} />
          <Field
            theme={theme}
            value={query}
            onChangeText={onQuery}
            autoFocus
            placeholder="Find"
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="search"
            onSubmitEditing={() => onStep(1)}
            blurOnSubmit={false}
            accessibilityLabel="Find"
            style={styles.input}
          />
          <Text style={[type.small, styles.count, { color: theme.inkSoft }]} numberOfLines={1} accessibilityLiveRegion="polite">
            {matchLabel(current, total, query)}
          </Text>
        </View>
        <IconTap theme={theme} glyph="up" label="Previous match" onPress={() => onStep(-1)} disabled={total === 0} />
        <IconTap theme={theme} glyph="down" label="Next match" onPress={() => onStep(1)} disabled={total === 0} />
        <Tap onPress={onDone} style={styles.done} accessibilityRole="button">
          <Text style={[type.strong, { color: theme.ink, fontSize: 16 }]}>Done</Text>
        </Tap>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.s, paddingTop: space.s, gap: space.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  field: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingLeft: space.s, paddingRight: space.s, marginRight: space.xs },
  input: { flex: 1, minWidth: 0, backgroundColor: 'transparent', paddingHorizontal: space.s, minHeight: 40 },
  count: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  done: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.s },
});

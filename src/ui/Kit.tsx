/**
 * The component kit ("Folio"). Everything tappable goes through Tap, so it
 * shows a pressed state; everything a finger taps is at least 44 points.
 * The accent is on Primary only (and the current find match, in the
 * viewer); everything else is ink on paper.
 *
 *   Tap        a pressable with a pressed state
 *   Primary    the one main action on a screen, in the accent
 *   Quiet      a secondary action on a well
 *   IconTap    a glyph-only button, always labeled for VoiceOver
 *   Segments   two or three choices in a track
 *   Card       a white card with a hairline edge
 *   Row        a row inside a Card
 *   SwitchRow  a row with a switch, and an optional line under it
 *   KindTag    the file kind ("HTML") in the mono
 *   Caps       a section head
 *   Note       small secondary text
 *   Field      a text field
 *   TopBar     back or close on the left, a title, actions on the right
 *   Toolbar    the thin bar of actions under a file
 *   Notice     a short line for a few seconds
 *   Drawer     a sheet from the bottom over a dimmed page
 */
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAIN_BUTTON, TOUCH, Theme, radius, space, type } from '../theme';
import type { Kind } from '../filetypes';
import { typeInfo } from '../filetypes';
import Glyph, { GlyphName } from './Glyph';
import { MODAL_ANIMATION, tick } from './motion';

export function Tap({
  style,
  pressedStyle,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; pressedStyle?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && (pressedStyle ?? { opacity: 0.55 })]}>
      {children}
    </Pressable>
  );
}

/** The main action: the accent, full width. One per screen. */
export function Primary({ theme, label, onPress, disabled = false, busy = false, glyph, hint }: { theme: Theme; label: string; onPress: () => void; disabled?: boolean; busy?: boolean; glyph?: GlyphName; hint?: string }) {
  const off = disabled || busy;
  return (
    <Tap
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: off, busy }}
      style={[styles.primary, { backgroundColor: theme.accent, opacity: disabled ? 0.4 : 1 }]}
      pressedStyle={{ opacity: 0.85 }}
    >
      {busy ? (
        <ActivityIndicator color={theme.onAccent} />
      ) : (
        <View style={styles.inline}>
          {glyph ? <Glyph name={glyph} size={22} color={theme.onAccent} weight={2} /> : null}
          <Text style={[type.button, { color: theme.onAccent }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Tap>
  );
}

/** A secondary action on a well. */
export function Quiet({ theme, label, onPress, glyph, disabled = false, grow = false, tone = 'ink', hint }: { theme: Theme; label: string; onPress: () => void; glyph?: GlyphName; disabled?: boolean; grow?: boolean; tone?: 'ink' | 'danger'; hint?: string }) {
  const color = tone === 'danger' ? theme.danger : theme.ink;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={[styles.quiet, grow && { flex: 1 }, { backgroundColor: theme.well, opacity: disabled ? 0.4 : 1 }]}
      pressedStyle={{ opacity: 0.7 }}
    >
      {glyph ? <Glyph name={glyph} size={20} color={color} /> : null}
      <Text style={[type.button, { color, fontSize: 16 }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
  );
}

/** A glyph-only button. Always labeled for VoiceOver. */
export function IconTap({ theme, glyph, label, onPress, disabled = false, color, size = 44, on = false }: { theme: Theme; glyph: GlyphName; label: string; onPress: () => void; disabled?: boolean; color?: string; size?: number; on?: boolean }) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: on }}
      hitSlop={size < TOUCH ? (TOUCH - size) / 2 : 0}
      style={[styles.icon, { width: size, height: size, opacity: disabled ? 0.3 : 1 }, on && { backgroundColor: theme.well }]}
      pressedStyle={{ backgroundColor: theme.well }}
    >
      <Glyph name={glyph} size={Math.round(Math.min(size, 48) * 0.52)} color={color ?? theme.ink} weight={1.8} />
    </Tap>
  );
}

/** Two or three choices in a track; the picked one is a card. */
export function Segments<T extends string>({ theme, options, value, onChange, label }: { theme: Theme; options: { id: T; label: string; glyph?: GlyphName }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <View style={[styles.segments, { backgroundColor: theme.well }]} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Tap
            key={o.id}
            onPress={() => {
              if (!on) tick();
              onChange(o.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[styles.segment, on && [styles.segmentOn, { backgroundColor: theme.card, borderColor: theme.edge }]]}
            pressedStyle={{ opacity: 0.7 }}
          >
            {o.glyph ? <Glyph name={o.glyph} size={17} color={on ? theme.ink : theme.inkSoft} weight={1.9} /> : null}
            <Text style={[type.small, { color: on ? theme.ink : theme.inkSoft, fontWeight: '600' }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

/** A white card with a hairline edge. */
export function Card({ theme, children, style }: { theme: Theme; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.edge }, style]}>{children}</View>;
}

/** A row inside a Card. */
export function Row({
  theme,
  label,
  sub,
  onPress,
  onLongPress,
  glyph,
  lead,
  right,
  first = false,
  tone = 'ink',
  hint,
  labelStyle,
}: {
  theme: Theme;
  label: string;
  sub?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  glyph?: GlyphName;
  lead?: React.ReactNode;
  right?: React.ReactNode;
  first?: boolean;
  tone?: 'ink' | 'danger' | 'accent';
  hint?: string;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const color = tone === 'danger' ? theme.danger : theme.ink;
  const body = (
    <>
      {lead ?? (glyph ? <Glyph name={glyph} size={22} color={tone === 'danger' ? theme.danger : theme.inkSoft} /> : null)}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color }, labelStyle]} numberOfLines={2}>
          {label}
        </Text>
        {sub ? <Text style={[type.small, { color: theme.inkSoft }]}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Glyph name="chevron" size={18} color={theme.inkFaint} weight={1.9} /> : null)}
    </>
  );
  const st = [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule }];
  if (!onPress) return <View style={st} accessible accessibilityLabel={sub ? `${label}. ${sub}` : label}>{body}</View>;
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} style={st} pressedStyle={{ backgroundColor: theme.well }} accessibilityRole="button" accessibilityLabel={sub ? `${label}. ${sub}` : label} accessibilityHint={hint}>
      {body}
    </Tap>
  );
}

/** A row with a switch, and an optional line under it (the one-line reason). */
export function SwitchRow({ theme, label, value, onChange, line, glyph, first = false, disabled = false }: { theme: Theme; label: string; value: boolean; onChange: (v: boolean) => void; line?: string; glyph?: GlyphName; first?: boolean; disabled?: boolean }) {
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule }]}>
      {glyph ? (
        <View style={{ paddingTop: 2 }}>
          <Glyph name={glyph} size={22} color={theme.inkSoft} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: theme.ink }]}>{label}</Text>
        {line ? <Text style={[type.small, { color: theme.inkSoft, marginTop: 2 }]}>{line}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: theme.accent, false: theme.well }} accessibilityLabel={label} accessibilityHint={line} />
    </View>
  );
}

/** The file kind, in the mono, in a small outlined tag. */
export function KindTag({ theme, kind, size = 'normal' }: { theme: Theme; kind: Kind; size?: 'normal' | 'large' }) {
  const big = size === 'large';
  return (
    <View style={[styles.tag, big && styles.tagLarge, { borderColor: theme.rule, backgroundColor: theme.bg }]} accessible={false}>
      <Text style={[type.tag, { color: theme.inkSoft }, big && { fontSize: 12 }]} maxFontSizeMultiplier={1.2}>
        {typeInfo(kind).tag}
      </Text>
    </View>
  );
}

/** A section head, letter-spaced in the mono. */
export function Caps({ theme, children, right }: { theme: Theme; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.caps}>
      <Text style={[type.caps, { color: theme.inkFaint, flex: 1 }]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Note({ theme, children, style }: { theme: Theme; children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.small, { color: theme.inkSoft }, style]}>{children}</Text>;
}

/** A text field. */
export const Field = React.forwardRef<TextInput, TextInputProps & { theme: Theme }>(function Field({ theme, style, ...rest }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.inkFaint}
      selectionColor={theme.accent}
      {...rest}
      style={[type.body, styles.field, { color: theme.ink, backgroundColor: theme.well }, style]}
    />
  );
});

/** The top bar: back or close on the left, a title, actions on the right. */
export function TopBar({ theme, title, onBack, closeGlyph = 'back', right, sub }: { theme: Theme; title?: string; onBack?: () => void; closeGlyph?: GlyphName; right?: React.ReactNode; sub?: string }) {
  return (
    <View style={[styles.bar, { borderBottomColor: theme.rule }]}>
      <View style={styles.barSide}>{onBack ? <IconTap theme={theme} glyph={closeGlyph} label={closeGlyph === 'close' ? 'Close' : 'Back'} onPress={onBack} /> : null}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <Text style={[type.strong, { color: theme.ink, fontSize: 16 }]} numberOfLines={1} ellipsizeMode="middle" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
        ) : null}
        {sub ? (
          <Text style={[type.small, { color: theme.inkFaint, fontSize: 12, lineHeight: 15 }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={[styles.barSide, styles.barRight]}>{right}</View>
    </View>
  );
}

/** One action on the Toolbar: a glyph over a short word. */
export function ToolItem({ theme, glyph, label, onPress, disabled = false, badge }: { theme: Theme; glyph: GlyphName; label: string; onPress: () => void; disabled?: boolean; badge?: GlyphName }) {
  return (
    <Tap onPress={onPress} disabled={disabled} style={[styles.tool, disabled && { opacity: 0.35 }]} pressedStyle={{ opacity: 0.5 }} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <View>
        <Glyph name={glyph} size={23} color={theme.ink} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.card }]}>
            <Glyph name={badge} size={11} color={theme.inkSoft} weight={2.2} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.toolLabel, { color: theme.inkSoft }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Tap>
  );
}

/** The thin bar of actions under a file. */
export function Toolbar({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.toolbar, { backgroundColor: theme.card, borderTopColor: theme.rule, paddingBottom: Math.max(insets.bottom - space.s, space.xs) }]}>{children}</View>;
}

/** A short line near the top for a few seconds ("Saved as PDF."). */
export function Notice({ theme, text, top }: { theme: Theme; text: string | null; top: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const last = useRef(text);
  if (text) last.current = text;
  useEffect(() => {
    Animated.timing(fade, { toValue: text ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [text, fade]);
  return (
    <Animated.View pointerEvents="none" style={[styles.notice, { top: top + space.s, opacity: fade, backgroundColor: theme.ink }]} accessibilityLiveRegion="polite">
      <Text style={[type.strong, { color: theme.bg, textAlign: 'center', fontSize: 15 }]}>{last.current}</Text>
    </Animated.View>
  );
}

/** A sheet from the bottom over a dimmed page. Fades in. Shrinks above the keyboard and scrolls. */
export function Drawer({ theme, visible, onClose, children, title, scroll = true }: { theme: Theme; visible: boolean; onClose: () => void; children: React.ReactNode; title?: string; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={MODAL_ANIMATION} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.drawer, { backgroundColor: theme.bg, borderColor: theme.edge, paddingBottom: Math.max(insets.bottom, space.l) }]}>
          <View style={[styles.grip, { backgroundColor: theme.rule }]} />
          <View style={styles.drawerHead}>
            <Text style={[type.title, { color: theme.ink, flex: 1, fontSize: 19 }]} accessibilityRole="header">
              {title ?? ''}
            </Text>
            <IconTap theme={theme} glyph="close" label="Close" onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView style={styles.drawerScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  primary: { minHeight: MAIN_BUTTON, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  quiet: { minHeight: 48, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, paddingHorizontal: space.l },
  icon: { borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', borderRadius: radius.control, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 34, borderRadius: radius.control - 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.s, borderWidth: 1, borderColor: 'transparent' },
  segmentOn: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 52, paddingHorizontal: space.l, paddingVertical: space.m },
  tag: { minWidth: 42, height: 24, borderRadius: radius.tag, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tagLarge: { minWidth: 48, height: 28 },
  caps: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginBottom: space.s, minHeight: 20, paddingHorizontal: space.xs },
  field: { minHeight: TOUCH, borderRadius: radius.control, paddingHorizontal: space.m },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  barSide: { minWidth: 92, flexDirection: 'row' },
  barRight: { justifyContent: 'flex-end' },
  tool: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50, gap: 2, paddingTop: space.s },
  toolLabel: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  toolbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.s },
  badge: { position: 'absolute', right: -6, top: -4, borderRadius: radius.round, padding: 1 },
  notice: { position: 'absolute', left: space.xl, right: space.xl, borderRadius: radius.control, paddingVertical: space.m, paddingHorizontal: space.l },
  drawer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingHorizontal: space.l, paddingTop: space.s, maxHeight: '90%' },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space.xs },
  drawerScroll: { flexGrow: 0, flexShrink: 1 },
  drawerHead: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH },
});

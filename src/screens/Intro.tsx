import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts, radius, space, type, Theme, SOURCE_THEMES } from '../theme';
import { getOffering } from '../purchases';
import { getTrialEligibleIds, trialLabel } from '../trial';
import { requestReminderPermission } from '../reminder';
import { trialLength } from '../offer';
import Glyph from '../ui/Glyph';
import { Card, KindTag, Primary, Row } from '../ui/Kit';

/**
 * First launch, in this order (App.tsx runs it):
 *   1-3. three short screens: open any HTML file from Mail or Files; see
 *        the page and its code; save it as a PDF
 *   a.   TrialSteps "Try it free"                      } only when RevenueCat says this
 *   b.   TrialSteps "We'll remind you the day before"  } Apple ID can get the free trial
 *   then the onboarding paywall (close button after 3 seconds).
 * Nothing is asked: no name or email, and no permission for the app to
 * work (the reminder screen asks for notifications only when a trial is
 * on offer).
 */
export const PAGES: { title: string; line: string; show: 'open' | 'code' | 'pdf' }[] = [
  { title: 'Open any HTML file from Mail or Files.', line: 'Tap Share on the attachment, then HTML Viewer. The app reads its own copy.', show: 'open' },
  { title: 'See the page and its code.', line: 'Read it like a web page, then switch to Source to see and search the code.', show: 'code' },
  { title: 'Save it as a PDF.', line: 'Print it or keep it in Files. Nothing leaves your iPhone unless you send it.', show: 'pdf' },
];

interface TrialOffer {
  length: string;
  then: string;
}

let offerPromise: Promise<TrialOffer | null> | null = null;

async function loadTrialOffer(): Promise<TrialOffer | null> {
  const off = await getOffering();
  const pkg = off?.weekly;
  if (!pkg) return null;
  if (!trialLabel(pkg, await getTrialEligibleIds([pkg]))) return null;
  const length = trialLength(pkg.product.introPrice);
  if (!length) return null;
  return { length, then: `${pkg.product.priceString} a week` };
}

/** Starts the eligibility check early; it is ready long before the trial screen. */
function trialOffer(): Promise<TrialOffer | null> {
  if (!offerPromise) offerPromise = loadTrialOffer().catch(() => null);
  return offerPromise;
}

export default function Intro({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  useEffect(() => {
    trialOffer();
  }, []);
  const next = () => (step < PAGES.length - 1 ? setStep(step + 1) : onDone());
  const p = PAGES[step];
  const visual = p.show === 'open' ? <OpenShow theme={theme} /> : p.show === 'code' ? <CodeShow theme={theme} /> : <PdfShow theme={theme} />;
  return <Page key={step} theme={theme} title={p.title} line={p.line} visual={visual} dots={{ count: PAGES.length, active: step }} button="Continue" onPress={next} />;
}

/** An attachment, and the app it opens in. */
function OpenShow({ theme }: { theme: Theme }) {
  return (
    <View style={{ alignSelf: 'stretch', gap: space.m }} accessible accessibilityLabel="An email with statement.html attached, shared to HTML Viewer">
      <Card theme={theme} style={styles.mail}>
        <View style={styles.mailHead}>
          <View style={[styles.avatar, { backgroundColor: theme.well }]}>
            <Glyph name="mail" size={18} color={theme.inkSoft} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.bar, { width: '55%', backgroundColor: theme.ink }]} />
            <View style={[styles.bar, { width: '80%', backgroundColor: theme.rule }]} />
          </View>
        </View>
        <View style={[styles.attach, { backgroundColor: theme.bg, borderColor: theme.rule }]}>
          <KindTag theme={theme} kind="html" size="large" />
          <View style={{ flex: 1 }}>
            <Text style={[type.strong, { color: theme.ink, fontSize: 15 }]}>statement.html</Text>
            <Text style={[type.small, { color: theme.inkSoft, fontSize: 13 }]}>48 KB</Text>
          </View>
          <Glyph name="share" size={22} color={theme.inkSoft} />
        </View>
      </Card>
      <View style={{ alignItems: 'center' }}>
        <Glyph name="down" size={22} color={theme.inkFaint} />
      </View>
      <Card theme={theme}>
        <Row theme={theme} first lead={<AppMark theme={theme} />} label="HTML Viewer" sub="Opens a copy, ready to read" right={<Glyph name="chevron" size={18} color={theme.inkFaint} />} />
      </Card>
    </View>
  );
}

function AppMark({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.appMark, { backgroundColor: theme.ink }]}>
      <Glyph name="code" size={20} color={theme.bg} weight={2} />
    </View>
  );
}

/** A small page above its colored code. */
function CodeShow({ theme }: { theme: Theme }) {
  const src = theme.isDark ? SOURCE_THEMES.night : SOURCE_THEMES.paper;
  const c = src.colors;
  const line = (n: number, parts: [string, string][]) => (
    <View style={styles.codeLine} key={n}>
      <Text style={[styles.codeNum, { color: src.gutterText }]}>{n}</Text>
      <Text style={styles.codeText}>
        {parts.map(([t, s], i) => (
          <Text key={i} style={{ color: (c as any)[t] }}>
            {s}
          </Text>
        ))}
      </Text>
    </View>
  );
  return (
    <View style={{ alignSelf: 'stretch', gap: space.m }} accessible accessibilityLabel="A page with a heading and a table, and below it the same page as colored code with line numbers">
      <Card theme={theme} style={styles.mini}>
        <Text style={{ fontFamily: 'Georgia', fontSize: 20, fontWeight: '700', color: '#1d2a24' }}>Spring report</Text>
        <View style={[styles.bar, { width: '86%', backgroundColor: '#e3e0d6', marginTop: 8 }]} />
        <View style={[styles.bar, { width: '64%', backgroundColor: '#e3e0d6' }]} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'flex-end' }}>
          {[22, 34, 48, 58].map((h, i) => (
            <View key={i} style={{ width: 26, height: h, borderRadius: 4, backgroundColor: '#2f7d55' }} />
          ))}
        </View>
      </Card>
      <View style={[styles.code, { backgroundColor: src.bg, borderColor: theme.edge }]}>
        {line(7, [['tag', '<h1'], ['tag', '>'], ['plain', 'Spring report'], ['tag', '</h1>']])}
        {line(8, [['tag', '<img '], ['attr', 'src'], ['punct', '='], ['value', '"images/harvest.svg"'], ['tag', '>']])}
        {line(9, [['tag', '<link '], ['attr', 'rel'], ['punct', '='], ['value', '"stylesheet"'], ['tag', '>']])}
        {line(10, [['comment', '<!-- 12 beds, 41 members -->']])}
      </View>
    </View>
  );
}

/** A page turning into a PDF. */
function PdfShow({ theme }: { theme: Theme }) {
  return (
    <View style={styles.pdfWrap} accessible accessibilityLabel="A page saved as statement.pdf">
      <View style={[styles.pdfPage, { backgroundColor: '#FFFFFF', borderColor: theme.edge }]}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#16171A' }}>Account statement</Text>
        {[0.9, 0.75, 0.82, 0.6].map((w, i) => (
          <View key={i} style={[styles.bar, { width: `${w * 100}%`, backgroundColor: '#E4E2DD' }]} />
        ))}
        <View style={{ marginTop: 6, gap: 5 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={[styles.bar, { width: '48%', backgroundColor: '#ECEAE5' }]} />
              <View style={[styles.bar, { width: '18%', backgroundColor: '#C9C6BF' }]} />
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.pdfChip, { backgroundColor: theme.card, borderColor: theme.edge }]}>
        <Glyph name="pdf" size={20} color={theme.ink} />
        <Text style={{ fontFamily: fonts.monoMedium, fontSize: 13, color: theme.ink }}>statement.pdf</Text>
        <Glyph name="check" size={18} color={theme.accent} weight={2.2} />
      </View>
    </View>
  );
}

/** The trial and reminder screens. Calls onDone right away when no trial is on offer. */
export function TrialSteps({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [offer, setOffer] = useState<TrialOffer | null | undefined>(undefined);
  const [step, setStep] = useState<'trial' | 'remind'>('trial');
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let live = true;
    trialOffer().then((o) => {
      if (!live) return;
      if (o) setOffer(o);
      else onDone();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offer) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.inkSoft} />
      </View>
    );
  }

  if (step === 'trial') {
    return (
      <Page
        theme={theme}
        title={`Try Pro free for ${offer.length}.`}
        line={`Then ${offer.then}. Cancel in Settings any time before it ends.`}
        button="Try it free"
        onPress={() => setStep('remind')}
        noPayment
        visual={
          <Card theme={theme} style={{ alignSelf: 'stretch' }}>
            <Row theme={theme} first glyph="check" label="Today" sub="Editing with the page live, every PDF, every recent file in folders." />
            <Row theme={theme} glyph="date" label="The day before it ends" sub="One reminder, so nothing surprises you." />
            <Row theme={theme} glyph="star" label={`After ${offer.length}`} sub={`${offer.then[0].toUpperCase()}${offer.then.slice(1)}. Cancel before then and pay nothing.`} />
          </Card>
        }
      />
    );
  }

  return (
    <Page
      theme={theme}
      title="We’ll remind you the day before it ends."
      line="It is the only notification the app sends."
      button="Continue"
      waiting={waiting}
      onPress={async () => {
        setWaiting(true);
        await requestReminderPermission();
        setWaiting(false);
        onDone();
      }}
    />
  );
}

/** One idea per screen: the picture, one large line, one line under it, the dots and the button. */
function Page({ theme, title, line, dots, button, onPress, waiting = false, noPayment = false, visual }: { theme: Theme; title: string; line?: string; visual?: React.ReactNode; dots?: { count: number; active: number }; button: string; onPress: () => void; waiting?: boolean; noPayment?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, space.l) }]}>
      {visual ? <View style={styles.visual}>{visual}</View> : null}
      <View style={visual ? styles.wordsUnder : styles.words}>
        <Text style={[type.display, { color: theme.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {line ? <Text style={[type.body, styles.line, { color: theme.inkSoft }]}>{line}</Text> : null}
      </View>
      {dots && (
        <View style={styles.dots} accessible accessibilityLabel={`Page ${dots.active + 1} of ${dots.count}`}>
          {Array.from({ length: dots.count }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === dots.active ? theme.ink : theme.rule }, i === dots.active && styles.dotOn]} />
          ))}
        </View>
      )}
      <View style={styles.footer}>
        {waiting ? <ActivityIndicator color={theme.inkSoft} style={styles.waiting} /> : <Primary theme={theme} label={button} onPress={onPress} />}
        {noPayment && (
          <View style={styles.noPaymentRow}>
            <Glyph name="check" size={18} color={theme.ink} weight={2.2} />
            <Text style={[type.strong, { color: theme.ink }]}>No payment now</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  words: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  visual: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.l, paddingTop: space.xl },
  wordsUnder: { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xl },
  line: { marginTop: space.m },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.s, marginBottom: space.l },
  dot: { width: 7, height: 7, borderRadius: radius.round },
  dotOn: { width: 22 },
  footer: { paddingHorizontal: space.l, gap: space.m, paddingTop: space.m },
  waiting: { height: 54 },
  noPaymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
  mail: { padding: space.l, gap: space.m },
  mailHead: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  avatar: { width: 36, height: 36, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 7, borderRadius: 4 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: space.m, borderRadius: radius.control, borderWidth: 1, padding: space.m },
  appMark: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mini: { padding: space.l, gap: 6, backgroundColor: '#FBFAF6' },
  code: { borderRadius: radius.card, borderWidth: 1, paddingVertical: space.m, overflow: 'hidden' },
  codeLine: { flexDirection: 'row', alignItems: 'flex-start' },
  codeNum: { width: 34, textAlign: 'right', paddingRight: 10, fontFamily: fonts.mono, fontSize: 12, lineHeight: 21 },
  codeText: { flex: 1, fontFamily: fonts.mono, fontSize: 12, lineHeight: 21 },
  pdfWrap: { alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: space.l },
  pdfPage: { width: 210, height: 272, borderRadius: 6, borderWidth: 1, padding: space.l, gap: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  pdfChip: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: -22, borderRadius: radius.round, borderWidth: 1, paddingHorizontal: space.l, paddingVertical: space.s, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

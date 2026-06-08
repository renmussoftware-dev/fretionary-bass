import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { COLORS, SPACE, RADIUS } from '../constants/theme';

interface Props {
  onDone: () => void;
}

const GOLD  = '#E8D44D';
const RED    = '#D45846';
const GREEN  = '#3FA08A';
const BLUE   = '#5C8FCC';
const DIM    = '#3F3F47';

// ── Mini bass fretboard illustration (4 strings: G D A E, high→low) ──────────
interface Dot { s: number; f: number; color: string; label?: string; dim?: boolean }
function MiniFretboard({ dots }: { dots: Dot[] }) {
  const W = 280, H = 92;
  const L = 20, T = 16, FW = 38, SH = 18, NW = 4, FRETS = 6, STRS = 4;
  function fx(f: number) { return L + NW + f * FW - FW / 2; }
  function sy(s: number) { return T + s * SH; }
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Fret lines */}
      {Array.from({ length: FRETS + 1 }).map((_, f) => (
        <Line key={f} x1={L + NW + f * FW} y1={T - 6} x2={L + NW + f * FW} y2={T + (STRS - 1) * SH + 6}
          stroke="#2E2E38" strokeWidth={f === 0 ? 3 : 1} />
      ))}
      {/* String lines — thicker toward the low E (bottom row) */}
      {Array.from({ length: STRS }).map((_, s) => (
        <Line key={s} x1={L} y1={sy(s)} x2={L + NW + FRETS * FW} y2={sy(s)}
          stroke="#3A3A46" strokeWidth={1 + s * 0.5} />
      ))}
      {/* Note dots — chord tones pop, scale tones sit dim */}
      {dots.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={fx(d.f)} cy={sy(d.s)} r={d.dim ? 6 : 10} fill={d.color}
            fillOpacity={d.dim ? 0.8 : 1} />
          {d.label ? (
            <SvgText x={fx(d.f)} y={sy(d.s) + 4} textAnchor="middle"
              fontSize={9} fontWeight="700" fill="#fff">{d.label}</SvgText>
          ) : null}
        </React.Fragment>
      ))}
    </Svg>
  );
}

// ── Slides ────────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    emoji: '🎸',
    title: 'Welcome to\nFretionary Bass',
    subtitle: 'See exactly what to play over any chord — the strong notes, lit up right where your hand is, on your bass.',
    illustration: null,
    accent: GOLD,
  },
  {
    emoji: null,
    title: 'Chord-Tone Overlay',
    subtitle: 'Pick a chord and its root, 3rd, 5th and 7th light up across the neck — with the matching scale dimmed underneath.',
    illustration: 'overlay',
    accent: GREEN,
  },
  {
    emoji: null,
    title: 'Your Bass, Your Tuning',
    subtitle: '4, 5 or 6 strings, standard or drop — the whole fretboard follows your tuning. Tap any note to hear it.',
    illustration: 'fretboard',
    accent: BLUE,
  },
];

export default function Onboarding({ onDone }: Props) {
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function goTo(index: number) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setCurrent(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: false });
  }

  function next() {
    if (current < SLIDES.length - 1) goTo(current + 1);
    else onDone();
  }

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={onDone}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          {slide.emoji ? (
            <Text style={styles.emoji}>{slide.emoji}</Text>
          ) : slide.illustration === 'overlay' ? (
            <View style={styles.illustrationBox}>
              {/* E minor 7 overlay: R / ♭3 / 5 / ♭7 lit, scale tones dimmed */}
              <MiniFretboard dots={[
                { s: 3, f: 0, color: GOLD,  label: 'R' }, // E
                { s: 3, f: 3, color: RED,   label: '3' }, // G (♭3)
                { s: 2, f: 2, color: GREEN, label: '5' }, // B
                { s: 1, f: 0, color: BLUE,  label: '7' }, // D (♭7)
                { s: 2, f: 0, color: DIM, dim: true },    // A
                { s: 1, f: 2, color: DIM, dim: true },    // E
                { s: 0, f: 0, color: DIM, dim: true },    // G
                { s: 0, f: 2, color: DIM, dim: true },    // A
              ]} />
            </View>
          ) : slide.illustration === 'fretboard' ? (
            <View style={styles.illustrationBox}>
              <MiniFretboard dots={[
                { s: 3, f: 0, color: GOLD,  label: 'E' },
                { s: 2, f: 0, color: GREEN, label: 'A' },
                { s: 1, f: 0, color: GREEN, label: 'D' },
                { s: 0, f: 0, color: GREEN, label: 'G' },
                { s: 3, f: 5, color: BLUE,  label: 'A' },
                { s: 1, f: 2, color: RED,   label: 'E' },
              ]} />
            </View>
          ) : null}
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <View style={[styles.accentLine, { backgroundColor: slide.accent }]} />
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>
      </Animated.View>

      {/* Bottom: dots + button */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View style={[
                styles.dot,
                i === current && { backgroundColor: slide.accent, width: 20 },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: slide.accent }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: current === 0 ? '#1a1400' : '#fff' }]}>
            {isLast ? 'Start Playing' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.bg },
  skip:             { position: 'absolute', top: 56, right: 24, zIndex: 10, padding: 8 },
  skipText:         { color: COLORS.textMuted, fontSize: 14 },

  content:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  illustrationWrap: { height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xl },
  illustrationBox:  { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border },
  emoji:            { fontSize: 80 },

  textWrap:         { alignItems: 'flex-start', width: '100%' },
  accentLine:       { width: 36, height: 3, borderRadius: 2, marginBottom: SPACE.md },
  title:            { fontSize: 32, fontWeight: '700', color: COLORS.text, lineHeight: 40, marginBottom: SPACE.md },
  subtitle:         { fontSize: 16, color: COLORS.textMuted, lineHeight: 24 },

  bottom:           { paddingHorizontal: 32, paddingBottom: 32, gap: SPACE.xl },
  dots:             { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },

  btn:              { borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center' },
  btnText:          { fontSize: 16, fontWeight: '700' },
});

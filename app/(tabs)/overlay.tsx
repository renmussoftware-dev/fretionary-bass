import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OverlayFretboard from '../../src/components/OverlayFretboard';
import TuningPicker from '../../src/components/TuningPicker';
import HelpSheet from '../../src/components/HelpSheet';
import { COLORS, SPACE, RADIUS, FONT_FAMILY } from '../../src/constants/theme';
import { NOTES, NOTE_DISPLAY, CHORDS, COLORS as MUSIC_COLORS } from '../../src/constants/music';
import { useStore } from '../../src/store/useStore';
import { OVERLAY_CHORDS, suggestScaleForChord } from '../../src/utils/overlay';
import { useProGate } from '../../src/hooks/useProGate';
import { isChordFree } from '../../src/constants/subscription';

const LABEL_OPTIONS = [
  { label: 'Interval', value: 'interval' },
  { label: 'Note', value: 'name' },
  { label: 'Off', value: 'none' },
] as const;

// Fixed 4-fret position windows (start fret). "Whole neck" = null.
const POSITION_STARTS = [0, 3, 5, 7, 9, 12];

// Legend swatch colors keyed to the role palette.
const ROLE_SWATCH: { role: string; color: { fill: string; stroke: string; text: string }; label: string }[] = [
  { role: 'root',  color: MUSIC_COLORS.root,      label: 'R' },
  { role: '3rd',   color: MUSIC_COLORS.third,     label: '3' },
  { role: '5th',   color: MUSIC_COLORS.fifth,     label: '5' },
  { role: '7th',   color: MUSIC_COLORS.extension, label: '7' },
];

// Map a chord interval symbol (R, 3, ♭3, 5, ♯5, ♭7, ♭♭7, 2, 4, 6…) to a
// written-out ordinal. The accidental is dropped because the note name beside
// it already carries the actual pitch — so ♭3 and 3 both read "3rd".
function intervalOrdinal(symbol: string): string {
  if (symbol === 'R') return 'R';
  const degree = parseInt(symbol.replace(/[♭♯♮]/g, ''), 10);
  if (!degree || degree === 1) return 'R';
  const suffix = degree === 2 ? 'nd' : degree === 3 ? 'rd' : 'th';
  return `${degree}${suffix}`;
}

export default function OverlayScreen() {
  const {
    root, setRoot,
    chordKey, setChordKey,
    labelMode, setLabelMode,
    overlayUnderlay, setOverlayUnderlay,
    overlayFret, setOverlayFret,
  } = useStore();
  const { isPro, requirePro } = useProGate();
  const [helpOpen, setHelpOpen] = React.useState(false);

  const chord = CHORDS[chordKey];
  const activeChord = OVERLAY_CHORDS.find(c => c.key === chordKey);
  const scaleKey = suggestScaleForChord(chordKey);

  // Legend only shows the tones the active chord actually contains.
  const presentRoles = ROLE_SWATCH.filter((_, i) => i < (chord?.intervals.length ?? 3));

  // Plain-language "what to play" line: each interval written out as an
  // ordinal (R, 3rd, 5th, 7th…) followed by its note, e.g. "R: C#  3rd: F".
  const toneSummary = chord
    ? chord.intervals
        .map((iv, i) => `${intervalOrdinal(chord.intervalNames[i])}: ${NOTES[(root + iv) % 12]}`)
        .join('   ')
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Chord-tone overlay</Text>
          <Text style={styles.title} numberOfLines={1}>
            {NOTES[root]}{activeChord ? ` ${activeChord.symbol}` : ''}
          </Text>
        </View>
        <TuningPicker />
        <TouchableOpacity
          onPress={() => setHelpOpen(true)}
          activeOpacity={0.7}
          style={styles.helpBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="How to use the Overlay"
        >
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Root note selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.noteScroll} contentContainerStyle={styles.noteRow}>
        {NOTES.map((note, i) => (
          <TouchableOpacity
            key={note}
            onPress={() => setRoot(i)}
            style={[styles.notePill, root === i && styles.notePillActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.noteText, root === i && styles.noteTextActive]}>
              {NOTE_DISPLAY[note] || note}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Fretboard */}
      <View style={styles.fbWrap}>
        <OverlayFretboard />
        {/* Legend */}
        <View style={styles.legendRow}>
          {presentRoles.map(s => (
            <View key={s.role} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color.fill, borderColor: s.color.stroke }]}>
                <Text style={[styles.legendDotText, { color: s.color.text }]}>{s.label}</Text>
              </View>
              <Text style={styles.legendLabel}>{s.role}</Text>
            </View>
          ))}
          {overlayUnderlay && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotScale]} />
              <Text style={styles.legendLabel}>{NOTES[root]} {scaleKey}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
        {/* Chord picker — triads are free; 6ths/7ths/altered are Pro */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Chord</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}>
            {OVERLAY_CHORDS.map(c => {
              const active = c.key === chordKey;
              const locked = !isPro && !isChordFree(c.key);
              return (
                <TouchableOpacity key={c.key}
                  onPress={() => locked ? requirePro(() => setChordKey(c.key)) : setChordKey(c.key)}
                  style={[styles.pill, active && styles.pillActive, locked && styles.pillLocked]}
                  activeOpacity={0.7}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {locked ? '🔒 ' : ''}{c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!isPro && (
            <TouchableOpacity onPress={() => requirePro(() => {})} activeOpacity={0.7}>
              <Text style={styles.upgradeHint}>🔒 Unlock all chords &amp; 7ths with Pro →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* What to play */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Chord tones</Text>
          <Text style={styles.toneSummary}>{toneSummary}</Text>
        </View>

        {/* Position lock */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Position</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}>
            <TouchableOpacity
              onPress={() => setOverlayFret(null)}
              style={[styles.pill, overlayFret === null && styles.pillActive]}
              activeOpacity={0.7}>
              <Text style={[styles.pillText, overlayFret === null && styles.pillTextActive]}>Whole neck</Text>
            </TouchableOpacity>
            {POSITION_STARTS.map(start => {
              const active = overlayFret === start;
              return (
                <TouchableOpacity key={start}
                  onPress={() => setOverlayFret(start)}
                  style={[styles.pill, active && styles.pillActive]}
                  activeOpacity={0.7}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {start}–{start + 3}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Scale underlay toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scale underlay</Text>
          <View style={styles.pillRowStatic}>
            <TouchableOpacity
              onPress={() => setOverlayUnderlay(true)}
              style={[styles.pill, overlayUnderlay && styles.pillActive]}
              activeOpacity={0.7}>
              <Text style={[styles.pillText, overlayUnderlay && styles.pillTextActive]}>On</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOverlayUnderlay(false)}
              style={[styles.pill, !overlayUnderlay && styles.pillActive]}
              activeOpacity={0.7}>
              <Text style={[styles.pillText, !overlayUnderlay && styles.pillTextActive]}>Off</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Note labels */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note labels</Text>
          <View style={styles.pillRowStatic}>
            {LABEL_OPTIONS.map(opt => {
              const active = labelMode === opt.value;
              return (
                <TouchableOpacity key={opt.value}
                  onPress={() => setLabelMode(opt.value as any)}
                  style={[styles.pill, active && styles.pillActive]}
                  activeOpacity={0.7}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: SPACE.xxl }} />
      </ScrollView>

      <HelpSheet topic="overlay" visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.sm,
    gap: SPACE.sm,
  },
  eyebrow: {
    fontSize: 11, fontWeight: '500',
    color: COLORS.textMuted, letterSpacing: 0.4, marginBottom: 1,
  },
  title: {
    fontSize: 20, fontWeight: '700',
    color: COLORS.text, letterSpacing: -0.2,
  },
  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  helpBtnText: { fontSize: 16, color: COLORS.accent, fontWeight: '800', lineHeight: 18 },
  // flexGrow:0 keeps this horizontal scroller from expanding to fill the
  // column's spare vertical space (which would stretch the pills tall).
  noteScroll: { flexGrow: 0, flexShrink: 0 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
    gap: 6,
  },
  notePill: {
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: 'transparent',
  },
  notePillActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  noteText: {
    fontSize: 13, fontWeight: '500', color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.mono, letterSpacing: 0.2,
  },
  noteTextActive: { color: COLORS.text, fontWeight: '700' },

  fbWrap: {
    backgroundColor: COLORS.bgElevated,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACE.md,
  },
  legendRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', gap: SPACE.md,
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  legendDotText: { fontSize: 9, fontWeight: '700', fontFamily: FONT_FAMILY.mono },
  legendDotScale: {
    backgroundColor: MUSIC_COLORS.scaleTone.fill,
    borderColor: MUSIC_COLORS.scaleTone.stroke,
  },
  legendLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },

  controls: { flex: 1 },
  section: { marginTop: SPACE.lg },
  sectionLabel: {
    fontSize: 10, fontWeight: '600', color: COLORS.textFaint,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: SPACE.sm, paddingHorizontal: SPACE.lg,
    fontFamily: FONT_FAMILY.mono,
  },
  pillRow: { flexDirection: 'row', paddingHorizontal: SPACE.lg, gap: 6, flexWrap: 'nowrap' },
  pillRowStatic: { flexDirection: 'row', paddingHorizontal: SPACE.lg, gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: 'transparent',
  },
  pillActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  pillLocked: { opacity: 0.5 },
  pillText: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted, letterSpacing: 0.1 },
  pillTextActive: { color: COLORS.text, fontWeight: '600' },

  upgradeHint: {
    fontSize: 12, fontWeight: '600', color: COLORS.accent,
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.md,
  },

  toneSummary: {
    fontSize: 14, color: COLORS.text,
    paddingHorizontal: SPACE.lg,
    fontFamily: FONT_FAMILY.mono, letterSpacing: 0.3,
  },
});

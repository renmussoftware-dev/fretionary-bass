import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Fretboard from '../../src/components/Fretboard';
import TopBar from '../../src/components/TopBar';
import InfoPanel from '../../src/components/InfoPanel';
import PillSelector from '../../src/components/PillSelector';
import DailyPickCard from '../../src/components/DailyPickCard';
import { COLORS, SPACE, RADIUS, FONT_FAMILY } from '../../src/constants/theme';
import {
  NOTES, NOTE_DISPLAY,
  SCALES, POSITION_COLORS,
} from '../../src/constants/music';
import { useStore, SCALE_SPEED_MS, type ScalePlaybackSpeed } from '../../src/store/useStore';
import { getScalePositions } from '../../src/utils/theory';
import { useProGate } from '../../src/hooks/useProGate';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import { isScaleFree, isChordFree } from '../../src/constants/subscription';
import { OVERLAY_CHORDS } from '../../src/utils/overlay';

const LABEL_OPTIONS = [
  { label: 'Note', value: 'name' },
  { label: 'Degree', value: 'degree' },
  { label: 'Interval', value: 'interval' },
  { label: 'None', value: 'none' },
];

export default function FretboardScreen() {
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;
  const { isPro, requirePro } = useProGate();
  const { playScale, stopScale } = useAudioEngine();
  const [playingScale, setPlayingScale] = React.useState(false);

  const {
    mode, root, scaleKey, setScaleKey,
    chordKey, setChordKey, labelMode, setLabelMode,
    activePosition, setActivePosition,
    customNotes, toggleCustomNote, clearCustomNotes,
  } = useStore();
  const setPlaybackHighlight = useStore(s => s.setPlaybackHighlight);
  const scalePlaybackSpeed = useStore(s => s.scalePlaybackSpeed);
  const setScalePlaybackSpeed = useStore(s => s.setScalePlaybackSpeed);

  // Playback is free for the scales the free tier can already select — locking
  // it there too would punish the user twice for the same paywall.
  const scalePlaybackLocked = !isPro && !isScaleFree(scaleKey);

  // Build the scale as MIDI and play the practice pattern: two octaves up then
  // back down to the root. Bass register — start at C1 + root and rise two
  // octaves (max B3 = 59), which stays inside the real sample range (C1–D#4).
  // Tap-again-to-stop.
  function handlePlayScale() {
    if (playingScale) {
      stopScale();
      setPlayingScale(false);
      setPlaybackHighlight(null);
      return;
    }
    const apply = () => {
      const sc = SCALES[scaleKey];
      if (!sc) return;
      const startMidi = 24 + root; // C1 + root
      const ascending: number[] = [startMidi];
      let cur = startMidi;
      for (let octave = 0; octave < 2; octave++) {
        for (const stepIv of sc.steps) {
          cur += stepIv;
          ascending.push(cur);
        }
      }
      const descending = ascending.slice(0, -1).reverse();
      const notes = [...ascending, ...descending];
      setPlayingScale(true);
      playScale(
        notes,
        SCALE_SPEED_MS[scalePlaybackSpeed],
        (idx) => setPlaybackHighlight(notes[idx] % 12),
        () => {
          setPlaybackHighlight(null);
          setPlayingScale(false);
        },
      );
    };
    if (scalePlaybackLocked) { requirePro(apply); return; }
    apply();
  }

  const positions = mode === 'scales' ? getScalePositions(root, scaleKey) : [];

  const scaleOptions = Object.keys(SCALES).map(k => ({
    label: k, value: k,
  }));

  // Arpeggio view: the v1 chord set only (triads, sus, 6ths, 7ths) — no 9/11/13
  // or altered extensions. Bass arpeggios target chord tones, and extensions
  // are out of v1 scope (spec §9). Single source of truth shared with the hero.
  const chordOptions = OVERLAY_CHORDS.map(c => ({
    label: c.label, value: c.key,
  }));

  const posOptions = [
    { label: 'All', value: 'all' },
    ...positions.map((p, i) => ({
      label: `Pos ${i + 1}`,
      value: String(i),
      dotColor: POSITION_COLORS[i]?.fill,
      color: POSITION_COLORS[i]?.fill,
    })),
  ];


  const controlsContent = (
    <>
        {/* Scale / chord of the day */}
        <DailyPickCard />
        {/* Scale selector */}
        {mode === 'scales' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Scale</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {scaleOptions.map(opt => {
                const locked = !isPro && !isScaleFree(opt.value);
                return (
                  <TouchableOpacity key={opt.value}
                    onPress={() => locked ? requirePro(() => setScaleKey(opt.value)) : setScaleKey(opt.value)}
                    style={[styles.pill, scaleKey === opt.value && styles.pillActive, locked && styles.pillLocked]}
                    activeOpacity={0.7}>
                    <Text style={[styles.pillText, scaleKey === opt.value && styles.pillTextActive]}>
                      {locked ? '🔒 ' : ''}{opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {/* Speed selector + Play — hear the scale across two octaves with
                each sounding note lit up on the neck. */}
            <View style={styles.speedRow}>
              <Text style={styles.speedLabel}>Speed</Text>
              {(['slow', 'normal'] as ScalePlaybackSpeed[]).map(sp => {
                const active = scalePlaybackSpeed === sp;
                return (
                  <TouchableOpacity key={sp}
                    onPress={() => setScalePlaybackSpeed(sp)}
                    style={[styles.speedPill, active && styles.speedPillActive]}
                    activeOpacity={0.7}>
                    <Text style={[styles.speedPillText, active && styles.speedPillTextActive]}>
                      {sp === 'slow' ? 'Slow' : 'Normal'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={handlePlayScale} style={styles.playScaleBtn} activeOpacity={0.85}>
              <Text style={styles.playScaleBtnText}>
                {scalePlaybackLocked ? '🔒  ' : ''}{playingScale ? '⏸  Stop' : '▶  Hear scale'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Arpeggio (chord-tone) selector */}
        {mode === 'chords' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Arpeggio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {chordOptions.map(opt => {
                const locked = !isPro && !isChordFree(opt.value);
                return (
                  <TouchableOpacity key={opt.value}
                    onPress={() => locked ? requirePro(() => setChordKey(opt.value)) : setChordKey(opt.value)}
                    style={[styles.pill, chordKey === opt.value && styles.pillActive, locked && styles.pillLocked]}
                    activeOpacity={0.7}>
                    <Text style={[styles.pillText, chordKey === opt.value && styles.pillTextActive]}>
                      {locked ? '🔒 ' : ''}{opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        {/* Custom note picker */}
        {mode === 'custom' && (
          <View style={styles.section}>
            <View style={styles.customHeader}>
              <Text style={styles.sectionLabel}>Notes</Text>
              {customNotes.length > 0 && (
                <TouchableOpacity onPress={clearCustomNotes} activeOpacity={0.7} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {NOTES.map((note, i) => {
                const selected = customNotes.includes(i);
                const isRoot = i === root;
                return (
                  <TouchableOpacity key={note}
                    onPress={() => toggleCustomNote(i)}
                    style={[
                      styles.pill,
                      selected && (isRoot ? styles.pillRoot : styles.pillActive),
                    ]}
                    activeOpacity={0.7}>
                    <Text style={[
                      styles.pillText,
                      selected && (isRoot ? styles.pillTextRoot : styles.pillTextActive),
                    ]}>
                      {NOTE_DISPLAY[note] || note}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.customHint}>
              Tap notes to highlight them on the fretboard. Use the root selector above to set your key — the root note is colored differently when included.
            </Text>
          </View>
        )}
        {/* Position selector */}
        {mode === 'scales' && positions.length > 0 && (
          <View style={styles.section}>
            <PillSelector label="Position" options={posOptions}
              value={activePosition === null ? 'all' : String(activePosition)}
              onChange={v => {
                if (v !== null && v !== 'all' && !isPro) { requirePro(() => setActivePosition(Number(v))); return; }
                setActivePosition(v === null || v === 'all' ? null : Number(v));
              }}
              allowDeselect={false} />
          </View>
        )}
        <View style={styles.section}>
          <PillSelector label="Note labels" options={LABEL_OPTIONS} value={labelMode}
            onChange={v => v && setLabelMode(v as any)} allowDeselect={false} />
        </View>
        <View style={{ height: SPACE.xxl }} />
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />

      {isTablet ? (
        /* ── iPad: fretboard fills top, controls in scrollable row below ── */
        <View style={styles.tabletLayout}>
          <View style={styles.tabletFbWrap}>
            <Fretboard />
          </View>
          <ScrollView style={styles.tabletControls} showsVerticalScrollIndicator={false}>
            {controlsContent}
          </ScrollView>
          <InfoPanel />
        </View>
      ) : (
        /* ── Phone: original vertical stack ── */
        <View style={{ flex: 1 }}>
          <View style={styles.fbWrap}>
            <Fretboard />
          </View>
          <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>

            {controlsContent}
          </ScrollView>
          <InfoPanel />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  fbWrap: {
    backgroundColor: COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SPACE.md,
  },
  controls: { flex: 1 },
  // iPad layout
  tabletLayout:    { flex: 1 },
  tabletFbWrap:    { backgroundColor: COLORS.bgElevated, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: SPACE.lg },
  tabletControls:  { flex: 1 },
  section: { marginTop: SPACE.lg },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    fontFamily: FONT_FAMILY.mono,
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.lg,
    gap: 6,
    flexWrap: 'nowrap',
  },
  // Surface-fill chip (no hard border, accent ring on active state)
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  pillRoot: {
    backgroundColor: '#E8D44D',
    borderColor: '#C4A800',
  },
  pillTextRoot: {
    color: '#5C4400',
  },
  pillLocked: {
    opacity: 0.5,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  speedLabel: {
    fontSize: 11, fontWeight: '600', color: COLORS.textMuted,
    marginRight: 4, letterSpacing: 0.3, textTransform: 'uppercase',
  },
  speedPill: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  speedPillActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  speedPillText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  speedPillTextActive: { color: COLORS.text },
  playScaleBtn: {
    alignSelf: 'center',
    marginTop: SPACE.md,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: 28, paddingVertical: 11,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  playScaleBtnText: {
    fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.2,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SPACE.lg,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  customHint: {
    fontSize: 11,
    color: COLORS.textFaint,
    paddingHorizontal: SPACE.lg,
    marginTop: SPACE.sm,
    lineHeight: 16,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },
  pillTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
});

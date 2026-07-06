import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, SPACE, FONT_FAMILY } from '../constants/theme';
import { NOTES, NOTE_DISPLAY } from '../constants/music';
import { useStore } from '../store/useStore';
import { useAudioEngine } from '../hooks/useAudioEngine';

// Compact chord suffixes for the chips (Major shows just the note name).
const COMPACT: Record<string, string> = {
  'Major': '', 'Minor': 'm', 'Diminished': 'dim', 'Augmented': 'aug',
  'Sus2': 'sus2', 'Sus4': 'sus4', 'Major 6': '6', 'Minor 6': 'm6',
  'Major 7': 'maj7', 'Dominant 7': '7', 'Minor 7': 'm7',
  'Half-Dim 7': 'm7♭5', 'Dim 7': '°7',
};

function chipLabel(root: number, chordKey: string): string {
  const note = NOTE_DISPLAY[NOTES[root]] || NOTES[root];
  return note + (COMPACT[chordKey] ?? chordKey);
}

// Presets are relative to the current root (scale degrees as semitone offsets),
// so "I–IV–V" becomes A–D–E when your root is A. All triads → free tier.
type Step = [number, string]; // [semitone offset from root, chord key]
const PRESETS: { name: string; steps: Step[] }[] = [
  { name: 'I–IV–V',        steps: [[0, 'Major'], [5, 'Major'], [7, 'Major']] },
  { name: 'Pop I–V–vi–IV', steps: [[0, 'Major'], [7, 'Major'], [9, 'Minor'], [5, 'Major']] },
  { name: 'ii–V–I',        steps: [[2, 'Minor'], [7, 'Major'], [0, 'Major']] },
  { name: 'Minor i–♭VII–♭VI', steps: [[0, 'Minor'], [10, 'Major'], [8, 'Major']] },
  {
    name: '12-Bar Blues',
    steps: [
      [0, 'Major'], [5, 'Major'], [0, 'Major'], [0, 'Major'],
      [5, 'Major'], [5, 'Major'], [0, 'Major'], [0, 'Major'],
      [7, 'Major'], [5, 'Major'], [0, 'Major'], [7, 'Major'],
    ],
  },
];

// Milliseconds each chord holds during auto-play. One chord ~ one bar at a
// relaxed practice tempo.
const PLAY_MS = 1600;

export default function ProgressionBar() {
  const progression = useStore(s => s.progression);
  const progressionIndex = useStore(s => s.progressionIndex);
  const root = useStore(s => s.root);
  const chordKey = useStore(s => s.chordKey);
  const setProgression = useStore(s => s.setProgression);
  const addProgressionChord = useStore(s => s.addProgressionChord);
  const removeProgressionChord = useStore(s => s.removeProgressionChord);
  const clearProgression = useStore(s => s.clearProgression);
  const selectProgressionStep = useStore(s => s.selectProgressionStep);
  const { playMidi } = useAudioEngine();

  const [playing, setPlaying] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasChords = progression.length > 0;

  function stop() {
    setPlaying(false);
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }

  // Jump the overlay to step i and sound its root note (a low bass octave).
  function goTo(i: number, sound: boolean) {
    selectProgressionStep(i);
    if (sound) {
      const step = useStore.getState().progression[i];
      if (step) playMidi(36 + step.root); // 36 = C2
    }
  }

  function togglePlay() {
    if (playing) { stop(); return; }
    const len = progression.length;
    if (len === 0) return;
    let i = progressionIndex >= 0 ? progressionIndex : 0;
    setPlaying(true);
    goTo(i, true);
    timer.current = setInterval(() => {
      i = (i + 1) % len;
      goTo(i, true);
    }, PLAY_MS);
  }

  function applyPreset(steps: Step[]) {
    stop();
    setProgression(steps.map(([iv, key]) => ({ root: (root + iv) % 12, chordKey: key })));
    setShowPresets(false);
    // Land on the first chord so the neck updates immediately (store writes are
    // synchronous, so the new progression is already in place here).
    selectProgressionStep(0);
  }

  // Editing the progression (add / remove / preset / clear) stops playback so
  // the auto-advance loop never runs against a stale list.
  useEffect(() => { stop(); }, [progression.length]);
  // Clean up the timer if the tab unmounts mid-play.
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  // Leave edit mode automatically once there's nothing left to edit.
  useEffect(() => { if (!hasChords && editing) setEditing(false); }, [hasChords, editing]);
  // Stop auto-play when the user leaves the Overlay tab — otherwise the loop
  // would keep changing the chord (and playing audio) on another screen.
  useFocusEffect(useCallback(() => () => stop(), []));

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Text style={styles.label}>Progression</Text>
        <View style={styles.toolbarActions}>
          {editing ? (
            <>
              <TouchableOpacity onPress={() => { stop(); clearProgression(); }} activeOpacity={0.7} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)} activeOpacity={0.7} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {hasChords && (
                <TouchableOpacity onPress={togglePlay} activeOpacity={0.8} style={styles.playBtn}>
                  <Text style={styles.playBtnText}>{playing ? '⏸  Stop' : '▶  Play'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowPresets(v => !v)}
                activeOpacity={0.7}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostBtnText}>Presets{showPresets ? ' ▴' : ' ▾'}</Text>
              </TouchableOpacity>
              {hasChords && (
                <TouchableOpacity onPress={() => { stop(); setEditing(true); }} activeOpacity={0.7} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {showPresets && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity key={p.name} onPress={() => applyPreset(p.steps)} activeOpacity={0.7} style={styles.presetPill}>
              <Text style={styles.presetText}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {hasChords ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {progression.map((c, i) => {
            const active = i === progressionIndex;
            return (
              <TouchableOpacity
                key={`${i}-${c.root}-${c.chordKey}`}
                onPress={() => editing ? removeProgressionChord(i) : (stop(), goTo(i, true))}
                activeOpacity={0.8}
                style={[styles.chip, active && !editing && styles.chipActive, editing && styles.chipEditing]}
              >
                {editing && <Text style={styles.chipRemove}>×</Text>}
                <Text style={[styles.chipText, active && !editing && styles.chipTextActive]}>{chipLabel(c.root, c.chordKey)}</Text>
              </TouchableOpacity>
            );
          })}
          {!editing && (
            <TouchableOpacity onPress={() => addProgressionChord(root, chordKey)} activeOpacity={0.7} style={styles.addChip}>
              <Text style={styles.addChipText}>＋ {chipLabel(root, chordKey)}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Build a chord progression — the neck follows every change. Tap “Presets” above for a starting point, or add the current chord:
          </Text>
          <TouchableOpacity onPress={() => addProgressionChord(root, chordKey)} activeOpacity={0.7} style={styles.addChipLg}>
            <Text style={styles.addChipText}>＋ Add {chipLabel(root, chordKey)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACE.sm,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center' },
  label: {
    flex: 1,
    fontSize: 10, fontWeight: '600', color: COLORS.textFaint,
    letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: FONT_FAMILY.mono,
  },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.full, backgroundColor: COLORS.accent,
  },
  playBtnText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  ghostBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  ghostBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  doneBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.full, backgroundColor: COLORS.accent,
  },
  doneBtnText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  presetRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  presetPill: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(110,96,217,0.10)',
    borderWidth: 1, borderColor: 'rgba(110,96,217,0.3)',
  },
  presetText: { fontSize: 12, fontWeight: '600', color: COLORS.text },

  chipRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 12, paddingRight: 8, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipEditing: {
    backgroundColor: 'rgba(212,88,70,0.12)',
    borderColor: 'rgba(212,88,70,0.55)',
  },
  chipText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono },
  chipTextActive: { color: COLORS.text },
  chipRemove: { fontSize: 16, fontWeight: '800', color: '#D45846', lineHeight: 16, marginRight: 1 },

  addChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  addChipLg: {
    alignSelf: 'flex-start', marginTop: SPACE.sm,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft,
  },
  addChipText: { fontSize: 13, fontWeight: '700', color: COLORS.text, fontFamily: FONT_FAMILY.mono },

  empty: { paddingVertical: 2 },
  emptyText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
});

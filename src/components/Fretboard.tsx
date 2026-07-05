import React, { useMemo } from 'react';
import { ScrollView, View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Rect, Circle, Line, Text as SvgText, G, Defs, LinearGradient, RadialGradient, Stop,
} from 'react-native-svg';
import {
  NOTES, SCALES, CHORDS,
  POSITION_COLORS, COLORS as MUSIC_COLORS,
} from '../constants/music';
import { COLORS, FONT_FAMILY } from '../constants/theme';
import {
  getScaleNotes, getChordNotes, getScalePositions, noteLabel,
} from '../utils/theory';
import { useStore } from '../store/useStore';
import { getTuning, tuningNoteClasses } from '../constants/tunings';
import { useAudioEngine } from '../hooks/useAudioEngine';

const TOTAL_FRETS = 15;
const INLAY_FRETS = [3, 5, 7, 9, 12, 15];

// Visual treatment for in-position vs out-of-position notes.
// Per the Obsidian redesign: in-position notes pop, out-of-position notes
// shrink to 86% scale and drop to 32% opacity (vs the prior equal-weight 18%).
const IN_RANGE_OPACITY = 1;
const OUT_OF_RANGE_OPACITY = 0.32;
const OUT_OF_RANGE_SCALE = 0.86;

export default function Fretboard() {
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;

  // Scale fretboard dimensions based on screen width
  const LEFT_PAD = isTablet ? 36 : 30;
  const TOP_PAD = isTablet ? 32 : 28;
  const FRET_W = isTablet ? Math.floor((screenW - 100) / TOTAL_FRETS) : 56;
  const STR_H = isTablet ? 44 : 36;
  const NUT_W = 8;
  const DOT_R = isTablet ? 17 : 14;
  const SVG_W = LEFT_PAD + NUT_W + TOTAL_FRETS * FRET_W + 18;

  const { root, scaleKey, chordKey, mode, labelMode, activePosition, tuningId, customNotes, toggleCustomNote } = useStore();
  const playbackHighlight = useStore(s => s.playbackHighlight);
  const { playFret } = useAudioEngine();

  const activeTuning = getTuning(tuningId);
  const noteClasses = useMemo(() => tuningNoteClasses(activeTuning), [activeTuning]);
  const stringNames = activeTuning.stringNames;

  // String count is data-driven (4 / 5 / 6) — drives every per-string layout
  // calc below. The renderer makes no assumption about how many strings exist.
  const STR_COUNT = activeTuning.stringCount;
  const LAST_STR = STR_COUNT - 1;
  const SVG_H = TOP_PAD + LAST_STR * STR_H + 40;

  function fretX(f: number) {
    if (f === 0) return LEFT_PAD + NUT_W / 2;
    return LEFT_PAD + NUT_W + f * FRET_W - FRET_W / 2;
  }
  function strY(s: number) { return TOP_PAD + s * STR_H; }

  const activeNotes = useMemo(() => {
    if (mode === 'chords') return getChordNotes(root, chordKey);
    if (mode === 'custom') return customNotes;
    return getScaleNotes(root, scaleKey);
  }, [root, scaleKey, chordKey, mode, customNotes]);

  const positions = useMemo(() =>
    mode === 'scales' ? getScalePositions(root, scaleKey, noteClasses) : [],
    [root, scaleKey, mode, noteClasses],
  );

  function isInRange(fret: number): boolean {
    if (mode === 'scales' && activePosition !== null) {
      const pos = positions[activePosition];
      return !!pos && fret >= pos.start && fret <= pos.end;
    }
    return true;
  }

  function getNoteColor(noteIdx: number, fret: number) {
    const notes = activeNotes;
    if (!notes.includes(noteIdx)) return null;
    const inRange = isInRange(fret);
    const opacity = inRange ? IN_RANGE_OPACITY : OUT_OF_RANGE_OPACITY;
    const scale = inRange ? 1 : OUT_OF_RANGE_SCALE;

    if (noteIdx === root) return { ...MUSIC_COLORS.root, opacity, scale, isRoot: true };

    if (mode === 'chords') {
      const ch = CHORDS[chordKey];
      const intv = (noteIdx - root + 12) % 12;
      const ci = ch.intervals.map(i => i % 12);
      const pos = ci.indexOf(intv);
      if (pos === 1) return { ...MUSIC_COLORS.third,     opacity, scale, isRoot: false };
      if (pos === 2) return { ...MUSIC_COLORS.fifth,     opacity, scale, isRoot: false };
      if (pos >= 3) return { ...MUSIC_COLORS.extension, opacity, scale, isRoot: false };
    }

    if (mode === 'scales') {
      const sc = SCALES[scaleKey];
      const intv = (noteIdx - root + 12) % 12;
      if (sc) {
        let cum = 0;
        const semitones = [0];
        for (const s of sc.steps) { cum += s; semitones.push(cum % 12); }
        const pos = semitones.indexOf(intv);
        if (pos === 2) return { ...MUSIC_COLORS.third,     opacity, scale, isRoot: false };
        if (pos === 4) return { ...MUSIC_COLORS.fifth,     opacity, scale, isRoot: false };
        if (pos >= 6) return { ...MUSIC_COLORS.extension, opacity, scale, isRoot: false };
      }
    }

    if (mode === 'custom') {
      // Color by interval relative to root — no scale context
      const intv = (noteIdx - root + 12) % 12;
      if (intv === 3 || intv === 4)   return { ...MUSIC_COLORS.third,     opacity, scale, isRoot: false }; // 3rd
      if (intv === 7)                 return { ...MUSIC_COLORS.fifth,     opacity, scale, isRoot: false }; // 5th
      if (intv === 10 || intv === 11) return { ...MUSIC_COLORS.extension, opacity, scale, isRoot: false }; // 7th
    }


    return { ...MUSIC_COLORS.scaleTone, opacity, scale, isRoot: false };
  }

  const inlayColor   = 'rgba(255,255,255,0.06)';
  const fretColor    = 'rgba(255,255,255,0.08)';
  const fretColorHL  = 'rgba(255,255,255,0.16)';
  const stringColor  = 'rgba(242,241,236,0.55)';
  const nutColor     = '#D9D6CC';

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        <Defs>
          {/* Position highlight: vertical gradient (no harsh outline) */}
          <LinearGradient id="posHL" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.20" />
            <Stop offset="100%" stopColor={COLORS.accent} stopOpacity="0.08" />
          </LinearGradient>
          {/* Soft radial glow under the active root note */}
          <RadialGradient id="rootGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={MUSIC_COLORS.root.fill} stopOpacity="0.45" />
            <Stop offset="100%" stopColor={MUSIC_COLORS.root.fill} stopOpacity="0" />
          </RadialGradient>
          {/* White glow marking the currently-playing note during scale playback. */}
          <RadialGradient id="playGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Inlay dots — positioned relative to the neck's vertical center so
            they stay centered for any string count (4 / 5 / 6). */}
        {INLAY_FRETS.map(f => {
          const x = LEFT_PAD + NUT_W + f * FRET_W - FRET_W / 2;
          const mid = LAST_STR / 2;
          if (f === 12) return (
            <G key={f}>
              <Circle cx={x} cy={strY(mid - 1)} r={3.5} fill={inlayColor} />
              <Circle cx={x} cy={strY(mid + 1)} r={3.5} fill={inlayColor} />
            </G>
          );
          return <Circle key={f} cx={x} cy={strY(mid)} r={3.5} fill={inlayColor} />;
        })}

        {/* Position highlight — soft gradient, no harsh outline */}
        {mode === 'scales' && activePosition !== null && positions[activePosition] && (() => {
          const pos = positions[activePosition];
          const x1 = pos.start === 0 ? LEFT_PAD : LEFT_PAD + NUT_W + pos.start * FRET_W - FRET_W / 2;
          const x2 = LEFT_PAD + NUT_W + (pos.end + 1) * FRET_W - FRET_W / 2;
          return (
            <Rect x={x1} y={strY(0) - 14} width={x2 - x1} height={(STR_COUNT - 1) * STR_H + 28}
              rx={10} fill="url(#posHL)" />
          );
        })()}

        {/* Frets */}
        {Array.from({ length: TOTAL_FRETS }, (_, i) => i + 1).map(f => (
          <Line key={f}
            x1={LEFT_PAD + NUT_W + f * FRET_W} y1={strY(0) - 10}
            x2={LEFT_PAD + NUT_W + f * FRET_W} y2={strY(LAST_STR) + 10}
            stroke={f === 12 ? fretColorHL : fretColor} strokeWidth={1}
          />
        ))}

        {/* Strings — hairline with thickness gradient */}
        {Array.from({ length: STR_COUNT }, (_, s) => (
          <G key={s}>
            <Line
              x1={LEFT_PAD} y1={strY(s)}
              x2={LEFT_PAD + NUT_W + TOTAL_FRETS * FRET_W} y2={strY(s)}
              stroke={stringColor} strokeWidth={0.5 + (s / STR_COUNT) * 1.4} strokeOpacity={0.7}
            />
            <SvgText
              x={LEFT_PAD - 10} y={strY(s) + 4}
              textAnchor="middle" fontSize={10} fill="rgba(242,241,236,0.40)"
              fontFamily={FONT_FAMILY.mono} fontWeight="500"
            >
              {stringNames[s]}
            </SvgText>
          </G>
        ))}

        {/* Nut — refined */}
        <Rect
          x={LEFT_PAD} y={strY(0) - 12}
          width={NUT_W} height={(STR_COUNT - 1) * STR_H + 24}
          rx={2} fill={nutColor} opacity={0.85}
        />

        {/* Fret numbers — monospace, tabular */}
        {[1,3,5,7,9,12,15].map(f => (
          <SvgText key={f}
            x={LEFT_PAD + NUT_W + f * FRET_W - FRET_W / 2}
            y={SVG_H - 6}
            textAnchor="middle" fontSize={9} fill={COLORS.textFaint}
            fontFamily={FONT_FAMILY.mono}
          >
            {f}
          </SvgText>
        ))}

        {/* Note dots */}
        {Array.from({ length: STR_COUNT }, (_, s) =>
          Array.from({ length: TOTAL_FRETS + 1 }, (_, f) => {
            const ni = (noteClasses[s] + f) % 12;
            const col = getNoteColor(ni, f);
            const isCustom = mode === 'custom';
            if (!col && !isCustom) return null;
            const x = fretX(f);
            const y = strY(s);

            // Custom mode: every unselected position is a faint, tappable
            // "ghost" target so the whole neck acts as a note picker. Tapping
            // toggles that pitch class into the custom set.
            if (!col) {
              return (
                <G key={`${s}-${f}`} onPress={() => { toggleCustomNote(ni); playFret(tuningId, s, f); }}>
                  <Circle cx={x} cy={y} r={DOT_R} fill="rgba(255,255,255,0.001)" />
                  <Circle
                    cx={x} cy={y} r={DOT_R * 0.42}
                    fill="rgba(255,255,255,0.05)"
                    stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                  />
                </G>
              );
            }
            const label = noteLabel(ni, root, labelMode, scaleKey, chordKey, mode);
            const fs = label.length > 2 ? 7 : 9;
            // When this pitch class is the one currently sounding in scale
            // playback, pop the dot and add a white ring + glow so every
            // position of that note lights up across the neck.
            const isPlaying = playbackHighlight !== null && ni === playbackHighlight;
            const r = DOT_R * col.scale * (isPlaying ? 1.35 : 1);
            return (
              <G key={`${s}-${f}`} opacity={col.opacity}
                onPress={() => { if (isCustom) toggleCustomNote(ni); playFret(tuningId, s, f); }}>
                {col.isRoot && col.opacity === 1 && (
                  <Circle cx={x} cy={y} r={DOT_R + 6} fill="url(#rootGlow)" />
                )}
                {isPlaying && (
                  <Circle cx={x} cy={y} r={DOT_R + 10} fill="url(#playGlow)" />
                )}
                <Circle
                  cx={x} cy={y} r={r}
                  fill={col.fill}
                  stroke={isPlaying ? '#ffffff' : col.stroke}
                  strokeWidth={isPlaying ? 2.5 : 1}
                />
                {label ? (
                  <SvgText
                    x={x} y={y + fs / 2 + 1}
                    textAnchor="middle" fontSize={fs} fontWeight="600"
                    fill={col.text}
                    fontFamily={FONT_FAMILY.mono}
                  >
                    {label}
                  </SvgText>
                ) : null}
              </G>
            );
          })
        )}
      </Svg>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
});

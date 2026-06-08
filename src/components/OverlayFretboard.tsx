import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Rect, Circle, Line, Text as SvgText, G, Defs, RadialGradient, Stop,
} from 'react-native-svg';
import { NOTES, COLORS as MUSIC_COLORS } from '../constants/music';
import { COLORS, FONT_FAMILY } from '../constants/theme';
import { useStore } from '../store/useStore';
import { getTuning, tuningNoteClasses } from '../constants/tunings';
import { getScaleNotes } from '../utils/theory';
import { getChordToneRoles, suggestScaleForChord, type ToneRole } from '../utils/overlay';

const TOTAL_FRETS = 15;
const INLAY_FRETS = [3, 5, 7, 9, 12, 15];
const WINDOW_SPAN = 3; // 4-fret position window (start .. start+3)

const OUT_OF_RANGE_OPACITY = 0.3;
const OUT_OF_RANGE_SCALE = 0.84;

const INTERVAL_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

// Role → dot palette. Seventh borrows the extension (blue) bucket; scale tones
// render in the dimmed neutral. Off cells are not drawn at all.
const ROLE_COLOR: Record<Exclude<ToneRole, 'off'>, { fill: string; stroke: string; text: string }> = {
  root:    MUSIC_COLORS.root,
  third:   MUSIC_COLORS.third,
  fifth:   MUSIC_COLORS.fifth,
  seventh: MUSIC_COLORS.extension,
  scale:   MUSIC_COLORS.scaleTone,
};

export default function OverlayFretboard() {
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;

  const { root, chordKey, labelMode, overlayUnderlay, overlayFret, tuningId } = useStore();

  const LEFT_PAD = isTablet ? 36 : 30;
  const TOP_PAD = isTablet ? 32 : 28;
  const FRET_W = isTablet ? Math.floor((screenW - 100) / TOTAL_FRETS) : 56;
  const STR_H = isTablet ? 44 : 36;
  const NUT_W = 8;
  const DOT_R = isTablet ? 17 : 14;
  const SVG_W = LEFT_PAD + NUT_W + TOTAL_FRETS * FRET_W + 18;

  const tuning = getTuning(tuningId);
  const noteClasses = useMemo(() => tuningNoteClasses(tuning), [tuning]);
  const stringNames = tuning.stringNames;
  const STR_COUNT = tuning.stringCount;
  const LAST_STR = STR_COUNT - 1;
  const SVG_H = TOP_PAD + LAST_STR * STR_H + 40;

  function fretX(f: number) {
    if (f === 0) return LEFT_PAD + NUT_W / 2;
    return LEFT_PAD + NUT_W + f * FRET_W - FRET_W / 2;
  }
  function strY(s: number) { return TOP_PAD + s * STR_H; }

  // Resolve the overlay once: chord-tone roles + the suggested scale's pcs.
  const chordRoles = useMemo(() => getChordToneRoles(root, chordKey), [root, chordKey]);
  const scaleKey = useMemo(() => suggestScaleForChord(chordKey), [chordKey]);
  const scalePcs = useMemo(() => getScaleNotes(root, scaleKey), [root, scaleKey]);

  const windowActive = overlayFret !== null;
  function inWindow(fret: number): boolean {
    if (!windowActive) return true;
    return fret >= overlayFret! && fret <= overlayFret! + WINDOW_SPAN;
  }

  function roleFor(pc: number): ToneRole {
    const cr = chordRoles[pc];
    if (cr !== undefined) return cr;
    if (overlayUnderlay && scalePcs.includes(pc)) return 'scale';
    return 'off';
  }

  function cellLabel(pc: number, role: ToneRole): string {
    if (labelMode === 'none') return '';
    if (labelMode === 'name') return NOTES[pc];
    // interval / degree both render interval-from-root on the overlay
    return INTERVAL_NAMES[(pc - root + 12) % 12];
  }

  const inlayColor  = 'rgba(255,255,255,0.06)';
  const fretColor   = 'rgba(255,255,255,0.08)';
  const fretColorHL = 'rgba(255,255,255,0.16)';
  const stringColor = 'rgba(242,241,236,0.55)';
  const nutColor    = '#D9D6CC';

  // Position-window highlight band (frets start..start+3).
  const windowBand = windowActive ? (() => {
    const start = overlayFret!;
    const end = Math.min(start + WINDOW_SPAN, TOTAL_FRETS);
    const x1 = start === 0 ? LEFT_PAD : LEFT_PAD + NUT_W + start * FRET_W - FRET_W / 2;
    const x2 = LEFT_PAD + NUT_W + (end + 1) * FRET_W - FRET_W / 2;
    return { x1, x2 };
  })() : null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        <Defs>
          <RadialGradient id="overlayRootGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={MUSIC_COLORS.root.fill} stopOpacity="0.45" />
            <Stop offset="100%" stopColor={MUSIC_COLORS.root.fill} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Inlay dots — centered for any string count */}
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

        {/* Position-window band */}
        {windowBand && (
          <Rect
            x={windowBand.x1} y={strY(0) - 14}
            width={windowBand.x2 - windowBand.x1} height={LAST_STR * STR_H + 28}
            rx={10} fill={COLORS.accent} fillOpacity={0.10}
            stroke={COLORS.accent} strokeOpacity={0.35} strokeWidth={1}
          />
        )}

        {/* Frets */}
        {Array.from({ length: TOTAL_FRETS }, (_, i) => i + 1).map(f => (
          <Line key={f}
            x1={LEFT_PAD + NUT_W + f * FRET_W} y1={strY(0) - 10}
            x2={LEFT_PAD + NUT_W + f * FRET_W} y2={strY(LAST_STR) + 10}
            stroke={f === 12 ? fretColorHL : fretColor} strokeWidth={1}
          />
        ))}

        {/* Strings */}
        {Array.from({ length: STR_COUNT }, (_, s) => (
          <G key={s}>
            <Line
              x1={LEFT_PAD} y1={strY(s)}
              x2={LEFT_PAD + NUT_W + TOTAL_FRETS * FRET_W} y2={strY(s)}
              stroke={stringColor} strokeWidth={0.5 + (s / STR_COUNT) * 1.6} strokeOpacity={0.7}
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

        {/* Nut */}
        <Rect
          x={LEFT_PAD} y={strY(0) - 12}
          width={NUT_W} height={LAST_STR * STR_H + 24}
          rx={2} fill={nutColor} opacity={0.85}
        />

        {/* Fret numbers */}
        {[1, 3, 5, 7, 9, 12, 15].map(f => (
          <SvgText key={f}
            x={LEFT_PAD + NUT_W + f * FRET_W - FRET_W / 2}
            y={SVG_H - 6}
            textAnchor="middle" fontSize={9} fill={COLORS.textFaint}
            fontFamily={FONT_FAMILY.mono}
          >
            {f}
          </SvgText>
        ))}

        {/* Note dots — scale tones first (underneath), chord tones on top */}
        {(['scale', 'chord'] as const).map(layer =>
          Array.from({ length: STR_COUNT }, (_, s) =>
            Array.from({ length: TOTAL_FRETS + 1 }, (_, f) => {
              const pc = (noteClasses[s] + f) % 12;
              const role = roleFor(pc);
              if (role === 'off') return null;
              const isScale = role === 'scale';
              if (layer === 'scale' ? !isScale : isScale) return null;

              const col = ROLE_COLOR[role];
              const inRange = inWindow(f);
              const opacity = inRange ? 1 : OUT_OF_RANGE_OPACITY;
              const scale = inRange ? 1 : OUT_OF_RANGE_SCALE;
              const isRoot = role === 'root';
              const x = fretX(f);
              const y = strY(s);
              const label = cellLabel(pc, role);
              const fs = label.length > 2 ? 7 : 9;
              const r = DOT_R * scale * (isScale ? 0.82 : 1);

              return (
                <G key={`${layer}-${s}-${f}`} opacity={opacity}>
                  {isRoot && inRange && (
                    <Circle cx={x} cy={y} r={DOT_R + 6} fill="url(#overlayRootGlow)" />
                  )}
                  <Circle
                    cx={x} cy={y} r={r}
                    fill={col.fill} stroke={col.stroke} strokeWidth={1}
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
          )
        )}
      </Svg>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
});

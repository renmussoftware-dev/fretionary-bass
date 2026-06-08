// Chord-tone overlay engine — the heart of Fretionary Bass.
//
// Given a root, a chord, and a tuning, it resolves every fretboard cell to a
// role: the strong chord tones (root / 3rd / 5th / 7th) light up in color, the
// suggested parent scale sits dimmed underneath, everything else is off. This
// is the "what do I play over this chord, right here, on my bass" answer.
//
// Reuses the shared interval data in constants/music.ts (CHORDS, SCALES) and
// the pitch-class helpers in theory.ts, so the theory stays in one place.

import { CHORDS, SCALES } from '../constants/music';
import { getScaleNotes, getChordNotes } from './theory';
import { tuningNoteClasses, type Tuning } from '../constants/tunings';

// Role priority for a cell: a chord tone always wins over a scale tone, which
// wins over nothing. 'scale' = in the dimmed underlay; 'off' = not shown.
export type ToneRole = 'root' | 'third' | 'fifth' | 'seventh' | 'scale' | 'off';

export interface FretCell {
  string: number;     // row index: 0 = highest string on top (matches renderer)
  fret: number;       // 0 = open
  pitchClass: number; // 0–11
  role: ToneRole;
}

// ── Chord → suggested parent scale (spec §4) ─────────────────────────────────
// Keyed by the display-name keys used in constants/music.ts CHORDS. This is the
// dimmed underlay the overlay draws beneath the chord tones.
export const CHORD_SUGGESTED_SCALE: Record<string, string> = {
  'Major 7':    'Major',          // Ionian (Lydian offered as an alt later)
  'Dominant 7': 'Mixolydian',
  'Minor 7':    'Dorian',         // Aeolian offered as an alt later
  'Half-Dim 7': 'Locrian',        // m7♭5
  'Dim 7':      'Locrian',        // v1 simplification (diminished scale later)
  'Major':      'Major',
  'Minor':      'Natural Minor',  // Aeolian
  'Diminished': 'Locrian',
  'Augmented':  'Melodic Minor',  // v1 simplification (whole-tone later)
  'Major 6':    'Major',
  'Minor 6':    'Dorian',
  'Sus2':       'Mixolydian',
  'Sus4':       'Mixolydian',
};

// v1 chord set for the hero picker, in display order. Triads first (the free
// tier), then 6ths, then 7ths. Symbol is the compact fretboard-reference label.
export interface OverlayChord {
  key: string;       // CHORDS key
  symbol: string;    // compact symbol, e.g. "m7"
  label: string;     // picker label
  triad: boolean;    // free-tier eligible (maj / min / dim)
}

export const OVERLAY_CHORDS: OverlayChord[] = [
  { key: 'Major',       symbol: 'maj',  label: 'Major',  triad: true  },
  { key: 'Minor',       symbol: 'm',    label: 'Minor',  triad: true  },
  { key: 'Diminished',  symbol: 'dim',  label: 'Dim',    triad: true  },
  { key: 'Augmented',   symbol: 'aug',  label: 'Aug',    triad: false },
  { key: 'Sus2',        symbol: 'sus2', label: 'Sus2',   triad: false },
  { key: 'Sus4',        symbol: 'sus4', label: 'Sus4',   triad: false },
  { key: 'Major 6',     symbol: '6',    label: 'Maj 6',  triad: false },
  { key: 'Minor 6',     symbol: 'm6',   label: 'Min 6',  triad: false },
  { key: 'Major 7',     symbol: 'maj7', label: 'Maj 7',  triad: false },
  { key: 'Dominant 7',  symbol: '7',    label: 'Dom 7',  triad: false },
  { key: 'Minor 7',     symbol: 'm7',   label: 'Min 7',  triad: false },
  { key: 'Half-Dim 7',  symbol: 'm7♭5', label: 'm7♭5',   triad: false },
  { key: 'Dim 7',       symbol: '°7',   label: 'Dim 7',  triad: false },
];

// The role a chord tone plays based on its position in the chord's interval
// stack: 0 = root, 1 = third (the quality-defining note — for sus chords this
// is the suspended 2/4), 2 = fifth, 3+ = seventh.
function roleForChordPosition(pos: number): Exclude<ToneRole, 'scale' | 'off'> {
  if (pos === 0) return 'root';
  if (pos === 1) return 'third';
  if (pos === 2) return 'fifth';
  return 'seventh';
}

/**
 * Map each chord tone's pitch class to its role. Later positions overwrite
 * earlier ones only on a pitch-class collision (none for v1 triads/7ths), so
 * the lowest-position role wins — which is what we want (root beats 7th).
 */
export function getChordToneRoles(rootPc: number, chordKey: string): Record<number, Exclude<ToneRole, 'scale' | 'off'>> {
  const ch = CHORDS[chordKey];
  const map: Record<number, Exclude<ToneRole, 'scale' | 'off'>> = {};
  if (!ch) return map;
  ch.intervals.forEach((iv, pos) => {
    const pc = (rootPc + iv) % 12;
    if (map[pc] === undefined) map[pc] = roleForChordPosition(pos);
  });
  return map;
}

/** The suggested parent scale key for a chord (falls back to Major). */
export function suggestScaleForChord(chordKey: string): string {
  const id = CHORD_SUGGESTED_SCALE[chordKey];
  return id && SCALES[id] ? id : 'Major';
}

/**
 * Resolve a single pitch class to its overlay role. Chord tone > scale tone >
 * off. When the underlay is hidden, non-chord tones are always 'off'.
 */
export function resolveRole(
  pc: number,
  rootPc: number,
  chordKey: string,
  scalePcs: readonly number[],
  showScaleUnderlay: boolean,
): ToneRole {
  const chordRoles = getChordToneRoles(rootPc, chordKey);
  const cr = chordRoles[pc];
  if (cr !== undefined) return cr;
  if (showScaleUnderlay && scalePcs.includes(pc)) return 'scale';
  return 'off';
}

export interface OverlayInput {
  tuning: Tuning;
  rootPc: number;
  chordKey: string;
  showScaleUnderlay: boolean;
  scaleKey?: string;                              // defaults to the suggestion
  fretRange?: { start: number; end: number };     // defaults to 0..totalFrets
  totalFrets?: number;                            // defaults to 15
}

/**
 * Build the full overlay grid: one FretCell per string/fret with its resolved
 * role. Cells are emitted in renderer order (string row 0 = highest string).
 * Off cells are included so callers can decide whether to draw a faint marker.
 */
export function buildOverlay(input: OverlayInput): FretCell[] {
  const {
    tuning, rootPc, chordKey, showScaleUnderlay,
    totalFrets = 15,
  } = input;
  const scaleKey = input.scaleKey ?? suggestScaleForChord(chordKey);
  const scalePcs = getScaleNotes(rootPc, scaleKey);
  const range = input.fretRange ?? { start: 0, end: totalFrets };
  const noteClasses = tuningNoteClasses(tuning); // high→low, length = stringCount

  const cells: FretCell[] = [];
  for (let s = 0; s < noteClasses.length; s++) {
    for (let f = range.start; f <= range.end; f++) {
      const pc = (noteClasses[s] + f) % 12;
      cells.push({
        string: s,
        fret: f,
        pitchClass: pc,
        role: resolveRole(pc, rootPc, chordKey, scalePcs, showScaleUnderlay),
      });
    }
  }
  return cells;
}

// Convenience re-export so the hero can label notes without reaching into both
// modules. Chord tones of the active chord, as pitch classes.
export function chordPitchClasses(rootPc: number, chordKey: string): number[] {
  return getChordNotes(rootPc, chordKey);
}

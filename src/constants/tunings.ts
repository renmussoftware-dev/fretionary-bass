// Tunings — each tuning provides per-string MIDI notes (low→high) and display
// names (high→low, matching Fretboard SVG row order: row 0 = highest string on
// top). Bass-specific: string count is variable (4 / 5 / 6) and lives in the
// data, so adding a tuning is config, never code.
//
// noteClasses (high→low) are derived from MIDI; provided as a convenience for
// fretboard math that uses the historical OPEN_STRINGS layout.
//
// MIDI ref (C-1 = 0, so C1 = 24, C2 = 36):
//   B0 = 23, E1 = 28, A1 = 33, D2 = 38, G2 = 43, C3 = 48
//   D1 = 26 (drop D), A0 = 21 (5-string drop A)

export interface Tuning {
  id: string;
  name: string;
  shortName: string;       // e.g. "STD", "Drop D" — fits in TopBar pill
  description: string;
  category: 'standard' | 'drop' | '5-string' | '6-string' | 'down' | 'low';
  stringCount: number;     // 4 | 5 | 6 — drives the fretboard renderer
  midi: number[];          // length === stringCount, low→high (audio engine order)
  stringNames: string[];   // length === stringCount, high→low (Fretboard SVG order)
}

export const TUNINGS: Tuning[] = [
  // ── v1 core (ship these) ──────────────────────────────────────────────────
  {
    id: 'standard',
    name: '4-String Standard',
    shortName: 'STD',
    description: 'E A D G — the universal 4-string bass tuning.',
    category: 'standard',
    stringCount: 4,
    midi: [28, 33, 38, 43],            // E1 A1 D2 G2
    stringNames: ['G', 'D', 'A', 'E'],
  },
  {
    id: 'drop-d',
    name: 'Drop D',
    shortName: 'Drop D',
    description: 'D A D G — low E dropped to D. Heavy riffs, easy octaves.',
    category: 'drop',
    stringCount: 4,
    midi: [26, 33, 38, 43],            // D1 A1 D2 G2
    stringNames: ['G', 'D', 'A', 'D'],
  },
  {
    id: '5-string',
    name: '5-String (Low B)',
    shortName: '5-str',
    description: 'B E A D G — adds a low B string. Modern and gospel staple.',
    category: '5-string',
    stringCount: 5,
    midi: [23, 28, 33, 38, 43],        // B0 E1 A1 D2 G2
    stringNames: ['G', 'D', 'A', 'E', 'B'],
  },

  // ── Fast-follow (1.x, data-only) ─────────────────────────────────────────
  // Defined now so the renderer/audio handle them; they can be gated or
  // de-listed by the UI without touching the engine.
  {
    id: 'eb-standard',
    name: 'Eb Standard',
    shortName: 'Eb',
    description: 'Eb Ab Db Gb — half-step down. Looser, darker tone.',
    category: 'down',
    stringCount: 4,
    midi: [27, 32, 37, 42],            // Eb1 Ab1 Db2 Gb2
    stringNames: ['Gb', 'Db', 'Ab', 'Eb'],
  },
  {
    id: 'drop-c',
    name: 'Drop C',
    shortName: 'Drop C',
    description: 'C G C F — whole-step down + drop. Modern metal.',
    category: 'drop',
    stringCount: 4,
    midi: [24, 31, 36, 41],            // C1 G1 C2 F2
    stringNames: ['F', 'C', 'G', 'C'],
  },
  {
    id: 'bead',
    name: 'BEAD',
    shortName: 'BEAD',
    description: 'B E A D — 4-string tuned low. The low B without a 5th string.',
    category: 'low',
    stringCount: 4,
    midi: [23, 28, 33, 38],            // B0 E1 A1 D2
    stringNames: ['D', 'A', 'E', 'B'],
  },
  {
    id: '5-string-drop-a',
    name: '5-String Drop A',
    shortName: '5 Drop A',
    description: 'A E A D G — 5-string with the low B dropped to A.',
    category: '5-string',
    stringCount: 5,
    midi: [21, 28, 33, 38, 43],        // A0 E1 A1 D2 G2
    stringNames: ['G', 'D', 'A', 'E', 'A'],
  },
  {
    id: '6-string',
    name: '6-String',
    shortName: '6-str',
    description: 'B E A D G C — low B and high C. Maximum range.',
    category: '6-string',
    stringCount: 6,
    midi: [23, 28, 33, 38, 43, 48],    // B0 E1 A1 D2 G2 C3
    stringNames: ['C', 'G', 'D', 'A', 'E', 'B'],
  },
];

const TUNINGS_BY_ID: Record<string, Tuning> = Object.fromEntries(
  TUNINGS.map(t => [t.id, t]),
);

export const STANDARD_TUNING = TUNINGS_BY_ID['standard'];

export function getTuning(id: string): Tuning {
  return TUNINGS_BY_ID[id] ?? STANDARD_TUNING;
}

// Note-classes (0-11) ordered high→low to match the Fretboard layout
// (row 0 = highest string on top). Derived from MIDI on demand.
export function tuningNoteClasses(t: Tuning): number[] {
  // midi is low→high; reverse to high→low and mod 12
  return [...t.midi].reverse().map(m => m % 12);
}

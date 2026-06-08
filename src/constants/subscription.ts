/**
 * Fretionary Bass — Subscription Gate Configuration
 *
 * FREE tier includes enough to demonstrate value.
 * PRO tier unlocks everything.
 */

// ── FREE SCALES ──────────────────────────────────────────────────────────────
export const FREE_SCALES = new Set([
  'Major',
  'Natural Minor',
  'Pentatonic Minor',
  'Blues',
]);

// ── FREE CHORDS ──────────────────────────────────────────────────────────────
// Triads are the free tier for the overlay/arpeggio (spec §10).
export const FREE_CHORDS = new Set([
  'Major',
  'Minor',
  'Diminished',
]);

// ── FREE TUNINGS ─────────────────────────────────────────────────────────────
export const FREE_TUNINGS = new Set([
  'standard', // 4-string E A D G
  'drop-d',
]);

export function isScaleFree(scaleKey: string): boolean {
  return FREE_SCALES.has(scaleKey);
}

export function isChordFree(chordKey: string): boolean {
  return FREE_CHORDS.has(chordKey);
}

export function isTuningFree(tuningId: string): boolean {
  return FREE_TUNINGS.has(tuningId);
}

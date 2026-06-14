/**
 * Deterministic "pick of the day" — the same calendar date always returns the
 * same pick, so every user on the same local day sees the same content.
 *
 * Rotation:
 *  - Alternates scale ↔ chord day-by-day (even day = scale, odd day = chord)
 *  - Root cycles through all 12 keys once per 12 days
 *  - Scale/chord index advances every other day
 *
 * Chords are drawn from the bass v1 set (OVERLAY_CHORDS) so the daily chord is
 * always something the overlay/arpeggio actually supports — no extensions.
 *
 * Same input → same output is the point: the card on the screen, the
 * notification body, and any "tomorrow's pick" surface all read from this
 * function and agree.
 */

import { NOTES, SCALES, CHORDS } from '../constants/music';
import { OVERLAY_CHORDS } from './overlay';

export interface DailyPick {
  type: 'scale' | 'chord';
  root: number;       // 0–11 pitch class
  rootName: string;   // 'C', 'D#', etc.
  itemKey: string;    // SCALES[itemKey] or CHORDS[itemKey]
  fullName: string;   // 'D Dorian' or 'G Minor 7'
  description: string;
}

const SCALE_KEYS = Object.keys(SCALES);
const CHORD_KEYS = OVERLAY_CHORDS.map(c => c.key);

/**
 * Days since the Unix epoch at local midnight. Using LOCAL time aligns the
 * daily rollover with the user's wall clock — a New Yorker and a Tokyoite
 * each get their own new pick at their own local midnight.
 */
function localDayNumber(d: Date): number {
  const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.floor(localMidnight / (24 * 60 * 60 * 1000));
}

/** Safe non-negative modulo for any integer. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function getDailyPick(date: Date = new Date()): DailyPick {
  const day = localDayNumber(date);
  const root = mod(day, 12);
  const rootName = NOTES[root];
  const useScale = mod(day, 2) === 0;
  const itemIndex = Math.floor(day / 2);

  if (useScale) {
    const key = SCALE_KEYS[mod(itemIndex, SCALE_KEYS.length)];
    return {
      type: 'scale',
      root,
      rootName,
      itemKey: key,
      fullName: `${rootName} ${key}`,
      description: SCALES[key].description,
    };
  }
  const key = CHORD_KEYS[mod(itemIndex, CHORD_KEYS.length)];
  return {
    type: 'chord',
    root,
    rootName,
    itemKey: key,
    fullName: `${rootName} ${key}`,
    description: CHORDS[key].description,
  };
}

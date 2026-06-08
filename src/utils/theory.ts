import { NOTES, OPEN_STRINGS, SCALES, CHORDS } from '../constants/music';

export function getScaleNotes(root: number, scaleKey: string): number[] {
  const sc = SCALES[scaleKey];
  if (!sc) return [root];
  const notes = [root];
  let cur = root;
  for (let i = 0; i < sc.steps.length - 1; i++) {
    cur = (cur + sc.steps[i]) % 12;
    notes.push(cur);
  }
  return notes;
}

export function getChordNotes(root: number, chordKey: string): number[] {
  const ch = CHORDS[chordKey];
  if (!ch) return [root];
  return ch.intervals.map(iv => (root + iv) % 12);
}

export function getScalePositions(
  root: number,
  scaleKey: string,
  noteClasses: readonly number[] = OPEN_STRINGS,
) {
  const notes = getScaleNotes(root, scaleKey);
  const strCount = noteClasses.length;
  const positions: { start: number; end: number }[] = [];
  for (let startFret = 0; startFret <= 15; startFret++) {
    let maxF = 0, minF = 99, count = 0;
    for (let s = 0; s < strCount; s++) {
      for (let f = startFret; f <= startFret + 4; f++) {
        const n = (noteClasses[s] + f) % 12;
        if (notes.includes(n)) {
          if (f > maxF) maxF = f;
          if (f < minF) minF = f;
          count++;
        }
      }
    }
    if (count >= 4 && maxF - startFret <= 4) {
      positions.push({ start: startFret, end: Math.min(startFret + 4, 22) });
    }
  }
  const merged: { start: number; end: number }[] = [];
  for (const p of positions) {
    if (!merged.length || p.start > merged[merged.length - 1].start + 2) {
      merged.push(p);
    }
  }
  return merged.slice(0, 5);
}

export function noteLabel(
  noteIdx: number,
  root: number,
  labelMode: string,
  scaleKey: string,
  chordKey: string,
  mode: string,
): string {
  if (labelMode === 'none') return '';
  if (labelMode === 'name') return NOTES[noteIdx];
  const intv = (noteIdx - root + 12) % 12;
  if (labelMode === 'interval') {
    const names = ['R','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7'];
    return names[intv];
  }
  if (labelMode === 'degree') {
    if (mode === 'chords') {
      const ch = CHORDS[chordKey];
      const pos = ch?.intervals.map(i => i % 12).indexOf(intv) ?? -1;
      return pos >= 0 ? ch.intervalNames[pos] : NOTES[noteIdx];
    }
    if (mode === 'custom') {
      // No scale/chord context — fall through to interval names
      const names = ['R','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7'];
      return names[intv];
    }
    const sc = SCALES[scaleKey];
    const scNotes = getScaleNotes(root, scaleKey);
    const pos = scNotes.indexOf(noteIdx);
    return pos >= 0 && sc ? sc.degrees[pos] : NOTES[noteIdx];
  }
  return NOTES[noteIdx];
}


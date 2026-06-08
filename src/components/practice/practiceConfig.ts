import type { PracticeDifficulty } from '../../constants/subscription';

export interface DifficultyConfig {
  maxFret: number;
  naturalsOnly: boolean;
  questions: number;
  timerSec: number | null;
  label: string;
  desc: string;
}

export const DIFFICULTY: Record<PracticeDifficulty, DifficultyConfig> = {
  beginner: {
    maxFret: 5,
    naturalsOnly: true,
    questions: 10,
    timerSec: null,
    label: 'Beginner',
    desc: 'Frets 0–5, naturals only',
  },
  intermediate: {
    maxFret: 12,
    naturalsOnly: false,
    questions: 15,
    timerSec: null,
    label: 'Intermediate',
    desc: 'Frets 0–12, all 12 notes',
  },
  advanced: {
    maxFret: 15,
    naturalsOnly: false,
    questions: 20,
    timerSec: 60,
    label: 'Advanced',
    desc: 'Full neck, 60s timer',
  },
};

export const NATURAL_NOTES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
export const ALL_NOTE_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface RoundResult {
  correct: number;
  total: number;
  elapsedMs: number;
}

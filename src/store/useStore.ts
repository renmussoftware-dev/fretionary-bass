import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_MIN_ACTIONS = 3;
const REVIEW_MIN_DAYS_INSTALLED = 2;
const REVIEW_MIN_DAYS_SINCE_LAST = 60;

/**
 * Threshold for the proactive paywall. When a non-Pro user has favorited
 * this many items (a genuine engagement signal), present the paywall once.
 * Reuses positiveActionCount — the same engagement counter that throttles the
 * App Store review prompt — because it correlates with users who've already
 * gotten value from the app and are likely to convert.
 */
export const PAYWALL_PROMPT_MIN_ACTIONS = 3;

// ── Streak helpers ──────────────────────────────────────────────────────────
// Date keys are local-time YYYY-MM-DD strings so day boundaries match the
// user's wall clock (a New Yorker and a Tokyoite both get credit at their
// own midnight, not UTC's). Compare strings == strings — no timezone math
// once you're in the YYYY-MM-DD format.

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export type AppMode = 'scales' | 'chords' | 'custom';
export type LabelMode = 'name' | 'degree' | 'interval' | 'none';

export type ScalePlaybackSpeed = 'slow' | 'normal' | 'fast';

// Per-step delay (ms) for scale playback. Slow lets students track each
// highlighted note; fast is for fluent practice.
export const SCALE_SPEED_MS: Record<ScalePlaybackSpeed, number> = {
  slow:   500,
  normal: 280,
  fast:   150,
};

// One step in a chord progression: an absolute root pitch class + chord key.
export type ProgressionChord = { root: number; chordKey: string };

export type SavedItem =
  | { kind: 'scale'; root: number; scaleKey: string; addedAt: number }
  | { kind: 'chord'; root: number; chordKey: string; addedAt: number };

// Distributive Omit so the discriminated union survives the omission of `addedAt`.
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type SavedItemInput = DistributiveOmit<SavedItem, 'addedAt'>;

const RECENTS_MAX = 20;

function itemKey(it: SavedItemInput): string {
  switch (it.kind) {
    case 'scale': return `s:${it.root}:${it.scaleKey}`;
    case 'chord': return `c:${it.root}:${it.chordKey}`;
  }
}

interface AppState {
  root: number;
  scaleKey: string;
  chordKey: string;
  mode: AppMode;
  labelMode: LabelMode;
  activePosition: number | null;
  showAllFrets: boolean;
  isPro: boolean;
  tuningId: string;
  customNotes: number[];

  // ── Chord-tone overlay (the hero) ──────────────────────────────────────────
  // overlayUnderlay: draw the suggested parent scale dimmed under the chord
  // tones. overlayFret: start fret of the 4-fret position window; null = whole
  // neck (no position lock).
  overlayUnderlay: boolean;
  overlayFret: number | null;
  setOverlayUnderlay: (v: boolean) => void;
  setOverlayFret: (f: number | null) => void;

  // ── Chord progression (feeds the overlay) ──────────────────────────────────
  // progression: the ordered chords. progressionIndex: which step is currently
  // "active" and driving the overlay (-1 = none / user has diverged manually).
  // selectProgressionStep sets root+chordKey together WITHOUT going through
  // setRoot/setChordKey, so it doesn't trip the manual-divergence reset below.
  progression: ProgressionChord[];
  progressionIndex: number;
  setProgression: (p: ProgressionChord[]) => void;
  addProgressionChord: (root: number, chordKey: string) => void;
  removeProgressionChord: (index: number) => void;
  clearProgression: () => void;
  selectProgressionStep: (index: number) => void;

  // ── Scale playback ─────────────────────────────────────────────────────────
  // playbackHighlight: pitch class (0–11) currently sounding, or null. The
  // Fretboard lights up every position matching it. scalePlaybackSpeed: the
  // per-note delay preset.
  playbackHighlight: number | null;
  setPlaybackHighlight: (pitchClass: number | null) => void;
  scalePlaybackSpeed: ScalePlaybackSpeed;
  setScalePlaybackSpeed: (speed: ScalePlaybackSpeed) => void;

  favorites: SavedItem[];
  recents: SavedItem[];

  // Review-prompt state — persisted, used to throttle the system rating dialog
  // so we only ask after the user has been actively engaged for a while.
  installedAt: number;          // ms epoch; 0 until first lazy init
  positiveActionCount: number;
  lastPromptedAt: number | null;
  recordPositiveAction: () => void;

  // Proactive paywall state — persisted, single-shot per install. Set when
  // the proactive paywall has been presented so we never present it twice.
  // The trigger lives in app/_layout.tsx; this just persists the flag.
  paywallPromptShownAt: number | null;
  markPaywallPromptShown: () => void;

  // Streak state — counts consecutive days of app activity. lastActivityDate
  // is a local-time YYYY-MM-DD string so we compare days, not timestamps
  // (a 7am open followed by an 11pm open on the same day is still one day).
  // Driven by recordActivity(), called from app/_layout.tsx on app launch.
  lastActivityDate: string | null;
  currentStreak: number;
  longestStreak: number;
  recordActivity: () => void;

  setRoot: (r: number) => void;
  setScaleKey: (k: string) => void;
  setChordKey: (k: string) => void;
  setMode: (m: AppMode) => void;
  setLabelMode: (l: LabelMode) => void;
  setActivePosition: (p: number | null) => void;
  setShowAllFrets: (v: boolean) => void;
  setIsPro: (v: boolean) => void;
  setTuningId: (id: string) => void;
  toggleCustomNote: (n: number) => void;
  clearCustomNotes: () => void;
  setCustomNotes: (notes: number[]) => void;

  toggleFavorite: (item: SavedItemInput) => void;
  isFavorite: (item: SavedItemInput) => boolean;
  addRecent: (item: SavedItemInput) => void;
  clearRecents: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      root: 0,
      scaleKey: 'Major',
      chordKey: 'Major',
      mode: 'scales',
      // Interval labels by default — what teaches the fretboard and what bass
      // references expect (spec §8).
      labelMode: 'interval',
      activePosition: null,
      showAllFrets: false,
      isPro: false,
      tuningId: 'standard',
      customNotes: [],

      overlayUnderlay: true,
      overlayFret: null,
      setOverlayUnderlay: (overlayUnderlay) => set({ overlayUnderlay }),
      setOverlayFret: (overlayFret) => set({ overlayFret }),

      progression: [],
      progressionIndex: -1,
      setProgression: (progression) => set({ progression, progressionIndex: -1 }),
      addProgressionChord: (root, chordKey) => {
        const next = [...get().progression, { root, chordKey }];
        // Highlight the freshly added chord (it already matches the overlay).
        set({ progression: next, progressionIndex: next.length - 1 });
      },
      removeProgressionChord: (index) => {
        const next = get().progression.filter((_, i) => i !== index);
        const idx = get().progressionIndex;
        set({
          progression: next,
          progressionIndex: idx >= next.length ? -1 : idx,
        });
      },
      clearProgression: () => set({ progression: [], progressionIndex: -1 }),
      selectProgressionStep: (index) => {
        const step = get().progression[index];
        if (!step) return;
        set({ root: step.root, chordKey: step.chordKey, progressionIndex: index });
      },

      playbackHighlight: null,
      scalePlaybackSpeed: 'normal',
      setPlaybackHighlight: (playbackHighlight) => set({ playbackHighlight }),
      setScalePlaybackSpeed: (scalePlaybackSpeed) => set({ scalePlaybackSpeed }),

      favorites: [],
      recents: [],
      installedAt: 0,
      positiveActionCount: 0,
      lastPromptedAt: null,
      paywallPromptShownAt: null,
      lastActivityDate: null,
      currentStreak: 0,
      longestStreak: 0,

      markPaywallPromptShown: () => set({ paywallPromptShownAt: Date.now() }),

      recordActivity: () => {
        const today = todayKey();
        const state = get();
        if (state.lastActivityDate === today) return; // already counted today
        // Carry the streak forward if yesterday was active; otherwise reset to 1.
        const newStreak = state.lastActivityDate === yesterdayKey()
          ? state.currentStreak + 1
          : 1;
        const newLongest = Math.max(state.longestStreak, newStreak);
        set({
          lastActivityDate: today,
          currentStreak: newStreak,
          longestStreak: newLongest,
        });
      },

      recordPositiveAction: () => {
        const now = Date.now();
        const state = get();
        const installedAt = state.installedAt || now;
        if (state.installedAt === 0) set({ installedAt: now });
        const nextCount = state.positiveActionCount + 1;
        set({ positiveActionCount: nextCount });

        // Throttle: enough actions, enough time installed, enough time since last
        const enoughActions = nextCount >= REVIEW_MIN_ACTIONS;
        const enoughInstalled = (now - installedAt) >= REVIEW_MIN_DAYS_INSTALLED * DAY_MS;
        const enoughSinceLast =
          state.lastPromptedAt === null ||
          (now - state.lastPromptedAt) >= REVIEW_MIN_DAYS_SINCE_LAST * DAY_MS;
        if (!enoughActions || !enoughInstalled || !enoughSinceLast) return;

        // iOS still throttles globally to 3 prompts/year — this is best-effort.
        StoreReview.isAvailableAsync()
          .then(available => {
            if (!available) return;
            return StoreReview.requestReview();
          })
          .catch(() => {})
          .finally(() => {
            set({ lastPromptedAt: now });
          });
      },

      // Manually changing the root or chord means the user has stepped off the
      // progression, so drop the active-step highlight.
      setRoot: (root) => set({ root, progressionIndex: -1 }),
      setScaleKey: (scaleKey) => set({ scaleKey, activePosition: null }),
      setChordKey: (chordKey) => set({ chordKey, progressionIndex: -1 }),
      setMode: (mode) => set({ mode, activePosition: null }),
      setLabelMode: (labelMode) => set({ labelMode }),
      setActivePosition: (activePosition) => set({ activePosition }),
      setShowAllFrets: (showAllFrets) => set({ showAllFrets }),
      setIsPro: (isPro) => set({ isPro }),
      setTuningId: (tuningId) => set({ tuningId }),

      toggleCustomNote: (n) => {
        const current = get().customNotes;
        const next = current.includes(n)
          ? current.filter(x => x !== n)
          : [...current, n].sort((a, b) => a - b);
        set({ customNotes: next });
      },
      clearCustomNotes: () => set({ customNotes: [] }),
      setCustomNotes: (customNotes) => set({ customNotes }),

      toggleFavorite: (item) => {
        const k = itemKey(item);
        const current = get().favorites;
        const exists = current.some(f => itemKey(f) === k);
        if (exists) {
          set({ favorites: current.filter(f => itemKey(f) !== k) });
        } else {
          set({ favorites: [{ ...item, addedAt: Date.now() } as SavedItem, ...current] });
          // Adding a favorite is a positive action. Un-hearting isn't.
          get().recordPositiveAction();
        }
      },

      isFavorite: (item) => {
        const k = itemKey(item);
        return get().favorites.some(f => itemKey(f) === k);
      },

      addRecent: (item) => {
        const k = itemKey(item);
        const filtered = get().recents.filter(r => itemKey(r) !== k);
        const next = [{ ...item, addedAt: Date.now() } as SavedItem, ...filtered].slice(0, RECENTS_MAX);
        set({ recents: next });
      },

      clearRecents: () => set({ recents: [] }),
    }),
    {
      name: 'fretionary-bass-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tuningId: s.tuningId,
        labelMode: s.labelMode,
        overlayUnderlay: s.overlayUnderlay,
        scalePlaybackSpeed: s.scalePlaybackSpeed,
        progression: s.progression,
        favorites: s.favorites,
        recents: s.recents,
        customNotes: s.customNotes,
        installedAt: s.installedAt,
        positiveActionCount: s.positiveActionCount,
        lastPromptedAt: s.lastPromptedAt,
        paywallPromptShownAt: s.paywallPromptShownAt,
        lastActivityDate: s.lastActivityDate,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
      }),
    },
  ),
);

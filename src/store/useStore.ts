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

export type AppMode = 'scales' | 'chords' | 'custom';
export type LabelMode = 'name' | 'degree' | 'interval' | 'none';

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

      favorites: [],
      recents: [],
      installedAt: 0,
      positiveActionCount: 0,
      lastPromptedAt: null,
      paywallPromptShownAt: null,

      markPaywallPromptShown: () => set({ paywallPromptShownAt: Date.now() }),

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

      setRoot: (root) => set({ root }),
      setScaleKey: (scaleKey) => set({ scaleKey, activePosition: null }),
      setChordKey: (chordKey) => set({ chordKey }),
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
        favorites: s.favorites,
        recents: s.recents,
        customNotes: s.customNotes,
        installedAt: s.installedAt,
        positiveActionCount: s.positiveActionCount,
        lastPromptedAt: s.lastPromptedAt,
        paywallPromptShownAt: s.paywallPromptShownAt,
      }),
    },
  ),
);

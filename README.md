# Fretionary Bass

A bass-guitar fretboard reference for iOS and Android. The hero is a **chord-tone overlay**: pick a chord and the notes that lock with it — root, 3rd, 5th, 7th — light up across the neck, on your bass, in your tuning.

**See exactly what to play over any chord — the strong notes, right where your hand is.**

A line extension of [Fretionary](https://fretionary.com) (guitar), built on the same engine. Expo (React Native) + TypeScript.

---

## Quick start

```bash
npm install
npx expo start --tunnel --clear
```

Scan the QR code with **Expo Go** on your phone (iOS or Android). Native modules
that Expo Go doesn't ship (Meta SDK) degrade to no-ops automatically, so the
overlay, fretboard, and audio all work in Expo Go — only the purchase flow and
ad attribution need a dev build.

### Run on a simulator

```bash
npx expo start --ios       # requires macOS + Xcode
npx expo start --android   # requires Android Studio
```

---

## The hero: chord-tone overlay

Bassists rarely look up chords — the recurring live job is *"I'm handed these
changes, which notes lock with this chord, and where do they sit under my
hand?"* So the landing screen answers exactly that:

- Pick a **root** and **chord**; the root / 3rd / 5th / 7th light up in distinct
  colors across the whole neck.
- The **suggested parent scale** sits dimmed underneath (toggle on/off).
- **Position lock** pins the overlay to a 4-fret window so you see what falls
  under your hand.
- **Tap any note to hear it** — real bass samples, pitch-shifted to the note.
- Labels switch between interval (`R 3 5 7`), note name, or off.

---

## Project structure

```
fretionary-bass/
├── app/                          # expo-router screens
│   ├── _layout.tsx               # Root layout (fonts, onboarding, ATT, paywall trigger)
│   ├── paywall.tsx               # Paywall route
│   └── (tabs)/
│       ├── _layout.tsx           # Bottom tab navigator (Overlay · Fretboard · Tools)
│       ├── index.tsx             # HERO — chord-tone overlay (landing screen)
│       ├── fretboard.tsx         # Reference neck: Scales / Arpeggio / Custom
│       └── tools.tsx             # Guide + Metronome
│
└── src/
    ├── constants/
    │   ├── tunings.ts            # Tunings as data (4/5/6-string), stringCount-driven
    │   ├── music.ts             # Scales, chords, interval/color constants
    │   ├── subscription.ts      # Free-tier gates (scales / chords / tunings)
    │   └── theme.ts             # Obsidian dark theme tokens
    │
    ├── store/
    │   └── useStore.ts          # Zustand global state (persisted via AsyncStorage)
    │
    ├── components/
    │   ├── OverlayFretboard.tsx # SVG overlay renderer (the hero)
    │   ├── Fretboard.tsx        # SVG reference fretboard (scales/arpeggio/custom)
    │   ├── TopBar.tsx           # Mode tabs + root + tuning + saved
    │   ├── TuningPicker.tsx     # Tuning sheet (string count follows tuning)
    │   ├── InfoPanel.tsx        # Notes / intervals / description strip
    │   ├── Onboarding.tsx       # First-launch tutorial
    │   ├── Guide.tsx            # In-app feature guide (Tools tab)
    │   ├── Metronome.tsx        # Drift-corrected metronome (Tools tab)
    │   ├── Paywall.tsx          # RevenueCat paywall UI
    │   ├── SavedSheet.tsx       # Favorites + recents
    │   └── PillSelector.tsx     # Reusable scrollable pill row
    │
    ├── hooks/
    │   ├── useAudioEngine.ts    # Nearest-sample pitch-shift bass playback
    │   ├── useRevenueCat.ts     # Purchases init / entitlement / restore
    │   └── useProGate.ts        # requirePro() gate helper
    │
    └── utils/
        ├── overlay.ts           # Chord-tone overlay engine (roles, scale suggestion)
        ├── theory.ts            # Scale/chord math, position detection, labels
        ├── analytics.ts         # Meta SDK funnel events (lazy, Expo-Go safe)
        └── nativeEnv.ts         # IS_EXPO_GO guard
```

---

## Features

### Overlay tab (hero)
- Root + chord pickers; root / 3rd / 5th / 7th color-coded across the neck
- Suggested parent scale dimmed underneath (toggle)
- 4-fret position lock; interval / note-name / off labels
- Tap-to-hear, in your selected tuning and string count

### Fretboard tab
- **Scales** — scales and modes mapped across the neck, color-coded by interval
- **Arpeggio** — chord tones of any v1 chord (triads, sus, 6ths, 7ths) on the neck
- **Custom** — hand-pick any set of notes to highlight

### Tunings
String count is **data**, not code — 4 / 5 / 6-string necks all render from the
same component.

| Tuning | Strings | Open notes (low→high) | Tier |
|---|---|---|---|
| 4-String Standard | 4 | E A D G | Free |
| Drop D | 4 | D A D G | Free |
| 5-String (Low B) | 5 | B E A D G | Pro |
| Eb Standard | 4 | Eb Ab Db Gb | Pro |
| Drop C | 4 | C G C F | Pro |
| BEAD | 4 | B E A D | Pro |
| 5-String Drop A | 5 | A E A D G | Pro |
| 6-String | 6 | B E A D G C | Pro |

### Tools tab
- **Guide** — feature reference and free/Pro breakdown
- **Metronome** — BPM 40–240, time signatures, accent/offbeat, tap-tempo (Pro)

### Saved
Tap the ♥ on the Fretboard tab to favorite a chord or scale; recents are
auto-tracked.

---

## Audio

`src/hooks/useAudioEngine.ts` plays real bass samples (Jay-Bass Vintage Lite V2,
`assets/audio/bass-<midi>.wav`, sampled every 3 semitones from C1 to D#4).
`playMidi` finds the nearest sampled note and transposes it via playback rate
(`shouldCorrectPitch: false`), so any note across the 4/5/6-string range is at
most ~1 semitone of shift from a real sample — clean, and the timbre moves
naturally like a fretted string.

---

## Music theory

- `src/constants/music.ts` — scales (step patterns, degrees, formulas) and chords
  (interval arrays, names, categories).
- `src/utils/overlay.ts` — the overlay engine: `getChordToneRoles` (pitch class →
  root/3rd/5th/7th), `suggestScaleForChord` (chord → parent scale), `buildOverlay`
  / `resolveRole` (cell role by priority: chord tone > scale tone > off), and the
  v1 `OVERLAY_CHORDS` set shared by the hero and the Arpeggio mode.
- `src/utils/theory.ts` — scale/chord note generation, position detection, labels.

All pure functions, testable without the UI.

---

## State management

Zustand store (`src/store/useStore.ts`), persisted to AsyncStorage:

| State | Type | Description |
|---|---|---|
| `root` | `number` | Root note index 0–11 |
| `tuningId` | `string` | Active tuning (drives string count) |
| `chordKey` | `string` | Key into CHORDS |
| `scaleKey` | `string` | Key into SCALES |
| `mode` | `AppMode` | `'scales' \| 'chords' \| 'custom'` |
| `labelMode` | `LabelMode` | `'name' \| 'degree' \| 'interval' \| 'none'` |
| `overlayUnderlay` | `boolean` | Show the dimmed parent scale under the overlay |
| `overlayFret` | `number \| null` | Position-lock start fret (null = whole neck) |
| `activePosition` | `number \| null` | Scale position index (Fretboard tab) |
| `customNotes` | `number[]` | Custom-mode highlighted pitch classes |
| `isPro` | `boolean` | Entitlement (synced from RevenueCat) |
| `favorites` / `recents` | `SavedItem[]` | Saved chords / scales |

---

## Monetization

Mirrors Fretionary (front-loaded lifetime over subscription). Free tier:
standard EADG + Drop D tunings, a starter set of scales, and triad chords. Pro:
all tunings, all scales/modes, all chords incl. 7ths, and custom mode. Gated by
a RevenueCat entitlement; funnel + purchase events flow to Meta via the SDK +
RevenueCat server-side mapping. Exact free/Pro splits live in
`src/constants/subscription.ts`.

> **Service IDs are placeholders.** Before shipping, provision a new RevenueCat
> project, Meta app/dataset, and EAS project, and replace the `PLACEHOLDER_*`
> values in `app.json`, `eas.json`, `src/hooks/useRevenueCat.ts`.

---

## Building for release

```bash
npm install -g eas-cli
eas login
eas build --platform ios      # iOS .ipa
eas build --platform android  # Android .aab
eas submit --platform ios
eas submit --platform android
```

---

## App store info

- **Bundle ID (iOS):** `com.renmussoftware.fretionarybass`
- **Package (Android):** `com.renmussoftware.fretionarybass`
- **Scheme:** `fretionarybass`
- **Slug:** `fretionary-bass`

---

## Roadmap

- [ ] Progression stepper — sequence chords in a key, overlay re-resolves per chord
- [ ] Expanded tuning list and per-tuning curated content
- [ ] Basic tuner (1.1)
- [ ] Lower-range bass samples / mp3 transcode to slim the bundle

---

## Dependencies

| Package | Purpose |
|---|---|
| `expo` ~54 | Runtime and SDK |
| `expo-router` | File-based navigation |
| `expo-av` | Audio playback (sampled bass) |
| `react-native-svg` | Fretboard rendering |
| `react-native-purchases` | RevenueCat in-app purchases |
| `react-native-fbsdk-next` | Meta SDK (ad attribution; lazy-loaded) |
| `react-native-reanimated` | Animation foundation |
| `react-native-gesture-handler` | Gesture support |
| `react-native-safe-area-context` | Safe-area insets |
| `zustand` | Global state management |
| `@expo/vector-icons` | Icons |

import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import { getTuning } from '../constants/tunings';

// ── Bass sample set (Jay-Bass Vintage Lite V2) ───────────────────────────────
// Real recorded samples every 3 semitones, scientific pitch notation
// (verified by FFT: C1 = MIDI 24, A2 = MIDI 45, …). Files are renamed to
// `bass-<midi>.wav`. Any target note is at most 1 semitone from a sample
// (except a few above the top sample), so pitch-shifting stays clean.
//
// Metro needs static requires, so the map is spelled out literally.
const SAMPLE_FILES: Record<number, any> = {
  24: require('../../assets/audio/bass-24.wav'), // C1
  27: require('../../assets/audio/bass-27.wav'), // D#1
  30: require('../../assets/audio/bass-30.wav'), // F#1
  33: require('../../assets/audio/bass-33.wav'), // A1
  36: require('../../assets/audio/bass-36.wav'), // C2
  39: require('../../assets/audio/bass-39.wav'), // D#2
  42: require('../../assets/audio/bass-42.wav'), // F#2
  45: require('../../assets/audio/bass-45.wav'), // A2
  48: require('../../assets/audio/bass-48.wav'), // C3
  51: require('../../assets/audio/bass-51.wav'), // D#3
  54: require('../../assets/audio/bass-54.wav'), // F#3
  57: require('../../assets/audio/bass-57.wav'), // A3
  60: require('../../assets/audio/bass-60.wav'), // C4
  63: require('../../assets/audio/bass-63.wav'), // D#4 (top sample)
};

// Sorted list of the MIDI notes we actually have a sample for.
const SAMPLE_MIDI = Object.keys(SAMPLE_FILES).map(Number).sort((a, b) => a - b);

/** Nearest sampled note to a target MIDI — minimizes the pitch-shift distance. */
function nearestSample(midi: number): number {
  return SAMPLE_MIDI.reduce((best, m) =>
    Math.abs(m - midi) < Math.abs(best - midi) ? m : best, SAMPLE_MIDI[0]);
}

/** Playback rate that shifts the base sample to the target pitch. */
function rateForShift(targetMidi: number, sampleMidi: number): number {
  return Math.pow(2, (targetMidi - sampleMidi) / 12);
}

/** MIDI for a fret on a render-row string (0 = highest string) of a tuning. */
export function rowFretToMidi(tuningId: string, rowString: number, fret: number): number {
  const open = [...getTuning(tuningId).midi].reverse(); // low→high → high→low rows
  return (open[rowString] ?? open[0]) + fret;
}

export function useAudioEngine() {
  const soundsRef = useRef<Record<number, Sound>>({});
  const scaleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeqSoundRef = useRef<Sound | null>(null);

  useEffect(() => {
    async function loadAll() {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      const loaded: Record<number, Sound> = {};
      const entries = Object.entries(SAMPLE_FILES);
      const BATCH_SIZE = 6;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ([midi, src]) => {
            try {
              const { sound } = await Audio.Sound.createAsync(
                src,
                { shouldPlay: false, volume: 1.0, shouldCorrectPitch: false },
              );
              loaded[Number(midi)] = sound;
            } catch {
              // skip a sample that fails to load
            }
          }),
        );
      }
      soundsRef.current = loaded;
    }
    loadAll();

    return () => {
      Object.values(soundsRef.current).forEach(s => s.unloadAsync());
      if (scaleTimerRef.current) clearTimeout(scaleTimerRef.current);
    };
  }, []);

  // Play any MIDI note by pitch-shifting the nearest recorded sample. With
  // shouldCorrectPitch=false the playback rate IS the transpose, so the timbre
  // shifts naturally like a real string fretted up or down.
  const playMidi = useCallback(async (midi: number) => {
    const base = nearestSample(midi);
    let sound = soundsRef.current[base];

    if (!sound && SAMPLE_FILES[base]) {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          SAMPLE_FILES[base], { shouldPlay: false, volume: 1.0, shouldCorrectPitch: false },
        );
        soundsRef.current[base] = s;
        sound = s;
      } catch {
        return;
      }
    }
    if (!sound) return;

    const rate = rateForShift(midi, base);
    try {
      await sound.setStatusAsync({
        positionMillis: 0,
        rate,
        shouldCorrectPitch: false,
        shouldPlay: true,
      });
    } catch {
      // ignore playback errors
    }
  }, []);

  /** Tap-to-play a fret on a render-row string of the active tuning. */
  const playFret = useCallback((tuningId: string, rowString: number, fret: number) => {
    return playMidi(rowFretToMidi(tuningId, rowString, fret));
  }, [playMidi]);

  // Monophonic note for sequenced playback: stop the previous note before the
  // next one sounds so a fast scale doesn't pile up into overlapping sustain
  // (bass samples ring for seconds — that mud is what we're avoiding here).
  const playMidiSeq = useCallback(async (midi: number) => {
    const base = nearestSample(midi);
    let sound = soundsRef.current[base];
    if (!sound && SAMPLE_FILES[base]) {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          SAMPLE_FILES[base], { shouldPlay: false, volume: 1.0, shouldCorrectPitch: false },
        );
        soundsRef.current[base] = s;
        sound = s;
      } catch {
        return;
      }
    }
    if (!sound) return;

    // Cut the previous note (skip if it's the same Sound — the retrigger
    // below already restarts it from the top).
    const prev = lastSeqSoundRef.current;
    if (prev && prev !== sound) prev.stopAsync().catch(() => {});
    lastSeqSoundRef.current = sound;

    const rate = rateForShift(midi, base);
    try {
      await sound.setStatusAsync({
        positionMillis: 0, rate, shouldCorrectPitch: false, shouldPlay: true,
      });
    } catch {
      // ignore playback errors
    }
  }, []);

  const stopScale = useCallback(() => {
    if (scaleTimerRef.current) {
      clearTimeout(scaleTimerRef.current);
      scaleTimerRef.current = null;
    }
    if (lastSeqSoundRef.current) {
      lastSeqSoundRef.current.stopAsync().catch(() => {});
      lastSeqSoundRef.current = null;
    }
  }, []);

  // Play a sequence of single MIDI notes (scale playback). onStep fires the
  // index of the note about to sound; onFinish fires after the last note.
  // Starting a new sequence cancels any running one.
  const playScale = useCallback((
    midiNotes: number[],
    msPerNote: number,
    onStep: (index: number) => void,
    onFinish: () => void,
  ) => {
    stopScale();
    let idx = 0;
    function step() {
      if (idx >= midiNotes.length) { onFinish(); return; }
      onStep(idx);
      playMidiSeq(midiNotes[idx]);
      idx++;
      scaleTimerRef.current = setTimeout(step, msPerNote);
    }
    step();
  }, [playMidiSeq, stopScale]);

  return { playMidi, playFret, playScale, stopScale };
}

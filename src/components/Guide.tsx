import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { useProGate } from '../hooks/useProGate';

interface FeatureRow {
  name: string;
  desc: string;
  badge?: 'free' | 'pro' | 'mixed';
}

interface Section {
  title: string;
  intro?: string;
  features: FeatureRow[];
  navTo?: string;
  navLabel?: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Chord-Tone Overlay',
    intro: 'The hero view — for playing over changes. Pick a root and chord and the strong notes — root, 3rd, 5th, 7th — light up across the neck, with the matching scale dimmed underneath as backup. Lock it to your hand position and tap any note to hear it.',
    navTo: '/',
    navLabel: 'Open Overlay',
    features: [
      { name: 'Chord tones, color-coded', desc: 'Root, 3rd, 5th and 7th in distinct colors so the notes that lock with the chord pop.', badge: 'free' },
      { name: 'Scale underlay',           desc: 'The suggested parent scale sits dimmed beneath the chord tones — toggle it on or off.', badge: 'free' },
      { name: 'Position lock',            desc: 'Pin the overlay to a 4-fret window to see exactly what falls under your hand.', badge: 'free' },
      { name: 'Note labels',              desc: 'Show intervals (R 3 5 7), note names, or hide labels.', badge: 'free' },
      { name: 'Sixths, 7ths & altered',   desc: 'Triads are free; 6ths, 7ths and altered qualities unlock with Pro.', badge: 'mixed' },
    ],
  },
  {
    title: 'Fretboard',
    intro: 'The plain reference neck. Where the Overlay answers “what do I play over this chord,” the Fretboard just maps a whole scale, a chord’s arpeggio, or your own notes across the neck — no scale underlay, no position lock. Color-coded by interval.',
    navTo: '/fretboard',
    navLabel: 'Open Fretboard',
    features: [
      { name: 'Scales mode', desc: 'A full scale or mode mapped across the neck, with auto-detected position boxes. Major, the modes, pentatonics, blues, harmonic/melodic minor.', badge: 'mixed' },
      { name: 'Arpeggio mode', desc: 'Just the chord tones of any chord across the entire neck — the bare arpeggio, with no parent scale behind it.', badge: 'mixed' },
      { name: 'Custom mode', desc: 'Hand-pick any set of notes to highlight on the neck.', badge: 'pro' },
      { name: 'Note labels', desc: 'Toggle between note name, scale degree, interval, or no label.', badge: 'free' },
    ],
  },
  {
    title: 'Tunings',
    intro: 'Pick your bass from the tuning picker — string count and every note on the neck follow it.',
    features: [
      { name: '4-String Standard', desc: 'E A D G — the universal bass tuning.', badge: 'free' },
      { name: 'Drop D',            desc: 'D A D G — low string dropped for heavier riffs.', badge: 'free' },
      { name: '5- & 6-string + more', desc: 'Low-B 5-string, 6-string, Eb, Drop C, BEAD, 5-string Drop A.', badge: 'pro' },
    ],
  },
  {
    title: 'Metronome',
    intro: 'Practice in time with a drift-corrected metronome on the Tools tab.',
    features: [
      { name: 'Metronome', desc: 'BPM 40–240, six time signatures, accent + offbeat clicks, tap-tempo.', badge: 'pro' },
    ],
  },
  {
    title: 'Saved',
    intro: 'Tap the heart on any chord or scale to save it. Recents are auto-tracked. Access via the ♥ button on the Fretboard tab.',
    features: [
      { name: 'Favorites', desc: 'Pin combos you keep coming back to.', badge: 'free' },
      { name: 'Recents',   desc: 'Last 20 chords / scales you selected.', badge: 'free' },
    ],
  },
];

function Badge({ kind }: { kind: 'free' | 'pro' | 'mixed' }) {
  if (kind === 'free') {
    return <View style={[styles.badge, styles.badgeFree]}><Text style={styles.badgeFreeText}>FREE</Text></View>;
  }
  if (kind === 'pro') {
    return <View style={[styles.badge, styles.badgePro]}><Text style={styles.badgeProText}>🔒 PRO</Text></View>;
  }
  return <View style={[styles.badge, styles.badgeMixed]}><Text style={styles.badgeMixedText}>FREE + PRO</Text></View>;
}

export default function Guide() {
  const { isPro } = useProGate();

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <Text style={styles.welcome}>Welcome to Fretionary Bass</Text>
        <Text style={styles.welcomeSub}>
          See what to play over any chord — the strong notes, right where your hand is, on your bass, in your tuning.
        </Text>
        {!isPro && (
          <View style={styles.proHint}>
            <Text style={styles.proHintText}>
              You{'\u2019'}re on the <Text style={{ fontWeight: '700' }}>Free</Text> plan. Items marked
              {' '}<Text style={{ color: '#E8D44D', fontWeight: '700' }}>🔒 PRO</Text>{' '}
              unlock with a subscription.
            </Text>
            <TouchableOpacity onPress={() => router.push('/paywall')} activeOpacity={0.85} style={styles.proCta}>
              <Text style={styles.proCtaText}>Unlock Pro →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {SECTIONS.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.intro && <Text style={styles.sectionIntro}>{section.intro}</Text>}

          {section.features.map(f => (
            <View key={f.name} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{f.name}</Text>
                {f.badge && <Badge kind={f.badge} />}
              </View>
              <Text style={styles.rowDesc}>{f.desc}</Text>
            </View>
          ))}

          {section.navTo && (
            <TouchableOpacity
              onPress={() => router.push(section.navTo as any)}
              activeOpacity={0.7}
              style={styles.navBtn}
            >
              <Text style={styles.navBtnText}>{section.navLabel} →</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.xl },

  intro: { marginBottom: SPACE.xl },
  welcome: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: COLORS.textMuted, lineHeight: 21 },

  proHint: {
    marginTop: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(83,74,183,0.10)',
    borderWidth: 1, borderColor: 'rgba(83,74,183,0.3)',
  },
  proHintText: { fontSize: 13, color: COLORS.text, lineHeight: 19, marginBottom: 8 },
  proCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  proCtaText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  section: {
    marginBottom: SPACE.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACE.lg,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sectionIntro: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: SPACE.md },

  row: {
    paddingVertical: SPACE.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  rowName: { fontSize: 13, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  rowDesc: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },

  badge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginLeft: 'auto',
  },
  badgeFree: { backgroundColor: 'rgba(29,158,117,0.18)', borderWidth: 1, borderColor: '#1D9E75' },
  badgeFreeText: { fontSize: 9, fontWeight: '800', color: '#1D9E75', letterSpacing: 0.4 },
  badgePro: { backgroundColor: 'rgba(232,212,77,0.15)', borderWidth: 1, borderColor: '#C4A800' },
  badgeProText: { fontSize: 9, fontWeight: '800', color: '#E8D44D', letterSpacing: 0.4 },
  badgeMixed: { backgroundColor: 'rgba(110,96,217,0.18)', borderWidth: 1, borderColor: '#6E60D9' },
  badgeMixedText: { fontSize: 9, fontWeight: '800', color: '#837AB7', letterSpacing: 0.4 },

  navBtn: {
    marginTop: SPACE.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
  },
  navBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.accent },
});

import React from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet,
} from 'react-native';
import { COLORS, RADIUS, SPACE, FONT_FAMILY } from '../constants/theme';

export type HelpTopic = 'fretboard' | 'overlay';

type Step = { heading: string; body: string };
type Content = { title: string; intro: string; steps: Step[]; tip: string };

// Plain-language, step-by-step help written for players who don't read music
// and may be new to apps — short sentences, no jargon, one idea per step.
const CONTENT: Record<HelpTopic, Content> = {
  fretboard: {
    title: 'How to use the Fretboard',
    intro:
      'This screen is a map of your bass neck. Each dot is a note you can play, and the colors show which notes belong together.',
    steps: [
      {
        heading: 'Pick Scales or Custom',
        body: 'Use the toggle near the top. Scales shows a ready-made set of notes; Custom lets you choose your own.',
      },
      {
        heading: 'Choose your key',
        body: 'Tap a root note (like C or G) in the row of note buttons. The whole neck updates to match.',
      },
      {
        heading: 'Pick a scale',
        body: 'In Scales, tap a scale name and every note in it lights up across the neck. Tap “Hear scale” to listen to it played low to high.',
      },
      {
        heading: 'Focus one position',
        body: 'The Position buttons zoom in on one hand shape at a time, so you’re not looking at the whole neck at once.',
      },
      {
        heading: 'Build your own (Custom)',
        body: 'In Custom, tap any fret on the neck — or the note buttons — to add or remove a note.',
      },
      {
        heading: 'Change the labels',
        body: 'The Label buttons switch the dots between note names, numbers, or no label at all.',
      },
    ],
    tip: 'Tip: tap any lit dot on the neck to hear that note.',
  },
  overlay: {
    title: 'How to use the Overlay',
    intro:
      'This screen tells you what to play over a chord — or a whole chord progression — so you can jam along or write a bass line.',
    steps: [
      {
        heading: 'Pick the chord',
        body: 'Choose a root note and a chord type (like C Major). This is the chord you’re playing over.',
      },
      {
        heading: 'Build a progression',
        body: 'Add chords to the Progression bar, or tap a preset like “I–IV–V”. Tap any chord to jump to it, or press Play to move through them while the neck follows along.',
      },
      {
        heading: 'Play the bright dots',
        body: 'The bright dots are the chord’s strongest notes: Root, 3rd, 5th, 7th. Land on these and you’ll always sound right.',
      },
      {
        heading: 'The faint dots are backup',
        body: 'The dimmed dots are the matching scale — extra notes that also fit. Turn them on or off with “Scale underlay”.',
      },
      {
        heading: 'Lock to your hand',
        body: 'The Position buttons narrow the view to a 4-fret area, so you only see what’s under your hand.',
      },
      {
        heading: 'Switch labels',
        body: 'Show interval numbers (R, 3, 5, 7), note names, or hide the labels.',
      },
    ],
    tip: 'Tip: tap any dot to hear how it sounds against the chord.',
  },
};

export default function HelpSheet({
  topic,
  visible,
  onClose,
}: {
  topic: HelpTopic;
  visible: boolean;
  onClose: () => void;
}) {
  const c = CONTENT[topic];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{c.title}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.close}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.intro}>{c.intro}</Text>

            {c.steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepHeading}>{s.heading}</Text>
                  <Text style={styles.stepBody}>{s.body}</Text>
                </View>
              </View>
            ))}

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>{c.tip}</Text>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgElevated,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '88%', paddingBottom: 30,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.text, letterSpacing: -0.2 },
  close: { fontSize: 14, color: COLORS.accent, fontWeight: '600', padding: 4 },

  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  intro: { fontSize: 14, color: COLORS.textMuted, lineHeight: 21, marginBottom: SPACE.lg },

  step: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.lg },
  num: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  numText: { fontSize: 13, fontWeight: '800', color: COLORS.text, fontFamily: FONT_FAMILY.mono },
  stepHeading: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  stepBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },

  tipBox: {
    marginTop: SPACE.xs,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(232,212,77,0.06)',
    borderWidth: 1, borderColor: 'rgba(232,212,77,0.28)',
  },
  tipText: { fontSize: 13, color: COLORS.text, lineHeight: 19, fontWeight: '500' },
});

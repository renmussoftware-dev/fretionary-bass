import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 54 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          // Solid bgElevated — translucent surface tokens bleed the system
          // tab bar's default white through on iOS.
          backgroundColor: COLORS.bgElevated,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* HERO — chord-tone overlay, the default landing screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overlay',
          tabBarIcon: ({ color }) => <OverlayIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="fretboard"
        options={{
          title: 'Fretboard',
          tabBarIcon: ({ color }) => <FretboardIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color }) => <ToolsIcon color={color} />,
        }}
      />

      {/* Parked for later milestones (port to bass): chords/arpeggios,
          progression stepper, practice drills. Hidden from the tab bar. */}
      <Tabs.Screen name="chords" options={{ href: null }} />
      <Tabs.Screen name="progressions" options={{ href: null }} />
      <Tabs.Screen name="practice" options={{ href: null }} />
    </Tabs>
  );
}

// Overlay icon: fretboard lines with a single lit chord-tone dot.
function OverlayIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 16, justifyContent: 'space-between' }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ height: 1.5, backgroundColor: color, borderRadius: 1, opacity: 0.6 }} />
      ))}
      <View style={{
        position: 'absolute', right: 4, top: 5,
        width: 6, height: 6, borderRadius: 3, backgroundColor: color,
      }} />
    </View>
  );
}

function FretboardIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 16, justifyContent: 'space-between' }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      ))}
    </View>
  );
}

function ToolsIcon({ color }: { color: string }) {
  // Tuning-fork silhouette: two prongs + a stem
  return (
    <View style={{ width: 16, height: 18, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={{ width: 2, height: 9, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 2, height: 9, backgroundColor: color, borderRadius: 1 }} />
      </View>
      <View style={{ width: 8, height: 2, backgroundColor: color, marginTop: -1, borderRadius: 1 }} />
      <View style={{ width: 2, height: 7, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: {},
});

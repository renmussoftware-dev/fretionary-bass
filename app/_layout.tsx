import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import Onboarding from '../src/components/Onboarding';
import { initAnalytics, maybePromptATT, logTutorialComplete } from '../src/utils/analytics';
import { useStore, PAYWALL_PROMPT_MIN_ACTIONS } from '../src/store/useStore';
import { maybeRequestPushPermission, scheduleStreakReminder } from '../src/utils/notifications';

const ONBOARDING_KEY = 'fretionary_bass_onboarded_v1';
// Small delay after onboarding wraps so the Stack navigator has time to
// mount before we router.push the paywall route. Also feels less abrupt
// than jamming the paywall in the same frame as the onboarding dismissal.
const FIRST_LAUNCH_PAYWALL_DELAY_MS = 800;

export default function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  // Reactive store reads — when isPro flips after RevenueCat loads, the
  // first-launch-paywall effect re-evaluates and bails. paywallPromptShownAt
  // drives the show-once trigger; positiveActionCount is still consumed by
  // the push-permission gate below (we don't want to bombard fresh users
  // with system prompts on first launch).
  const isPro = useStore(s => s.isPro);
  const positiveActionCount = useStore(s => s.positiveActionCount);
  const paywallPromptShownAt = useStore(s => s.paywallPromptShownAt);
  const markPaywallPromptShown = useStore(s => s.markPaywallPromptShown);

  // Streak + notification state
  const currentStreak = useStore(s => s.currentStreak);
  const recordActivity = useStore(s => s.recordActivity);

  const [fontsLoaded] = useFonts({
    // Map all four weights to a single family alias matching FONT_FAMILY.mono
    // in theme.ts. RN picks the right weight via the `fontWeight` style.
    JetBrainsMono: JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    // Set audio mode at app root so it's active before any tab loads
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});

    // Initialize Meta SDK (syncs advertiser-tracking with current ATT status —
    // does NOT prompt). Safe to call before ATT decision; we re-sync after.
    initAnalytics();

    // Check if onboarding has been completed
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setShowOnboarding(val === null);
    }).catch(() => setShowOnboarding(false));
  }, []);

  // For existing users who already completed onboarding before the SDK
  // shipped, prompt ATT on first launch of the new app version. New users
  // hit this same code path via finishOnboarding(). maybePromptATT is
  // single-flight + idempotent so calling it from both places is safe.
  useEffect(() => {
    if (showOnboarding === false) {
      maybePromptATT();
    }
  }, [showOnboarding]);

  // Record a streak activity for today as soon as we're past onboarding. Any
  // app open counts — we're trying to build a habit, not gate behind a
  // specific action. recordActivity is a no-op on subsequent opens the same
  // calendar day, so this is safe to call freely.
  useEffect(() => {
    if (showOnboarding === false) recordActivity();
  }, [showOnboarding, recordActivity]);

  // Push permission ask — gated on the same engagement signal as the proactive
  // paywall (3 favorites). Single-shot via AsyncStorage flag inside the util,
  // so this useEffect can fire freely. After permission resolves (granted or
  // denied), we don't ask again.
  useEffect(() => {
    if (showOnboarding !== false) return;
    if (positiveActionCount < PAYWALL_PROMPT_MIN_ACTIONS) return;
    maybeRequestPushPermission();
  }, [showOnboarding, positiveActionCount]);

  // Streak reminder scheduling — every time we know the streak count (and
  // therefore have permission), schedule a fresh local notification for
  // tomorrow at 6pm. The util cancels any stale scheduled reminder before
  // scheduling the new one, so opening the app multiple times in a day
  // doesn't double-fire. Silently no-ops if permission isn't granted yet.
  useEffect(() => {
    if (showOnboarding !== false) return;
    if (currentStreak < 1) return;
    scheduleStreakReminder(currentStreak);
  }, [showOnboarding, currentStreak]);

  // First-launch paywall — surface the Pro offer once, immediately after
  // onboarding wraps up. Free-tier users who never trip a Pro gate otherwise
  // never see the paywall at all, which was a major leak in the
  // install→purchase funnel. Single-shot, persisted via paywallPromptShownAt
  // so a user who declines never gets re-prompted (they'll still hit the
  // paywall the normal way if they tap a Pro-gated feature).
  //
  // Effect re-runs when showOnboarding / isPro / paywallPromptShownAt change.
  // The delay gives the Stack a beat to mount after showOnboarding flips to
  // false so router.push has a target. If RevenueCat resolves isPro=true
  // mid-delay (existing subscriber restore during init), the cleanup cancels
  // the pending push.
  useEffect(() => {
    if (showOnboarding !== false) return;
    if (isPro) return;
    if (paywallPromptShownAt !== null) return;

    const t = setTimeout(() => {
      markPaywallPromptShown();
      router.push('/paywall');
    }, FIRST_LAUNCH_PAYWALL_DELAY_MS);
    return () => clearTimeout(t);
  }, [showOnboarding, isPro, paywallPromptShownAt, markPaywallPromptShown]);

  async function finishOnboarding() {
    // Prompt ATT now — user has just seen the value, this is the natural
    // moment per Apple's guidance. Then log the tutorial-completion funnel
    // event before transitioning to the main app.
    await maybePromptATT();
    logTutorialComplete();
    await AsyncStorage.setItem(ONBOARDING_KEY, 'done').catch(() => {});
    setShowOnboarding(false);
  }

  // Wait until we know whether to show onboarding AND fonts have loaded
  if (showOnboarding === null || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      {showOnboarding ? (
        <Onboarding onDone={finishOnboarding} />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="paywall"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

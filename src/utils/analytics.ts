/**
 * Meta (Facebook) SDK wrapper for ad-campaign attribution.
 *
 * Responsibilities:
 *  - Initialize the Facebook SDK (auto-init is on in app.json, this just
 *    syncs advertiser-tracking with the ATT result).
 *  - Single-flight ATT (App Tracking Transparency) prompt — show it once
 *    per install, persisted in AsyncStorage so it survives app launches.
 *  - Wrap the standard funnel events (tutorial complete, paywall view,
 *    initiate checkout) so callers don't import the SDK directly.
 *
 * Event source-of-truth split:
 *  - Purchase-related events (Subscribe, Renewal, Cancellation, Purchase)
 *    flow to Meta from RevenueCat server-side. Do NOT fire them here as
 *    well — that would double-count.
 *  - Funnel events (tutorial completion, paywall view, initiate checkout)
 *    are client-only and live here.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { IS_EXPO_GO } from './nativeEnv';

// The Meta SDK is a custom native module, absent in Expo Go. Lazy-require it so
// importing this file never crashes the Expo Go sandbox; every helper below
// no-ops when the SDK isn't available (Expo Go or load failure).
type FbsdkModule = typeof import('react-native-fbsdk-next');
let _fbsdk: FbsdkModule | null | undefined;
function getFbsdk(): FbsdkModule | null {
  if (_fbsdk !== undefined) return _fbsdk;
  let mod: FbsdkModule | null = null;
  if (!IS_EXPO_GO) {
    try { mod = require('react-native-fbsdk-next'); }
    catch { mod = null; }
  }
  _fbsdk = mod;
  return mod;
}

const ATT_PROMPTED_KEY = 'fretionary_bass_att_prompted_v1';

let initialized = false;
let attRequestInFlight: Promise<void> | null = null;

/**
 * Initialize the Facebook SDK and sync advertiser-tracking flag with the
 * user's current ATT status. Safe to call multiple times — only runs once.
 *
 * The SDK has `isAutoInitEnabled: true` in app.json so it has already
 * initialized itself by the time JS runs. We just need to tell it the
 * advertiser-tracking status before it sends any events.
 */
export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const fb = getFbsdk();
  if (!fb) return; // Expo Go / SDK unavailable — nothing to sync.
  try {
    // iOS: set advertiser tracking based on current ATT status (whatever it
    // is — we haven't necessarily prompted yet). The SDK will respect this.
    // Android: setAdvertiserTrackingEnabled is a no-op but safe to call.
    if (Platform.OS === 'ios') {
      const { status } = await getTrackingPermissionsAsync();
      await fb.Settings.setAdvertiserTrackingEnabled(status === 'granted');
    } else {
      await fb.Settings.setAdvertiserTrackingEnabled(true);
    }
  } catch (e) {
    if (__DEV__) console.warn('[analytics] init error:', e);
  }
}

/**
 * Prompt the user for App Tracking Transparency permission, once per install.
 * Persists a flag in AsyncStorage so we never prompt twice. Should be called
 * at a natural "you've experienced value" moment (end of onboarding for new
 * users; first launch of this app version for existing users).
 *
 * After the user responds, syncs the result back to the Facebook SDK via
 * Settings.setAdvertiserTrackingEnabled. On Android this is a no-op.
 */
export async function maybePromptATT(): Promise<void> {
  // Single-flight — if a concurrent caller is already prompting, just await
  // the same promise instead of stacking system dialogs.
  if (attRequestInFlight) return attRequestInFlight;

  attRequestInFlight = (async () => {
    try {
      const prompted = await AsyncStorage.getItem(ATT_PROMPTED_KEY);
      if (prompted) return;

      // ATT only exists on iOS 14.5+. expo-tracking-transparency returns
      // 'unavailable' status on Android and older iOS, in which case there's
      // nothing to do — Settings.setAdvertiserTrackingEnabled was already
      // set during initAnalytics.
      const fb = getFbsdk();
      const { status, canAskAgain } = await getTrackingPermissionsAsync();
      if (status === 'undetermined' && canAskAgain) {
        const result = await requestTrackingPermissionsAsync();
        if (Platform.OS === 'ios' && fb) {
          await fb.Settings.setAdvertiserTrackingEnabled(result.status === 'granted');
        }
      } else if (Platform.OS === 'ios' && fb) {
        // Status already settled in some prior session — sync the SDK to it.
        await fb.Settings.setAdvertiserTrackingEnabled(status === 'granted');
      }

      await AsyncStorage.setItem(ATT_PROMPTED_KEY, '1');
    } catch (e) {
      if (__DEV__) console.warn('[analytics] ATT prompt error:', e);
    } finally {
      attRequestInFlight = null;
    }
  })();

  return attRequestInFlight;
}

/**
 * Hand the Facebook SDK's stable per-install anonymous ID to RevenueCat so
 * the server-side subscription events RevenueCat forwards to Meta can be
 * attributed to the same install as the SDK-side funnel events.
 *
 * Why this matters: without it, Meta has to match SDK events and RevenueCat
 * events using only the IDFA — which is missing for the ~50% of users who
 * deny ATT. The FB Anonymous ID is always present (generated by the SDK on
 * first launch, independent of ATT), so passing it through dramatically
 * improves match rate for ATT-denied users.
 *
 * Idempotent — safe to call on every app launch. RevenueCat must be
 * configured before this is called or setFBAnonymousID is a no-op.
 */
export async function linkFacebookAnonymousIDToRevenueCat(): Promise<void> {
  const fb = getFbsdk();
  if (!fb) return; // No Meta SDK (Expo Go) — no anon ID to link.
  try {
    const anonId = await fb.AppEventsLogger.getAnonymousID();
    if (anonId) {
      await Purchases.setFBAnonymousID(anonId);
    }
  } catch (e) {
    if (__DEV__) console.warn('[analytics] FB anon ID link error:', e);
  }
}

// ── Event helpers ────────────────────────────────────────────────────────────
// All wrap AppEventsLogger.logEvent so callers stay decoupled from the SDK
// and so we have one place to gate, mute, or rename events later.

export function logTutorialComplete(): void {
  const fb = getFbsdk();
  if (!fb) return;
  try {
    fb.AppEventsLogger.logEvent(fb.AppEventsLogger.AppEvents.CompletedTutorial);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] logTutorialComplete error:', e);
  }
}

/** Fires when the paywall mounts — Meta uses this for retargeting. */
export function logPaywallView(): void {
  const fb = getFbsdk();
  if (!fb) return;
  try {
    fb.AppEventsLogger.logEvent(fb.AppEventsLogger.AppEvents.ViewedContent, {
      [fb.AppEventsLogger.AppEventParams.ContentType]: 'paywall',
      [fb.AppEventsLogger.AppEventParams.ContentID]: 'fretionary_bass_pro_paywall',
    });
  } catch (e) {
    if (__DEV__) console.warn('[analytics] logPaywallView error:', e);
  }
}

/**
 * Fires when the user taps the paywall CTA — before the StoreKit/Play sheet
 * appears. Pairs with the server-side Subscribe/Purchase events that
 * RevenueCat sends after the purchase completes, giving Meta the full funnel
 * (paywall view → checkout intent → conversion).
 */
export function logInitiateCheckout(params: {
  productId: string;
  price: number;
  currency: string;
  packageType: string;
}): void {
  const fb = getFbsdk();
  if (!fb) return;
  try {
    fb.AppEventsLogger.logEvent(
      fb.AppEventsLogger.AppEvents.InitiatedCheckout,
      params.price,
      {
        [fb.AppEventsLogger.AppEventParams.ContentID]: params.productId,
        [fb.AppEventsLogger.AppEventParams.ContentType]: params.packageType,
        [fb.AppEventsLogger.AppEventParams.Currency]: params.currency,
      },
    );
  } catch (e) {
    if (__DEV__) console.warn('[analytics] logInitiateCheckout error:', e);
  }
}

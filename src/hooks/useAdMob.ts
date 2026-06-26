import { useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────
export interface RewardedAdReward {
  amount: string;
  label?: string;
}

export interface AdMobState {
  initialized: boolean;
  isInterstitialReady: boolean;
  isRewardedReady: boolean;
  lastReward: RewardedAdReward | null;
  rewardedLoading: boolean;
  interstitialLoading: boolean;
}

// ─── AdMobInit component (no-op — ads deactivated) ────────────────
export function AdMobInit() {
  return null;
}

// ─── No-op hook (ads deactivated) ──────────────────────────────────
export function useAdMob() {
  const noop = useCallback(async () => {}, []);
  const noopBool = useCallback(async (): Promise<boolean> => false, []);

  return {
    initialized: false,
    isInterstitialReady: false,
    isRewardedReady: false,
    lastReward: null,
    rewardedLoading: false,
    interstitialLoading: false,
    prepareInterstitial: noop,
    showInterstitial: noop,
    prepareRewarded: noop,
    showRewarded: noop,
    watchPartyBoostReward: noopBool,
  };
}

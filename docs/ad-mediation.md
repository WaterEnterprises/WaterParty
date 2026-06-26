# Ad Mediation Setup

Ad mediation lets multiple ad networks compete for each impression via the AdMob SDK.
The `@capacitor-community/admob` plugin wraps Google Mobile Ads SDK which supports mediation out of the box — no JavaScript code changes needed.

---

## ✅ Already Done

- **Android**: Mediation adapter dependencies added to `android/app/build.gradle`
  - Meta Audience Network (`com.google.ads.mediation:facebook:6.18.0.0`)
  - AppLovin (`com.google.ads.mediation:applovin:13.1.0.1`)
  - Unity Ads (`com.google.ads.mediation:unity:4.13.1.0`)
  - Liftoff/Vungle (`com.google.ads.mediation:vungle:7.4.4.0`)
- **Ad unit config**: Env vars `ADMOB_*` in `.env.example`

---

## iOS Setup

The iOS project uses **Swift Package Manager (SPM)**. Mediation adapters are distributed as **CocoaPods** or **XCFrameworks**. Choose one option:

### Option A: CocoaPods (Recommended)

1. Create `ios/App/Podfile`:
```ruby
platform :ios, '15.0'

target 'App' do
  # Capacitor (from SPM)
  pod 'Capacitor', :path => '../../node_modules/@capacitor/ios'

  # AdMob Mediation adapters
  pod 'GoogleMobileAdsMediationFacebook'    # Meta Audience Network
  pod 'GoogleMobileAdsMediationAppLovin'    # AppLovin
  pod 'GoogleMobileAdsMediationUnity'       # Unity Ads
  pod 'GoogleMobileAdsMediationVungle'      # Liftoff/Vungle
end
```

2. Install pods:
```bash
cd ios/App
pod install
```

3. Open `App.xcworkspace` (not `.xcodeproj`) in Xcode and build.

### Option B: Manual XCFrameworks

Download each adapter from Google's [Mediation iOS docs](https://developers.google.com/admob/ios/mediation) and drag the `.xcframework` files into Xcode under your project's "Frameworks, Libraries, and Embedded Content".

---

## AdMob Dashboard Configuration

Mediation is configured in the **AdMob web UI**, not in code:

1. **Log in** → https://apps.admob.com
2. **Mediation** → "Create Mediation Group"
3. **Settings**:
   - Ad format: Interstitial / Rewarded
   - Platform: Android / iOS
   - Ad units: Select your ad units
4. **Add ad sources**:
   - **Bidding** (preferred): Add Meta, AppLovin, Unity, Vungle
   - **Waterfall** (fallback): Set eCPM floors
5. **Map ad unit IDs** from each network's dashboard to the AdMob ad unit

---

## Verification

To verify mediation is working:

1. Build the app on a real device (mediation doesn't work on simulators/emulators)
2. Trigger an ad (swipe 5 times for interstitial, or tap "Boost Visibility" on Create Party)
3. Check the AdMob dashboard → Mediation → Reports for which network filled each impression
4. Check Android Logcat: `adb logcat -s Ads`

---

## Notes

- **Meta Audience Network** requires Meta approval — your app must comply with their policies and have a minimum user base
- **iOS App Tracking Transparency**: Required for most mediation networks. Already configured in `Info.plist` via `@capacitor-community/admob` initialization
- **Test ads**: Mediation networks only serve live ads on real devices. Use test ad unit IDs from Google for development

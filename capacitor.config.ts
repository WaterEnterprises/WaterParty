import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waterparty.app',
  appName: 'WaterParty',
  webDir: 'dist',
server: {
     // Allow cleartext (HTTP) during development on Android
     androidScheme: 'http',
     iosScheme: 'http',
     cleartext: true,
     // Production builds use bundled assets; dev builds override via run-android-dev.sh
    // url: 'http://localhost:3000',
   },
  android: {
    // Allow navigation to any URL (required for Stripe Connect onboarding)
    allowMixedContent: true,
    captureInput: true,
    adjustMarginsForEdgeToEdge: "force",
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#090A10',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090A10',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    Haptics: {
      notificationDuration: 'SHORT',
    },
    PushNotifications: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;

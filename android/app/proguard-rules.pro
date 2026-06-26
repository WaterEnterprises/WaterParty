# ============================================
# WaterParty - ProGuard / R8 Rules
# ============================================

# --- Keep Capacitor Bridge ---
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod *;
}

# --- Keep Capacitor Cordova plugins ---
-keep class org.apache.cordova.** { *; }

# --- Keep the Main Activity ---
-keep class com.waterparty.app.MainActivity { *; }

# --- Keep JavaScript Interface classes (WebView bridge) ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Keep WebView debugging & crash reporting ---
-keepattributes JavascriptInterface
-keepattributes *Annotation*

# --- Keep R8 from stripping resources used by Capacitor splash/icons ---
-keep class **.R$drawable { *; }
-keep class **.R$mipmap { *; }
-keep class **.R$raw { *; }
-keep class **.R$string { *; }

# --- Keep Gson / serialization (if used by plugins) ---
-keepattributes Signature
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# --- Keep file names & line numbers for crash stack traces ---
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Keep enum classes ---
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# --- Keep all classes in the app package (for reflection) ---
-keep class com.waterparty.app.** { *; }

# --- Keep Capacitor Android plugins ---
-keep class com.getcapacitor.community.** { *; }
-keep class com.capacitorjs.** { *; }

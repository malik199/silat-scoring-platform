// Real credentials from the legacy project — used only to satisfy the
// Firebase iOS/Android SDK initialisation requirements.
// All network traffic is redirected to the local emulator suite at runtime
// via useAuthEmulator() and useFirestoreEmulator() in main.dart.
// No data is read from or written to the real Firebase project.
// ignore_for_file: lines_longer_than_80_chars
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Web is not supported by this app.');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Unsupported platform.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAjjtwzyM86hMHdw1U9xvRlQvrowAahmS0',
    appId: '1:191446392057:android:9b727e33e70b052c90d628',
    messagingSenderId: '191446392057',
    projectId: 'tanding-scoring',
    storageBucket: 'tanding-scoring.appspot.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDdBA92pto3vqu3sgN2JB8qfiqkVVZlJPc',
    appId: '1:191446392057:ios:f659bb2994e8814b90d628',
    messagingSenderId: '191446392057',
    projectId: 'tanding-scoring',
    storageBucket: 'tanding-scoring.appspot.com',
    iosClientId: '191446392057-sdv2it9phkpch00b7a2p7jrvt0avnfek.apps.googleusercontent.com',
    iosBundleId: 'com.visdevelop.silatscore',
  );
}

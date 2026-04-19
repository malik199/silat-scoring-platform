/// Pass --dart-define=USE_EMULATOR=true when running locally.
/// Production builds leave this unset → connects to real Firebase.
const useEmulator = bool.fromEnvironment('USE_EMULATOR', defaultValue: false);

/// Override the emulator host if needed (e.g. for a physical device on the
/// same network, set --dart-define=EMULATOR_HOST=192.168.1.x).
const emulatorHost = String.fromEnvironment('EMULATOR_HOST', defaultValue: 'localhost');

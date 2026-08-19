#!/usr/bin/env bash
set -e

NOTES="${1:-Release}"
APP_ID="1:191446392057:android:9b727e33e70b052c90d628"
TESTERS="silat.virginia@gmail.com"
APK="build/app/outputs/flutter-apk/app-release.apk"

echo "Building APK..."
flutter build apk --release

echo "Distributing to $TESTERS..."
firebase appdistribution:distribute "$APK" \
  --app "$APP_ID" \
  --testers "$TESTERS" \
  --release-notes "$NOTES"

echo "Done."

#!/usr/bin/env bash
# Builds a release APK and uploads it to Firebase App Distribution.
# Usage:
#   ./distribute-android.sh                        # no release notes
#   ./distribute-android.sh "Fixed timer sync"     # with release notes

set -e

NOTES="${1:-}"
APP_ID="1:191446392057:android:9b727e33e70b052c90d628"
PROJECT="tanding-scoring"

echo "▶ Building release APK..."
cd apps/flutter_judge_app
flutter build apk --release
cd ../..

APK="apps/flutter_judge_app/build/app/outputs/flutter-apk/app-release.apk"

echo "▶ Uploading to Firebase App Distribution..."
firebase appdistribution:distribute "$APK" \
  --app "$APP_ID" \
  --project "$PROJECT" \
  --groups "judges" \
  ${NOTES:+--release-notes "$NOTES"}

echo "✓ Done. Testers in the 'judges' group will receive an email."

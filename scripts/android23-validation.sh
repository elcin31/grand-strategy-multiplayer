#!/usr/bin/env bash
set -euo pipefail
adb push CameraGesture.jar /data/local/tmp/dominion-camera.jar
adb push CameraGesture23.jar /data/local/tmp/dominion-camera23.jar
if [ "${GAMEPLAY_ONLY:-false}" = true ]; then
  python scripts/android23-gameplay-smoke.py Dominion-2.3-performance-candidate.apk gameplay23-fixture
elif [ "${FULL_MATRIX_ONLY:-false}" = true ]; then
  CAMERA23_OUT=profile-baseline python scripts/android23-profile.py baseline-apk/Dominion-2.2.1-performance-hotfix.apk camera23-monthly-fixture
  CAMERA23_OUT=profile-candidate python scripts/android23-profile.py Dominion-2.3-performance-candidate.apk camera23-monthly-fixture
elif [ "${LOD_ONLY:-false}" = true ]; then
  CAMERA23_LOD_ONLY=1 CAMERA23_OUT=lod-baseline python scripts/android23-profile.py baseline-apk/Dominion-2.2.1-performance-hotfix.apk camera23-monthly-fixture
  CAMERA23_LOD_ONLY=1 CAMERA23_OUT=lod-candidate python scripts/android23-profile.py Dominion-2.3-performance-candidate.apk camera23-monthly-fixture
else
  python scripts/android221-smoke.py baseline-apk/Dominion-2.2.1-performance-hotfix.apk Dominion-2.3-performance-candidate.apk
  adb uninstall com.elcin31.grandstrategymultiplayer
  CAMERA23_MONTHLY_ONLY=1 CAMERA23_OUT=monthly-baseline python scripts/android23-profile.py baseline-apk/Dominion-2.2.1-performance-hotfix.apk camera23-monthly-fixture
  CAMERA23_MONTHLY_ONLY=1 CAMERA23_OUT=monthly-candidate python scripts/android23-profile.py Dominion-2.3-performance-candidate.apk camera23-monthly-fixture
fi

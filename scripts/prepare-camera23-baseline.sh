#!/usr/bin/env bash
# Download a known accepted binary and generate schema25 workloads from its
# immutable source. Never feed a newer campaign schema to an older APK.
set -euo pipefail
baseline_run=${1:-}
mkdir -p baseline-apk
if [ -n "$baseline_run" ]; then
  test "$baseline_run" = 38575813534
  test "$(gh api "repos/elcin31/grand-strategy-multiplayer/actions/runs/$baseline_run" --jq .head_sha)" = 9c519a8ddf86fa106ec0ca3d6e080086c6c744d9
  test "$(gh api "repos/elcin31/grand-strategy-multiplayer/actions/runs/$baseline_run/jobs" --jq '.jobs[]|select(.name=="build-candidate")|.conclusion')" = success
  gh run download "$baseline_run" -R elcin31/grand-strategy-multiplayer -n dominion23-performance-candidate -D baseline-apk
  mv baseline-apk/Dominion-2.3-performance-candidate.apk baseline-apk/Dominion-2.2.1-performance-hotfix.apk
  echo '7df9e78cdf9c5293cdb8a0bf72363c96de5e85586c9096b16393cddf25986764  baseline-apk/Dominion-2.2.1-performance-hotfix.apk' | sha256sum --check
else
  gh release download v2.2.1-performance-hotfix -R elcin31/grand-strategy-multiplayer -D baseline-apk -p Dominion-2.2.1-performance-hotfix.apk
  echo 'a44c54b3fcbe31dd7c23d5fea13782244436a6e47a7fa3ddf50be1204e846cbb  baseline-apk/Dominion-2.2.1-performance-hotfix.apk' | sha256sum --check
fi
fixture_source=$(mktemp -d /tmp/dominion-camera-source-XXXXXX)
root=$(pwd)
git worktree add --detach "$fixture_source" 9c519a8ddf86fa106ec0ca3d6e080086c6c744d9
trap 'git worktree remove --force "$fixture_source"' EXIT
ln -s "$root/node_modules" "$fixture_source/node_modules"
node --import "$root/node_modules/tsx/dist/loader.mjs" "$fixture_source/scripts/make-camera23-fixture.ts" "${2:-camera23-fixture}" --monthly
if [ "${3:-}" = stress ]; then
  cp "$root/scripts/make-camera23-stress.ts" "$fixture_source/scripts/make-camera23-stress.ts"
  node --import "$root/node_modules/tsx/dist/loader.mjs" "$fixture_source/scripts/make-camera23-stress.ts" "${2:-camera23-fixture}"
fi

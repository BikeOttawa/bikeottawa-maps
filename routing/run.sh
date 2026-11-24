#!/usr/bin/env bash
# Runs the local router on port 17777, reading the region's profiles as they
# are on disk: an edit applies on the next request.
set -euo pipefail
cd "$(dirname "$0")/.."

mounts=()
for profile in "$(node regions/region.mjs dir)"/profiles/*.brf; do
  mounts+=(-v "$PWD/$profile:/profiles2/$(basename "$profile"):ro")
done
exec docker run --rm -p 127.0.0.1:17777:17777 "${mounts[@]}" bikeottawa-router

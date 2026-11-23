#!/usr/bin/env bash
# Gathers what the router image is built from, into routing/data:
#   region.osm.pbf   OSM data for the region's routing area (regions/region.mjs)
#   elevation/*.hgt  1-arcsecond elevation tiles covering the same area
#   profiles/*.brf   the region's profiles, and bike-profile, the name of its bike one
# Needs: node, curl, docker, and what pipeline/update-osm.sh needs.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${OSM_DIR:-.cache/osm}/region.osm.pbf"
OUT=routing/data
mkdir -p "$OUT/elevation"

# The tiles build normally brings the data up to date first; do it here if not.
[ -f "$REGION" ] || pipeline/update-osm.sh
cp "$REGION" "$OUT/region.osm.pbf"

rm -rf "$OUT/profiles"
mkdir -p "$OUT/profiles"
cp "$(node regions/region.mjs dir)"/profiles/*.brf "$OUT/profiles/"
node regions/region.mjs profiles.bike > "$OUT/bike-profile"

# Elevation is SRTM, under the region's own finer raster where it names one
# (its elevation: for Ottawa NRCan's MRDEM-30, bare ground with no trees or
# roofs, from lidar). It is resampled to 1-arcsecond .hgt tiles, the finest
# BRouter reads. GDAL runs from its Docker image.
GDAL_IMAGE=ghcr.io/osgeo/gdal:ubuntu-small-3.13.3
FINER="$(node regions/region.mjs elevation 2>/dev/null || true)"
SRTM="${SRTM_DIR:-.cache/elevation}"
mkdir -p "$SRTM"

# One tile per degree cell, named after its south-west corner, e.g. N45W076.
node -e "
  const [w,s,e,n]='$(node regions/region.mjs routingBbox)'.split(',').map(Number);
  for (let lat=Math.floor(s); lat<=Math.floor(n); lat++)
    for (let lon=Math.floor(w); lon<=Math.floor(e); lon++)
      console.log((lat<0?'S':'N')+String(Math.abs(lat)).padStart(2,'0')+(lon<0?'W':'E')+String(Math.abs(lon)).padStart(3,'0'), lon, lat)" |
  while read -r tile lon lat; do
    [ -f "$OUT/elevation/$tile.hgt" ] && continue
    echo "Building elevation tile $tile"
    [ -f "$SRTM/$tile.hgt" ] ||
      curl -fsSL --retry 3 "https://s3.amazonaws.com/elevation-tiles-prod/skadi/${tile:0:3}/$tile.hgt.gz" | gunzip > "$SRTM/$tile.hgt"
    # A tile's 3601 x 3601 points sit on whole arcseconds, edges included.
    edges="$(node -p "const h=1/7200; [$lon-h, $lat-h, $lon+1+h, $lat+1+h].join(' ')")"
    # Later sources win: the finer raster over SRTM wherever it has data.
    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/w" -w /w \
      -e GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR -e GDAL_PAM_ENABLED=NO -e CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif \
      "$GDAL_IMAGE" sh -ec "
        gdalwarp -q -overwrite -t_srs EPSG:4326 -te $edges -ts 3601 3601 -r bilinear \
          -ot Float32 -dstnodata -32768 '$SRTM/$tile.hgt' ${FINER:+'/vsicurl/$FINER'} /tmp/tile.tif
        gdal_translate -q -of SRTMHGT -ot Int16 /tmp/tile.tif '$OUT/elevation/$tile.hgt'"
  done
ls -lh "$OUT/region.osm.pbf"
ls "$OUT/elevation" | tr '\n' ' '
echo

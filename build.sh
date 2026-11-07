#!/usr/bin/env bash
# Byggesteg for Cloudflare Pages: kopierer bare filene appen trenger til dist/.
# Cloudflare-oppsett: Build command = «bash build.sh», Build output directory = «dist».
# Synk-API-et ligger i functions/ og blir plukket opp av Cloudflare automatisk.
set -euo pipefail
rm -rf dist
mkdir -p dist
cp index.html sw.js manifest.json icon-180.png icon-192.png icon-512.png dist/
echo "Kopierte $(ls dist | wc -l) filer til dist/"

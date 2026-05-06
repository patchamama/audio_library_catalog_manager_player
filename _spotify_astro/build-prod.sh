#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ASTRO_TELEMETRY_DISABLED=1 npm run build
echo "Build publicada en: /var/www/vhosts/patchamama.com/httpdocs/_audios/spotify"

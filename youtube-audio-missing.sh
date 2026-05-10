#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <url_playlist_o_canal> [mas_urls...]"
  exit 1
fi

YT_DLP="python3 -m yt_dlp"

# IDs locales detectados por patron "... [VIDEO_ID].mp3"
declare -A local_ids=()
while IFS= read -r -d '' f; do
  name=$(basename "$f")
  if [[ "$name" =~ \[([A-Za-z0-9_-]{11})\]\.mp3$ ]]; then
    local_ids["${BASH_REMATCH[1]}"]=1
  fi
done < <(find . -maxdepth 1 -type f -name '*.mp3' -print0)

declare -A seen_ids=()
missing_urls=()
total_ids=0

for src in "$@"; do
  echo "Analizando: $src"
  mapfile -t ids < <($YT_DLP --flat-playlist --print '%(id)s' "$src")

  if [[ ${#ids[@]} -eq 0 ]]; then
    echo "Aviso: sin resultados para $src"
    continue
  fi

  for id in "${ids[@]}"; do
    [[ -n "$id" ]] || continue
    [[ -n "${seen_ids[$id]:-}" ]] && continue
    seen_ids["$id"]=1
    ((total_ids+=1))
    if [[ -z "${local_ids[$id]:-}" ]]; then
      missing_urls+=("https://www.youtube.com/watch?v=$id")
    fi
  done
done

echo "Videos totales detectados: $total_ids"
echo "Audios locales detectados: ${#local_ids[@]}"
echo "Faltantes por descargar: ${#missing_urls[@]}"

if [[ ${#missing_urls[@]} -eq 0 ]]; then
  echo "No hay audios faltantes."
  exit 0
fi

$YT_DLP \
  --no-check-certificate \
  -x \
  --audio-format mp3 \
  "${missing_urls[@]}"

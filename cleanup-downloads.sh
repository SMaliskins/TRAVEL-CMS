#!/bin/bash
# ============================================================================
# Downloads Cleanup Script for Sergej
# ============================================================================
# What it does:
#   1. Deletes duplicate files (with (1), (2), etc. in name)
#   2. Keeps files starting with "!" (important documents)
#   3. Moves ALL images to ~/Downloads/_Images (sort family photos manually)
#   4. Sorts remaining files into folders by type
#   5. Deletes files older than 1 year (except "!" files and sorted ones)
#
# Usage: chmod +x cleanup-downloads.sh && ./cleanup-downloads.sh
# ============================================================================

set -euo pipefail

DOWNLOADS="$HOME/Downloads"
DRY_RUN=false  # Set to true to preview without changes

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; }

# ── Safety check ─────────────────────────────────────────────────────────────
if [ ! -d "$DOWNLOADS" ]; then
  err "Downloads folder not found at $DOWNLOADS"
  exit 1
fi

echo ""
echo "============================================"
echo "  Downloads Cleanup"
echo "  Folder: $DOWNLOADS"
echo "============================================"
echo ""

TOTAL_BEFORE=$(find "$DOWNLOADS" -maxdepth 1 -type f | wc -l | tr -d ' ')
SIZE_BEFORE=$(du -sh "$DOWNLOADS" 2>/dev/null | cut -f1)
echo "Files before: $TOTAL_BEFORE"
echo "Size before:  $SIZE_BEFORE"
echo ""

# ── Step 1: Delete duplicates ────────────────────────────────────────────────
echo "── Step 1: Removing duplicates ──"
DUP_COUNT=0

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -name "* (1).*" -o -name "* (2).*" -o -name "* (3).*" \
  -o -name "* (4).*" -o -name "* (5).*" -o -name "* (6).*" \
  -o -name "* (7).*" -o -name "* (8).*" -o -name "* (9).*" \
  -o -name "*- Copy*" -o -name "*- Copy *" \
\) ! -name '!*' -print0 | while IFS= read -r -d '' file; do
  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY] Would delete: $(basename "$file")"
  else
    rm -f "$file" 2>/dev/null && DUP_COUNT=$((DUP_COUNT + 1))
  fi
done

DUP_DELETED=$(find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -name "* (1).*" -o -name "* (2).*" -o -name "* (3).*" \
  -o -name "* (4).*" -o -name "* (5).*" -o -name "* (6).*" \
  -o -name "* (7).*" -o -name "* (8).*" -o -name "* (9).*" \
  -o -name "*- Copy*" \
\) | wc -l | tr -d ' ')

if [ "$DUP_DELETED" = "0" ]; then
  log "All duplicates removed"
else
  warn "$DUP_DELETED duplicates remaining (might be in use)"
fi

# ── Step 2: Create organized folders ─────────────────────────────────────────
echo ""
echo "── Step 2: Creating folder structure ──"

mkdir -p "$DOWNLOADS/_Images"
mkdir -p "$DOWNLOADS/_Documents"
mkdir -p "$DOWNLOADS/_Videos"
mkdir -p "$DOWNLOADS/_Archives"
mkdir -p "$DOWNLOADS/_Installers"
mkdir -p "$DOWNLOADS/_Spreadsheets"
mkdir -p "$DOWNLOADS/_Other"
log "Folders created"

# ── Step 3: Move images to _Images ───────────────────────────────────────────
echo ""
echo "── Step 3: Moving images to _Images ──"
IMG_COUNT=0

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \
  -o -iname "*.gif" -o -iname "*.webp" -o -iname "*.heic" \
  -o -iname "*.heif" -o -iname "*.bmp" -o -iname "*.tiff" \
  -o -iname "*.svg" \
\) -print0 | while IFS= read -r -d '' file; do
  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY] Would move: $(basename "$file")"
  else
    mv -n "$file" "$DOWNLOADS/_Images/" 2>/dev/null
  fi
  IMG_COUNT=$((IMG_COUNT + 1))
done

IMG_MOVED=$(find "$DOWNLOADS/_Images" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $IMG_MOVED images to _Images/"
warn "Review _Images/ for family photos → move them to a separate folder"

# ── Step 4: Move videos ──────────────────────────────────────────────────────
echo ""
echo "── Step 4: Moving videos to _Videos ──"

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -iname "*.mp4" -o -iname "*.mov" -o -iname "*.avi" \
  -o -iname "*.mkv" -o -iname "*.webm" -o -iname "*.m4v" \
\) -print0 | while IFS= read -r -d '' file; do
  mv -n "$file" "$DOWNLOADS/_Videos/" 2>/dev/null
done

VID_COUNT=$(find "$DOWNLOADS/_Videos" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $VID_COUNT videos to _Videos/"

# ── Step 5: Move spreadsheets ────────────────────────────────────────────────
echo ""
echo "── Step 5: Moving spreadsheets to _Spreadsheets ──"

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -iname "*.xlsx" -o -iname "*.xls" -o -iname "*.csv" \
  -o -iname "*.tsv" -o -iname "*.numbers" \
\) ! -name '!*' -print0 | while IFS= read -r -d '' file; do
  mv -n "$file" "$DOWNLOADS/_Spreadsheets/" 2>/dev/null
done

XLS_COUNT=$(find "$DOWNLOADS/_Spreadsheets" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $XLS_COUNT spreadsheets to _Spreadsheets/"

# ── Step 6: Move archives ────────────────────────────────────────────────────
echo ""
echo "── Step 6: Moving archives to _Archives ──"

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -iname "*.zip" -o -iname "*.rar" -o -iname "*.7z" \
  -o -iname "*.tar" -o -iname "*.gz" -o -iname "*.tar.gz" \
\) -print0 | while IFS= read -r -d '' file; do
  mv -n "$file" "$DOWNLOADS/_Archives/" 2>/dev/null
done

ARC_COUNT=$(find "$DOWNLOADS/_Archives" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $ARC_COUNT archives to _Archives/"

# ── Step 7: Move installers (dmg, pkg, exe) ──────────────────────────────────
echo ""
echo "── Step 7: Moving installers to _Installers ──"

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -iname "*.dmg" -o -iname "*.pkg" -o -iname "*.exe" \
  -o -iname "*.msi" -o -iname "*.app" \
\) -print0 | while IFS= read -r -d '' file; do
  mv -n "$file" "$DOWNLOADS/_Installers/" 2>/dev/null
done

INS_COUNT=$(find "$DOWNLOADS/_Installers" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $INS_COUNT installers to _Installers/"

# ── Step 8: Move documents (pdf, doc, docx, etc.) ────────────────────────────
echo ""
echo "── Step 8: Moving documents to _Documents ──"

find "$DOWNLOADS" -maxdepth 1 -type f \( \
  -iname "*.pdf" -o -iname "*.doc" -o -iname "*.docx" \
  -o -iname "*.txt" -o -iname "*.rtf" -o -iname "*.odt" \
  -o -iname "*.edoc" -o -iname "*.pages" -o -iname "*.pkpass" \
\) ! -name '!*' -print0 | while IFS= read -r -d '' file; do
  mv -n "$file" "$DOWNLOADS/_Documents/" 2>/dev/null
done

DOC_COUNT=$(find "$DOWNLOADS/_Documents" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $DOC_COUNT documents to _Documents/"

# ── Step 9: Delete old files from _Documents and _Archives (>1 year) ─────────
echo ""
echo "── Step 9: Deleting files older than 1 year from sorted folders ──"

OLD_DEL=0
for folder in "$DOWNLOADS/_Documents" "$DOWNLOADS/_Archives" "$DOWNLOADS/_Installers" "$DOWNLOADS/_Spreadsheets"; do
  if [ -d "$folder" ]; then
    BEFORE=$(find "$folder" -maxdepth 1 -type f | wc -l | tr -d ' ')
    find "$folder" -maxdepth 1 -type f -mtime +365 -delete 2>/dev/null
    AFTER=$(find "$folder" -maxdepth 1 -type f | wc -l | tr -d ' ')
    DELETED=$((BEFORE - AFTER))
    if [ "$DELETED" -gt 0 ]; then
      log "Deleted $DELETED old files from $(basename "$folder")/"
    fi
  fi
done

# ── Step 10: Move remaining misc files to _Other ─────────────────────────────
echo ""
echo "── Step 10: Moving remaining files to _Other ──"

find "$DOWNLOADS" -maxdepth 1 -type f \
  ! -name '!*' \
  ! -name '.DS_Store' \
  ! -name '.localized' \
  ! -name 'cleanup-downloads.sh' \
  -print0 | while IFS= read -r -d '' file; do
  mv -n "$file" "$DOWNLOADS/_Other/" 2>/dev/null
done

OTHER_COUNT=$(find "$DOWNLOADS/_Other" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
log "Moved $OTHER_COUNT other files to _Other/"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  DONE!"
echo "============================================"

TOTAL_AFTER=$(find "$DOWNLOADS" -maxdepth 1 -type f | wc -l | tr -d ' ')
SIZE_AFTER=$(du -sh "$DOWNLOADS" 2>/dev/null | cut -f1)

echo ""
echo "Files in root:  $TOTAL_BEFORE → $TOTAL_AFTER"
echo "Size:           $SIZE_BEFORE → $SIZE_AFTER"
echo ""
echo "Folder structure:"
for d in _Images _Videos _Documents _Spreadsheets _Archives _Installers _Other; do
  if [ -d "$DOWNLOADS/$d" ]; then
    COUNT=$(find "$DOWNLOADS/$d" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
    SIZE=$(du -sh "$DOWNLOADS/$d" 2>/dev/null | cut -f1)
    printf "  %-16s %5s files  %s\n" "$d/" "$COUNT" "$SIZE"
  fi
done

echo ""
echo "Files kept in root (important '!' files):"
find "$DOWNLOADS" -maxdepth 1 -type f -name '!*' -exec basename {} \;
echo ""
warn "Don't forget to review _Images/ for family photos!"
echo ""

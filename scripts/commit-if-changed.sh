#!/usr/bin/env bash
# Commits and pushes one file, only when it really changed.
# Usage: commit-if-changed.sh <file> [commit message]
set -euo pipefail

file="${1:?usage: commit-if-changed.sh <file> [message]}"
message="${2:-chore: update learning streak card}"

if [ ! -f "$file" ]; then
  echo "::error::$file does not exist, nothing to commit."
  exit 1
fi

git add -- "$file"
if git diff --cached --quiet -- "$file"; then
  echo "No change in $file, nothing to commit."
  exit 0
fi

git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -m "$message" -- "$file"

# Another run may have pushed in the meantime: rebase once and retry.
if ! git push; then
  git pull --rebase
  git push
fi
echo "Committed and pushed $file."

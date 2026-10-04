#!/usr/bin/env sh
# Apply this update bundle to a local pactmark clone, commit and push.
#
#   git clone https://github.com/lobinni/pactmark.git pactmark
#   sh scripts/publish.sh pactmark            # stage + commit
#   sh scripts/publish.sh pactmark push       # stage + commit + push to origin main
#
# Strategy: merge, never wipe. Files from this bundle overwrite their
# counterparts; everything the bundle does not contain (contracts/pactmark.py,
# the broader docs set, the full Python test suite, helper scripts) stays
# untouched. Only the retired database-template leftovers are removed.

set -eu

REPO="${1:-}"
ACTION="${2:-}"
BRANCH="${3:-main}"

if [ -z "$REPO" ] || [ ! -d "$REPO/.git" ]; then
  echo "usage: sh scripts/publish.sh <path-to-pactmark-clone> [push] [branch]"
  echo "clone first: git clone https://github.com/lobinni/pactmark.git pactmark"
  exit 2
fi

BUNDLE="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
DIRS="deployments docs examples frontend scripts tests src public"
FILES="index.html package.json tsconfig.json vite.config.ts vercel.json README.md .gitignore"

echo "merging updated files into $REPO"
for dir in $DIRS; do
  [ -d "$BUNDLE/$dir" ] || continue
  mkdir -p "$REPO/$dir"
  cp -R "$BUNDLE/$dir/." "$REPO/$dir/"
done
for file in $FILES; do
  [ -f "$BUNDLE/$file" ] || continue
  cp "$BUNDLE/$file" "$REPO/$file"
done

# retired next.js + database template leftovers
STALE="drizzle.config.json eslint.config.mjs src/app src/db src/components/dashboard.tsx src/lib/chain.ts"
for path in $STALE; do
  rm -rf "$REPO/$path" 2>/dev/null || true
done
# compiled python caches should not be tracked
for path in contracts/__pycache__ scripts/deploy/__pycache__ scripts/verification/__pycache__; do
  rm -rf "$REPO/$path" 2>/dev/null || true
done

cd "$REPO"
git add -A $DIRS $FILES 2>/dev/null || git add -A deployments docs examples frontend scripts tests src public index.html package.json vercel.json README.md .gitignore
for path in $STALE contracts/__pycache__ scripts/deploy/__pycache__ scripts/verification/__pycache__; do
  git rm -rf --ignore-unmatch --quiet "$path" 2>/dev/null || true
done

if git diff --cached --quiet; then
  echo "nothing to commit: the clone already matches this bundle"
  exit 0
fi

git commit --quiet -m "Record live Studionet deployment and refresh docs, scripts, tests and samples

- Contract live at 0xbE2Dd3c07322b013244477646977935b4fF21A73 (chain 61999)
- Address read from deployments/studionet.json in code; no environment config
- Add deployment, verification, demo and PNG icon generator scripts
- Refresh testing guide, deployment guide and live test report
- Replace the database template with a static Vite build for Vercel"

echo "committed. next step: git push origin $BRANCH"

if [ "$ACTION" = "push" ]; then
  git push origin "$BRANCH"
  echo "pushed to origin/$BRANCH"
  echo "on vercel.com: import lobinni/pactmark -> framework Vite, output dist/."
  echo "no DATABASE_URL, no env vars: the contract address ships in code."
fi

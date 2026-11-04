#!/usr/bin/env bash
set -euo pipefail

release_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$release_root"

{
  rg --files \
    app build components db drizzle lib public scripts tests worker \
    docs/contracts docs/governance
  printf '%s\n' \
    .env.example \
    .gitignore \
    .npmrc \
    .openai/hosting.json \
    README.md \
    cloudflare-env.d.ts \
    drizzle.config.ts \
    eslint.config.mjs \
    next.config.ts \
    package-lock.json \
    package.json \
    postcss.config.mjs \
    tsconfig.json \
    vite.config.ts
} | LC_ALL=C sort -u | while IFS= read -r release_file; do
  if [[ -f "$release_file" ]]; then
    sha256sum -- "$release_file"
  fi
done | sha256sum | awk '{print $1}'

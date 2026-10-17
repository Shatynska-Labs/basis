# Shared by the hooks: asks tools/change-scope whether a set of changed paths
# is documentation-only (scaffold-workspace design decisions 6 and 11).
#
# judge <hook> <paths>  prints `docs-only`, `full`, or `unjudged` where the
# classifier did not answer cleanly, after one line on stderr saying so, so a
# broken classifier is visible rather than slow. A caller runs every project's
# checks on `unjudged`, not only the affected ones.
judge() {
  hook=$1
  paths=$2
  if verdict=$(printf '%s\n' "$paths" | node tools/change-scope/src/docs-only.ts 2>/dev/null) &&
    { [ "$verdict" = docs-only ] || [ "$verdict" = full ]; }; then
    printf '%s\n' "$verdict"
  else
    echo "$hook: could not judge the change (tools/change-scope failed); running the full checks." >&2
    printf 'unjudged\n'
  fi
}

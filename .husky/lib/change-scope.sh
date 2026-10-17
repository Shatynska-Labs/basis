# Shared by the hooks: asks tools/change-scope whether a set of changed paths
# is documentation-only (scaffold-workspace design decisions 6 and 11).
#
# judge <hook> <paths>  prints `docs-only` or `full`. Anything the classifier
# does not answer cleanly is `full`, with one line on stderr saying the change
# could not be judged, so a broken classifier is visible rather than slow.
judge() {
  hook=$1
  paths=$2
  if verdict=$(printf '%s\n' "$paths" | node tools/change-scope/src/docs-only.ts 2>/dev/null) &&
    { [ "$verdict" = docs-only ] || [ "$verdict" = full ]; }; then
    printf '%s\n' "$verdict"
  else
    echo "$hook: could not judge the change (tools/change-scope failed); running the full checks." >&2
    printf 'full\n'
  fi
}

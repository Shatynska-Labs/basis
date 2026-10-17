export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot's commit bodies carry release-note URLs longer than the body
  // and footer limits; its messages are recognised by its trailer
  // (scaffold-workspace design decision 8).
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
};

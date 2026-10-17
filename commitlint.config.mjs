export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot's commit bodies carry lines longer than the body and footer
  // limits (scaffold-workspace design decision 8). A message is exempt only
  // with Dependabot's trailer and one of the two headers it is configured to
  // write, which this pattern checks in place of the header rules.
  ignores: [
    (message) =>
      /^(chore\(deps\)|ci)(\([\w./-]+\))?: \S/.test(message) &&
      /^Signed-off-by: dependabot\[bot\] <support@github\.com>$/m.test(message),
  ],
};

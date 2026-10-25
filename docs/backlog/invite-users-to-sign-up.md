---
kind: change
waits_on: []
design_with: []
recorded_by: add-identity-authentication
re_checked: 2026-10-21
---

Sign-up is restricted to the deployment's `SIGNUP_ALLOWED_EMAILS` (`add-identity-authentication` design decision 3), so admitting someone takes editing an Environment secret and a redeploy. Let an existing user create a single-use, expiring invitation link instead, so that a Google sign-in carrying a valid invitation creates the account. Decide who may invite (every user, or administrators named per deployment), and whether the allowlist stays as a bootstrap.

- **Kind**: It owes an `identity-authentication` delta and the operator's decision on who may invite.
- **Recorded by**: `add-identity-authentication`, where the operator chose a configuration allowlist first and invitations later, to keep that change small.

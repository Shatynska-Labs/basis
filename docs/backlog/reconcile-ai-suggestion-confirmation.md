---
kind: change
waits_on: []
design_with: []
recorded_by: integrate-the-context-draft
re_checked: 2026-10-19
---

ADR-0007 states that LLM suggestions "always require human confirmation". The PRD disagrees: a plate score is applied at once and corrected afterwards if wrong (US-12, US-13; `docs/product/04-domain-model.md` §5; "the user never waits for the AI"), and only the weekly review's suggested goal change is accepted or rejected (US-15). Decide which holds and record it, in an ADR superseding ADR-0007 in part or a change to the PRD and domain model, then add the outcome to `AGENTS.md`'s Conventions, which today carry only what every source agrees on: deterministic logic in code, every AI assessment correctable, a goal change applied only once accepted.

- **Kind**: It needs the operator's decision between the ADR and the PRD.
- **Waits on**: Best done before the `nutrition` change (roadmap Phase 3).
- **Recorded by**: `integrate-the-context-draft`, whose code review found the conflict; deciding it was outside that change.

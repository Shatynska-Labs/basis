# Backlog

Changes this project has identified but not yet opened, and what each depends on. An entry is deleted when its change is archived. Cite an entry by name, never by number.

## `reconcile-ai-suggestion-confirmation`

ADR-0007 states that LLM suggestions "always require human confirmation". The PRD disagrees: a plate score is applied at once and corrected afterwards if wrong (US-12, US-13; `docs/product/04-domain-model.md` §5; "the user never waits for the AI"), and only the weekly review's suggested goal change is accepted or rejected (US-15). Decide which holds and record it — an ADR superseding ADR-0007 in part, or a change to the PRD and domain model — then add the outcome to `AGENTS.md`'s Conventions, which today carry only what every source agrees on: deterministic logic in code, every AI assessment correctable, a goal change applied only once accepted.

**Argued in**: `integrate-the-context-draft`, whose code review found the conflict.

**Depends on**: nothing. Best done before the `nutrition` change (roadmap Phase 3).

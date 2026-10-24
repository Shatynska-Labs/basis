# Workstreams

A workstream is a goal that takes more than one change. Each open workstream is one file in this directory, named for the workstream in kebab-case: `<name>.md`. A name is unique among workstreams, open and archived, and is not also a change's name. Refer to a workstream only by that name.

A workstream file holds the plan and never its progress. It does not say which steps are done or in flight. That is read from the repository by a step's name, and the first of these that holds wins: a step is done when the freshly fetched trunk holds an archived change of that name; in flight when it holds an open change of that name, or a local or remote branch or an open pull request of that name exists; recorded when its `docs/backlog.md` has an entry of that name; and planned otherwise. Edit the file only when the plan changes: a step added, removed, reordered or renamed, the Done when or what is out of scope revised, an open question added or answered, or the workstream archived.

The order of the steps is the intended order of work, and it gates nothing. A step that cannot start before another says so in its backlog entry's Waits on.

Open a workstream when the operator decides a goal needs more than one change. Commit it with the plan of the first change that advances it, or as work too small to be a change.

A change or a backlog entry may name the workstream it serves before any step names it. Place each such change or entry among the steps, or detach it, at the next edit of the workstream, and at the latest at the archive of a change in it.

When a workstream's Done when holds, move its file to `archive/<YYYY-MM-DD>-<name>.md`, dated the day it is archived, in the commit that carries the record of the change that completed it. Before moving it, remove from the steps each step not done, other than the change whose record that commit carries. Where a removed step is still wanted, it is first recorded as a backlog entry naming no workstream if it is not yet in flight, and it continues as its own change if it is. Then re-point or clear every backlog entry still naming it.

The operator may abandon a workstream whose goal will not be met. Add an **Abandoned** line with the date and the reason, deal with its steps and entries as above, and move it to `archive/` the same way, as work too small to be a change.

Keep a workstream short: its goal, what finishes it and its steps. Lasting decisions belong in a document or a change's design that the file points to. Keep this file when there is no workstream.

A workstream takes this shape:

```
# `workstream-name`

**Goal**: what is true when the workstream is finished, and why it is wanted.

**Done when**: a condition that can be checked against the repository, the forge or production.

**Steps**:

1. `change-name` — what the step does.

**Not in scope**: what the workstream deliberately leaves out, or leaves to another workstream by name, or `nothing`.

**Open questions**: questions whose answers shape the steps, each deleted once answered, the answer recorded where Decisions points, or `nothing`.

**Decisions**: where the workstream's lasting decisions are recorded, or `nothing`.

**Opened**: the date, and the change or the operator that opened it.
```

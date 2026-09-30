---
name: explain
description: Walk the user through a change or a system at the depth their learning profile says they need - a PR, a diff, a file, a subsystem or a bare concept. Use when they say "explain this PR", "walk me through", "how does X work here", "I want to understand", paste a PR/commit URL and ask what it does, or invoke /under-the-hood:explain. Reads ~/.claude/learning/profile.yaml first, explains from real code, then records what the session revealed.
argument-hint: "<PR url | commit | file | subsystem | concept>"
---

# Explain

The learning contract, run deliberately on a target the user names instead of riding along
with a task.

If `~/.claude/learning/profile.yaml` does not exist or `setup_completed` is not `true`, offer
the `under-the-hood:setup` skill first. If they decline, explain at level 1 and skip step 4.

## Step 1 - read the profile before writing a word

Read `~/.claude/learning/profile.yaml`: `language`, `background`, `areas`, `track_gaps`.

Find the areas the target touches. Depth follows the **lowest** level among them:

- **0 or 1** - from first principles. What the thing is, who builds it, what problem it exists
  for, then the mechanism. A `0` means "not assessed", never "knows nothing": treat it as 1.
- **2 or 3** - skip the what-is-it, go to the mechanism and the failure modes.
- **4 or 5** - only what is specific or surprising about this case.

An area the profile does not list is level 0. Never infer a level from how sharp the question
is: a precise question about an unfamiliar system is exactly the level-0 case.

## Step 2 - gather real evidence, never memory

Read the actual artifact first.

- **A PR**: `gh pr view <n> --json title,body,files,commits`, then the diff against its merge
  base. Read added files whole, not just the hunks.
- **A subsystem**: its README, architecture docs, decision records, and the entry points.
- **A concept**: find where this codebase uses it and explain from there.

**If you do not know how something works underneath, say so and point at where to find out.**
An invented mechanism is worse than an admitted gap. This is the one hard rule of the skill.

## Step 3 - explain

Write in `language`. Identifiers, paths, product names and terms of art stay exactly as they
appear in the code - translating them creates a second vocabulary that matches nothing the
user will read or hear.

If `background.analogies` is true, lead with an analogy to something in `background.home`,
then name exactly where it breaks down. Anything in `background.non_native` gets every tool
glossed, even ones a native would find too obvious to mention.

Then, in whatever shape fits the target:

1. **What actually happens** - the mechanism: what gets created, called, spawned, stored;
   which identity gets which permission; what the pipeline runs.
2. **Why it is done this way here** - the constraint or convention behind it, pointed at the
   file, module or repo that encodes it.
3. **What would break otherwise** - the failure mode the design prevents.

**Name before you use it.** Every proper noun gets a half-line gloss the first time it appears:
what kind of thing it is, and who owns it.

Concreteness is the evidence, never the substitute. Lead with the mechanism in plain words, then
cite the real paths and identifiers. A list of unexplained key-value pairs is not an explanation.

Order the walkthrough by **the path a request actually takes**, not by the diff's file order.

## Step 4 - record what the session revealed

Only if `track_gaps` is `true`.

**`profile.yaml`** - update only on real evidence: they worked something out unaided (up) or
clearly hit a wall (down). One level at a time. Change the level, set `updated:`, append a
`changelog:` line: `"YYYY-MM-DD  <key>  <old> -> <new>  - <evidence>"`. Merely touching an area
is not evidence. Add missing areas at level 0.

**`backlog.md`** - if the target brushed a level 0-2 area it did not teach, propose **one**
session and ask before adding it. Never re-add a listed topic; update its anchors instead.

```
## <title - the concept, not the ticket>
- Area: <matching profile key>
- Prompt: <ready-to-paste prompt for a fresh session, phrased as an investigation of real code>
- Anchors: <repo, file paths, PR, doc - concrete, never "read the docs">
- Added: YYYY-MM-DD  Status: todo
```

A good prompt names the files, states what the user already knows so the session does not
re-teach it, and asks them to predict something before reading the answer.

## When not to run

A purely mechanical target (rename, version bump, formatting), or a mechanism already explained
a few turns ago - reference that instead.

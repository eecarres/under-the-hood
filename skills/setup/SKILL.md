---
name: setup
description: First-time setup (and resume) of the under-the-hood learning profile. Use when the SessionStart hook says the profile is missing or setup is not finished, or when the user says "set up under-the-hood", "redo my learning profile", or invokes /under-the-hood:setup.
---

# Setup

Build the user's first learning profile in a fixed sequence of steps. Run the steps **in order,
one at a time**. After each step, write its answer to the profile and set `setup_step:` to that
step's number, in the same write. An interrupted setup resumes at step `setup_step + 1`, so
nothing is decided twice - even when the answer was the default or deliberately empty.

Files, all under `~/.claude/learning/`:

| File | Source in this plugin |
|---|---|
| `profile.yaml` | `${CLAUDE_PLUGIN_ROOT}/assets/profile.template.yaml` |
| `backlog.md` | `${CLAUDE_PLUGIN_ROOT}/assets/backlog.template.md` |
| `profile.html` | `${CLAUDE_PLUGIN_ROOT}/assets/profile.html` |

Never overwrite an existing `profile.yaml` or `backlog.md`. If they exist, read them and resume.
If the user already has a learning setup of their own elsewhere, offer to reuse what exists
instead of starting from zero.

Run the conversation in English until step 2 is answered, then in the chosen language.

## Step 0 - create the files

Create `~/.claude/learning/` if needed. Copy the three files above for any that do not exist
(always refresh `profile.html`, it holds no data). Set `updated:` to today.

## Step 1 - frame it (no field)

Say, in three or four lines: this plugin makes the agent explain what happens underneath while
you work, at a depth set by your levels, and optionally keeps a backlog of gaps worth studying.
Then say plainly: **none of this has to be right the first time**. Levels, areas and every
choice below can be changed at any moment, by hand, in `profile.html`, or by asking.

## Step 2 - language -> `language`

Ask which language explanations should be written in. Default: English. Identifiers, paths,
product names and terms of art always stay as they appear in the code.

## Step 3 - background -> `background.home`, `background.non_native`, `background.analogies`

Ask what they already master and what they use without being native in: languages, tools,
domains, roles. Say they can simply paste a CV, a LinkedIn profile URL, or a few lines about
their career instead of answering item by item. Fetch a URL only if they give one.

Summarise back as two short lists and let them correct it. Then ask whether explanations should
lead with analogies to what they already master (default yes). Skipping this step is fine:
leave both lists empty and move on.

## Step 4 - where the areas come from (no field)

Ask how to discover the areas they work in. Offer, in this order:

- **Their recent work in a tracker or code host** they already have connected: GitHub (`gh`),
  Jira, Linear, or any other connector this session exposes. Read the last 2-3 months of their
  issues and PRs.
- **A description**: a few sentences about what they do day to day.

Only mention the tracker options; do not explain how to connect them. If something is not
connected, they can connect it and come back - setup resumes here.

## Step 5 - pick the areas -> `areas[]`

From the step 4 material, propose 8-15 candidate areas, each as a line of `name - what it covers`
grouped under 3-6 `group:` headings. Ground every one in something concrete you saw.

Ask which ones they **want to learn about**. Not everyone wants to learn everything: only the
chosen ones go in the file. Let them add their own. Ask which 2-4 are priorities
(`priority: true`). Write each as:

```yaml
  - key: <kebab-case>
    name: <Short name - what it covers>
    group: <group>
    level: 0
    priority: <true|false>
    notes: ""
```

## Step 6 - levels -> `areas[].level`

Ask whether they want to rate themselves now or leave everything at 0 and let levels emerge
from real work. Both are fine. If they rate, show the 0-5 scale from the file header, one area
at a time or as a list, and record exactly what they say - never adjust it. If step 4 gave you
evidence, you may suggest a level with the evidence next to it; the user decides.

## Step 7 - explain by default -> `explain_by_default`

Ask: "Should I explain the mechanism underneath while we work, whenever I make an
implementation decision - not only when you ask with /under-the-hood:explain?"

## Step 8 - track gaps -> `track_gaps`

Ask: "Should I keep discovering gaps in your knowledge as we work - adjusting your levels from
real evidence and offering to add a study session to your backlog when we touch a weak area?"

## Step 9 - CLAUDE.md -> `claude_md_installed`

Skip if both step 7 and 8 are `false`. Otherwise explain that these behaviours only apply
outside `/under-the-hood:explain` if they are written into `~/.claude/CLAUDE.md`, and show the
exact block you would add: `${CLAUDE_PLUGIN_ROOT}/assets/claude-md-block.md`, keeping the
header and only the sections they enabled (drop the section from its marker comment to the
next marker). Ask permission. On yes, append it, or replace an existing
`<!-- under-the-hood:start -->` ... `<!-- under-the-hood:end -->` block in place. Never touch
anything outside the markers, then set `claude_md_installed: true`. On no, set `false` and tell them `/under-the-hood:explain`
still works on demand.

## Step 10 - explain band -> `explain_band`

Ask whether to switch on the explain band. Describe it in two lines: after each answered turn, a row
above the prompt offers **Explain** (runs `/under-the-hood:explain` on what was just done, so the
explanation joins the conversation) and **Explain in new session** (the explanation runs in a session
of its own: in the desktop app a suggested-task chip carries a handoff, in the terminal a
`claude --resume <id> --fork-session` command is copied to paste in a new tab). Default: yes.
Write `explain_band: true` or `false`. Say it takes effect from the next answered turn and can be
switched by editing that line; a profile without the line shows the band.

## Step 11 - finish -> `setup_completed: true`

Set `setup_completed: true` and `updated:` to today. Then tell them, in three lines:

- the profile lives at `~/.claude/learning/profile.yaml`;
- `open ~/.claude/learning/profile.html` shows it as a radar and lets them click levels;
- try `/under-the-hood:explain <a PR, file or concept>` on something from their recent work.

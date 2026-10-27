---
name: recap
description: Brief the user on a session they did not watch - what was done, how it works underneath, the live state, blockers and what is needed from them. Use when they say "catch me up", "what have you done", "where are we", "summarise this session", "resúmeme qué has hecho", or invoke /under-the-hood:recap.
argument-hint: "[focus, e.g. 'only the blocker' or 'since my last message']"
---

# Recap

The user is opening this session cold. They did not watch it work - typically a child session
in a coordinator setup, opened only when it needs them. Give them, in one chat message,
everything they need to take the next decision without scrolling up.

**REQUIRED: `under-the-hood:explain`.** The explanation part follows its contract. Read
`../explain/SKILL.md` (relative to this skill's directory) and apply its Step 1 (depth from the
profile), the explanation principles of its Step 3 (language, analogies, name before you use
it, mechanism first) and its Step 4 (record what the session revealed). The output is always
the chat message below, never the visual page from Step 3's "Pick the shape".

If the user passed a focus, cover only that and keep the same headings for what you do cover.

## Step 1 - establish the facts, live

The transcript says what you intended. The repo, the PR and the tracker say what is true.
Check each one this session touched, now:

- **Code**: `git status`, the current branch, commits ahead of the base branch, anything
  uncommitted or unpushed.
- **PR**: `gh pr view --json number,url,state,isDraft,reviewDecision,statusCheckRollup,mergeable`
  for state, CI result per check and review decision. Unresolved review threads come from the
  GraphQL API, every page (`--paginate` follows `endCursor` until `hasNextPage` is false):

  ```bash
  gh api graphql --paginate -F owner=<owner> -F repo=<repo> -F pr=<number> -f query='
    query($owner:String!,$repo:String!,$pr:Int!,$endCursor:String){ repository(owner:$owner,name:$repo){
      pullRequest(number:$pr){ reviewThreads(first:100,after:$endCursor){
        pageInfo{ hasNextPage endCursor }
        nodes{ isResolved path line comments(first:1){ nodes{ author{login} body url } } } } } } }' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not)'
  ```
- **Ticket**: its current status, if a Jira or Linear issue is linked.
- **Anything else the session changed**: a deployment, a workflow run, a cloud resource -
  check its real state with the tool that owns it.

Every claim in the recap is either one of these checked facts or labelled as unverified.

## Step 2 - write the recap

Write in the profile's `language`, with these headings in this order:

1. **TL;DR** - two lines: the goal (why this session exists) and where it stands now.
2. **What was done** - the work in the order a request actually flows through it, not the order
   it happened in. Name the files, PRs and commits. Decisions taken along the way get one line
   each with their reason.
3. **How it works underneath** - the mechanism behind the work, at the profile's depth, per the
   explain contract. Keep it to the parts that matter for the next decision; offer
   `/under-the-hood:explain` for the rest.
4. **Current state** - the facts from Step 1, as done / not done / not verified. A failing check
   gets its name and the first line of the failure.
5. **What you need to understand** - the one to three things the user must hold in their head to
   review, approve or steer this work: a trade-off, a risk, a surprising behaviour, a convention
   this work leans on.
6. **Blockers** - what stops progress and who or what it waits on. Write "none" when there are
   none.
7. **What I need from you** - the decisions, approvals or actions only the user can take, each
   phrased so a one-word answer works. Write "nothing, I'm continuing with X" when there are none.

A heading whose content is empty gets one line saying so, never a filler paragraph. Section 3
may be skipped only when the work has no mechanism at all (a rename, a version bump).

## Step 3 - record

Apply Step 4 of the explain contract to what this session revealed about the user's levels.

<!-- under-the-hood:start -->
## Learning mode (under-the-hood)
Profile: ~/.claude/learning/profile.yaml - read it before the first explanation in a task.
Language, background and levels live there, not here.

<!-- under-the-hood:explain-by-default -->
### Explain by default
When you decide how to implement something, explain the mechanism underneath alongside
the decision, not after the task: what actually happens, why it is done this way in this
codebase, what would break otherwise. Depth follows the area's level (0-1 from first
principles, 2-3 straight to the mechanism, 4-5 only what is specific or surprising).
Lead with an analogy from `background.home` when `background.analogies` is true, then say
where it breaks down. Gloss every proper noun the first time it appears. Never invent a
mechanism: if you do not know how it works underneath, say so and point at where to look.
Skip when: purely mechanical edit, area at level 4-5, already explained this session, or
the user says "just do it". Explaining never blocks or delays the work.

<!-- under-the-hood:track-gaps -->
### Track gaps
Change a level only on real evidence (solved it unaided = up, clearly hit a wall = down),
one step at a time, with a `changelog:` line. An area the profile does not list is level 0:
add the row. When work touches an area at level 0-2, propose ONE learning session and ask
before adding it to ~/.claude/learning/backlog.md. Never re-add a listed topic.
<!-- under-the-hood:end -->

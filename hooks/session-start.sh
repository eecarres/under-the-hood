#!/usr/bin/env bash
# SessionStart hook. Reads the profile and tells the agent one of three things:
#   no profile            -> run the setup skill before anything else
#   setup_completed false -> resume the setup skill where it stopped
#   setup completed       -> which language to explain in, and which modes are on
# Whatever this prints on stdout is added to the session context.
set -u
PROFILE="${UNDER_THE_HOOD_PROFILE:-$HOME/.claude/learning/profile.yaml}"

# Top-level `key: value` scalars only - the profile keeps these flat on purpose.
get() { sed -n "s/^$1:[[:space:]]*\"\{0,1\}\([^\"#]*\)\"\{0,1\}.*/\1/p" "$PROFILE" | head -1 | sed 's/[[:space:]]*$//'; }

if [ ! -f "$PROFILE" ]; then
  echo "under-the-hood: no learning profile at $PROFILE yet. Before helping with anything else, tell the user in one sentence that the under-the-hood plugin is installed but not set up, and offer to run the under-the-hood:setup skill now. If they decline, carry on normally and do not ask again this session."
  exit 0
fi

if [ "$(get setup_completed)" != "true" ]; then
  echo "under-the-hood: the learning profile at $PROFILE exists but setup is not finished. Offer once to resume it with the under-the-hood:setup skill, which picks up at the first missing step."
  exit 0
fi

lang="$(get language)"; lang="${lang:-English}"
echo "under-the-hood: learning profile at $PROFILE is set up. Write every learning explanation in $lang (identifiers, paths, product names and terms of art stay as they appear in the code). Read the profile before the first explanation in a task. The user can run /under-the-hood:explain on any PR, file, subsystem or concept."

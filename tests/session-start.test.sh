#!/usr/bin/env bash
# Runnable check for the three branches of the SessionStart hook.
set -eu
HOOK="$(dirname "$0")/../hooks/session-start.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
run() { UNDER_THE_HOOD_PROFILE="$T/profile.yaml" bash "$HOOK"; }
check() { case "$1" in *"$2"*) echo "ok   $3";; *) echo "FAIL $3: $1"; exit 1;; esac; }

check "$(run)" "not set up" "missing profile -> offer setup"
printf 'setup_completed: false\nlanguage: Spanish\n' > "$T/profile.yaml"
check "$(run)" "not finished" "partial profile -> resume setup"
printf 'setup_completed: true\nlanguage: "Spanish"   # chosen at setup\n' > "$T/profile.yaml"
check "$(run)" "in Spanish (" "completed profile -> language injected"
printf 'setup_completed: true\n' > "$T/profile.yaml"
check "$(run)" "in English (" "no language -> English default"

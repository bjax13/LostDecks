#!/usr/bin/env bash
set -euo pipefail

# Starts Firebase emulators used by this repo.
# Requires: firebase-tools + Java (for Firestore emulator)

PROJECT_ID=${1:-botcards-9a7d9}

# Ensure Homebrew OpenJDK is on PATH (macOS/Homebrew install).
if [[ -d "/opt/homebrew/opt/openjdk@21/bin" ]]; then
  export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
fi

firebase emulators:start --project "$PROJECT_ID" --only auth,firestore,functions

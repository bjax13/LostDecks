#!/usr/bin/env bash
set -euo pipefail

# Reset emulator state (Auth + Firestore) for a clean test run.
# Requires emulators to be running.
# Default projectId matches the LostDecks frontend emulator setup.

PROJECT_ID=${1:-botcards-9a7d9}
AUTH_HOST=${AUTH_HOST:-127.0.0.1}
AUTH_PORT=${AUTH_PORT:-9099}
FS_HOST=${FS_HOST:-127.0.0.1}
FS_PORT=${FS_PORT:-8080}

AUTH_URL="http://${AUTH_HOST}:${AUTH_PORT}/emulator/v1/projects/${PROJECT_ID}/accounts"
FS_URL="http://${FS_HOST}:${FS_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents"

echo "Resetting Firebase emulators for project: ${PROJECT_ID}"

echo "- Clearing Auth users: ${AUTH_URL}"
curl -sS -X DELETE "${AUTH_URL}" >/dev/null

echo "- Clearing Firestore docs: ${FS_URL}"
curl -sS -X DELETE "${FS_URL}" >/dev/null

echo "Done."

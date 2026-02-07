#!/usr/bin/env bash
set -euo pipefail

# Kills any local processes listening on the default Firebase emulator ports.
# Use when you see "port taken" errors starting emulators.

PORTS=(4000 4400 4500 5001 8080 9099)

echo "Looking for listeners on emulator ports: ${PORTS[*]}"

PIDS=()
for port in "${PORTS[@]}"; do
  # macOS lsof output: PID is column 2
  while read -r pid; do
    if [[ -n "$pid" ]]; then
      PIDS+=("$pid")
    fi
  done < <(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}')
done

# unique
if [[ ${#PIDS[@]} -eq 0 ]]; then
  echo "No emulator listeners found."
  exit 0
fi

UNIQ_PIDS=$(printf "%s\n" "${PIDS[@]}" | sort -u)

echo "Killing PIDs:"
echo "$UNIQ_PIDS"

echo "$UNIQ_PIDS" | xargs -n1 kill -9 2>/dev/null || true

echo "Done. If ports are still busy, run: lsof -nP -iTCP:<port> -sTCP:LISTEN"

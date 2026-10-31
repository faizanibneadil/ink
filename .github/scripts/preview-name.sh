#!/usr/bin/env bash
# Turns a git branch name into a Worker Preview name, used as the Preview URL label
# (https://<name>-ink.<subdomain>.workers.dev): lowercase letters, numbers and dashes only,
# starting with a letter, and short enough that "<name>-ink" fits in a 63-character DNS label.
# Example: "claude/happy-davinci-ezcrbl" -> "claude-happy-davinci-ezcrbl"
set -euo pipefail

name=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^[^a-z]+//; s/-+$//')
name=${name:0:59}
name=${name%-}
[ -z "$name" ] && name="branch"
printf '%s\n' "$name"

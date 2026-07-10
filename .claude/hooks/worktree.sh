#!/bin/bash
# Routes Claude Code worktrees to the shared <workspace>/worktrees/<name> directory
# (/Users/ian/dev/spacemolt/worktrees) instead of the default .claude/worktrees/<name>
# inside the repo, which would cause CLAUDE.md to be loaded twice due to filesystem
# traversal crossing the repo boundary. Same convention as gameserver/.claude/hooks/worktree.sh.
set -euo pipefail

# jq reads until it has a complete JSON value and exits — no hanging on open pipes
INPUT=$(jq -c '.')
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name')

if [ "$EVENT" = "WorktreeCreate" ]; then
    NAME=$(echo "$INPUT" | jq -r '.name')
    CWD=$(echo "$INPUT" | jq -r '.cwd')

    # Resolve the repo root; if cwd isn't inside a git repo, emit nothing and let
    # the default worktree behavior apply.
    if ! TOPLEVEL=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null); then
        exit 0
    fi

    # Repos live directly under the workspace root, so ../worktrees is the shared dir.
    # If we're already inside a routed worktree, its parent IS the shared dir.
    PARENT="$(dirname "$TOPLEVEL")"
    if [ "$(basename "$PARENT")" = "worktrees" ]; then
        BASE="$PARENT"
    else
        BASE="$PARENT/worktrees"
    fi
    WORKTREE_DIR="$BASE/$NAME"
    mkdir -p "$BASE"

    if [ -d "$WORKTREE_DIR" ]; then
        # Worktree directory already exists — resume it
        echo "$WORKTREE_DIR"
    elif git -C "$CWD" show-ref --verify --quiet "refs/heads/worktree-$NAME" </dev/null; then
        # Branch exists but directory doesn't — recreate the worktree on the existing branch
        git -C "$CWD" worktree add "$WORKTREE_DIR" "worktree-$NAME" </dev/null >&2
        echo "$WORKTREE_DIR"
    else
        # Fresh worktree — fetch latest main and base the new branch on it
        git -C "$CWD" fetch origin main </dev/null >&2
        git -C "$CWD" worktree add -b "worktree-$NAME" "$WORKTREE_DIR" origin/main </dev/null >&2
        echo "$WORKTREE_DIR"
    fi

elif [ "$EVENT" = "WorktreeRemove" ]; then
    WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path')
    CWD=$(echo "$INPUT" | jq -r '.cwd')

    git -C "$CWD" worktree remove --force "$WORKTREE_PATH" </dev/null >&2
fi

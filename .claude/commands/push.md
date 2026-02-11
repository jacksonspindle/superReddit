Push the current feature branch to origin so others can view it — without merging to main.

## Pre-flight checks

1. Confirm you are NOT on `main`. If you are, STOP and tell the user there's nothing to push — use `/branch` to create a feature branch first.
2. Run `git status` to see what has changed.

## Steps

### 1. Handle uncommitted changes (if any)
- If there are staged, modified, or untracked files relevant to the feature:
  - Stage all relevant files (do NOT stage `.env`, credentials, or secrets).
  - Run `git diff --staged` to review what will be committed.
  - Auto-generate a clear, concise commit message. Summarize the "why" not the "what".
  - Commit with the generated message. Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.
- If working tree is clean, skip to step 2.

### 2. Push
- Push the branch to origin with `-u` flag: `git push -u origin <branch-name>`.
- Confirm the push succeeded.
- Tell the user the branch is now available on GitHub for others to view.
- Show them the branch URL: `https://github.com/<owner>/<repo>/tree/<branch-name>`

## Rules

- Do NOT create a PR.
- Do NOT merge anything.
- Do NOT switch branches. Stay on the current feature branch after pushing.

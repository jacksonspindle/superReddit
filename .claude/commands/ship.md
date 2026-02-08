Ship the current feature branch: commit, push, create PR, check for conflicts, and merge to main.

## Pre-flight checks

1. Confirm you are NOT on `main`. If you are, STOP and tell the user to create a feature branch first with `/branch`.
2. Run `git status` to see what has changed. If there are no changes (nothing staged, nothing modified, no untracked files), STOP and tell the user there's nothing to ship.

## Steps

### 1. Commit
- Stage all modified and new files relevant to the feature (do NOT stage `.env`, credentials, or secrets).
- Run `git diff --staged` and `git log main..HEAD` to understand all changes on this branch.
- Auto-generate a clear, concise commit message from the diff. Summarize the "why" not the "what".
- Commit with the generated message. Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.

### 2. Push
- Push the branch to origin with `-u` flag: `git push -u origin <branch-name>`.

### 3. Create PR
- Run `git diff main...HEAD` to get the full diff of all changes on this branch vs main.
- Auto-generate the PR title (short, under 70 chars) and body from the diff.
- Use this PR body format:

```
## Summary
<2-4 bullet points describing what changed and why>

## Test plan
<bulleted checklist of how to verify the changes>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- Create the PR with `gh pr create`.

### 4. Check for merge conflicts
- Check if the PR has merge conflicts against `main`.
- **If there ARE conflicts**: STOP. Show the user which files conflict. Leave the PR open. Do NOT merge. Tell the user they need to resolve conflicts before merging.
- **If there are NO conflicts**: continue to step 5.

### 5. Merge
- Merge the PR to `main` with `gh pr merge --merge --delete-branch`.
- Confirm the merge succeeded.
- Check out `main` locally and pull the latest: `git checkout main && git pull origin main`.
- Tell the user the feature has been shipped and they're back on `main`.

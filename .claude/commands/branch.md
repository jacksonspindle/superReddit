Create a new feature branch for development.

The argument provided is the branch name: $ARGUMENTS

## Steps

1. Check the current branch. If you're already on a feature branch with uncommitted work, STOP and warn the user — do not switch branches with uncommitted changes.
2. Switch to `main` and pull the latest changes from origin (`git checkout main && git pull origin main`).
3. Create and check out a new branch named `feature/$ARGUMENTS` (e.g., if the argument is "dark-mode", the branch is `feature/dark-mode`).
4. Confirm the branch was created and you're ready to work.

## Rules

- NEVER work directly on `main`. This skill exists to enforce that.
- If no branch name argument is provided, ask the user for one — do not proceed without it.
- If the branch already exists, STOP and tell the user.

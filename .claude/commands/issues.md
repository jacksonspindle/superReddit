Manage GitHub issues for the current repository.

The argument provided is the action and details: $ARGUMENTS

## Supported Actions

Parse the argument to determine which action to take. If no argument or an unclear argument is provided, default to **list open issues**.

### 1. List Issues
**Triggers**: no argument, "list", "show", "open", "closed", "all", "mine", "assigned to me"

- `gh issue list --state open --limit 20` (default)
- If "closed": `gh issue list --state closed --limit 20`
- If "all": `gh issue list --state all --limit 20`
- If "mine" or "assigned to me": `gh issue list --assignee @me --limit 20`
- If a label is mentioned (e.g., "list bug issues"): add `--label "<label>"`
- Present results in a clean table: number, title, labels, assignee, status.

### 2. Create Issue
**Triggers**: "create", "new", "add", "open new", or a string that looks like a title/description

- Extract the title from the argument. If the argument is just "create" or "new", ask the user for a title.
- If a multi-line argument or `--body` content is provided, use it as the body.
- If labels are mentioned (e.g., "create bug: login is broken"), detect and apply them.
- If an assignee is mentioned (e.g., "assign to @jackson"), apply it.
- Create with: `gh issue create --title "..." --body "..." [--label "..." --assignee "..."]`
- If no body is provided, create with just the title (no body flag).
- Show the created issue URL to the user.

### 3. Close Issue
**Triggers**: "close #N", "done #N", "resolve #N", "close N"

- Extract the issue number from the argument.
- Close with: `gh issue close <number>`
- Confirm closure to the user.

### 4. Reopen Issue
**Triggers**: "reopen #N", "reopen N"

- Extract the issue number.
- Reopen with: `gh issue reopen <number>`
- Confirm to the user.

### 5. Comment on Issue
**Triggers**: "comment #N ...", "comment on N: ...", "reply to #N ..."

- Extract the issue number and comment text.
- Comment with: `gh issue comment <number> --body "..."`
- Confirm the comment was posted.

### 6. Label / Tag Issue
**Triggers**: "label #N ...", "tag #N ...", "add label ... to #N"

- Extract the issue number and label name(s).
- Add labels with: `gh issue edit <number> --add-label "label1,label2"`
- If the user says "remove label": `gh issue edit <number> --remove-label "label"`
- Confirm the update.

### 7. Assign Issue
**Triggers**: "assign #N to @user", "assign me to #N", "unassign #N"

- Extract the issue number and GitHub username.
- If "me" or "myself": use `--add-assignee @me`
- Assign with: `gh issue edit <number> --add-assignee "<user>"`
- If "unassign": `gh issue edit <number> --remove-assignee "<user>"`
- Confirm the update.

### 8. View Issue Details
**Triggers**: "view #N", "show #N", "details #N", "#N" (just a number)

- Show full issue details: `gh issue view <number>`
- Present: title, body, labels, assignees, status, comments count, URL.

### 9. Set Milestone
**Triggers**: "milestone #N ...", "set milestone on #N to ..."

- Extract the issue number and milestone name.
- Set with: `gh issue edit <number> --milestone "..."`
- Confirm the update.

### 10. Bulk Close
**Triggers**: "close all done", "close stale", "bulk close"

- First list the issues that would be affected and show them to the user.
- Ask for explicit confirmation before closing multiple issues.
- Close each confirmed issue one at a time.

## Rules

- Always run commands from the repository root.
- When creating issues, keep titles concise (under 80 chars). Put details in the body.
- When listing, present results in an easy-to-scan format.
- If a `gh` command fails, show the error and suggest what might be wrong (e.g., not authenticated, repo not found).
- For ambiguous arguments, prefer the most likely action. E.g., `/issues login page is broken` → create a new issue with that title. `/issues 42` → view issue #42.
- For destructive actions (closing, bulk operations), confirm with the user first.
- If labels referenced don't exist yet, tell the user and offer to create them.
- Common labels to suggest when creating: `bug`, `feature`, `enhancement`, `documentation`, `priority: high`, `priority: low`.

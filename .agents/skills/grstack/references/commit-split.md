# Commit Split

Keep every commit reviewable and keep user-owned work outside the requested slice.

## Authorization

- Treat invocation as permission only for the operations stated in the prompt. An audit request is read-only; a commit request permits local commits; push requires an explicit push request.
- Work on the current branch and worktree. Do not create another branch or worktree unless the user approves it.
- Do not restore, delete, clean, or rewrite unrelated changes. Avoid destructive Git operations.

## Workflow

1. Inspect the current branch, worktree status, unstaged diff, staged diff, and untracked files before staging anything.
2. Audit the existing index independently. `git add` does not isolate files that were already staged.
3. Group changes by product or implementation boundary, not merely by file type. Keep generated noise and unrelated adjacent work separate.
4. If the requested boundaries are ambiguous, present the proposed batches before mutating the index. Otherwise proceed through the explicitly requested batches.
5. Stage explicit paths for one batch at a time. Use hunk staging only when a shared file contains separable work, and inspect the cached patch afterward.
6. Validate the staged boundary with all of:
   - `git diff --cached --name-only`
   - `git diff --cached --stat`
   - `git diff --cached --check`
   - focused compile, type-check, lint, or tests appropriate to that batch
7. Commit using the repository format `X(fe/be): description`, where `X` is `feat`, `chore`, `style`, or `refactor`. Choose `fe` or `be` from the owning boundary, including for documentation coupled to that boundary.
8. Recheck the index and worktree after every commit. Continue until the requested batches are complete, leaving unrelated changes untouched.
9. Push only when explicitly requested, and report the branch and push result separately from local commit results.

## Edge Cases

- Classify generated files by generator, consumer, CI expectation, and tracking policy before including or excluding them.
- Do not blindly remove `.git/index.lock`; identify its owner first.
- If the real index cannot safely be used because of a verified lock or mixed staged state, a temporary `GIT_INDEX_FILE` is acceptable only after reconstructing it from `HEAD` and validating the resulting cached patch.
- Do not bypass hooks merely for convenience. If a hook fails because of unrelated repository state, prove the staged scope and focused validation before deciding how to proceed, and disclose any bypass.

## Completion Report

List each commit hash and subject, its functional scope, validation performed, remaining unrelated changes, and whether anything was pushed.

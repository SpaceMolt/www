# Ship It — Website Release Workflow

You are running the release workflow for the SpaceMolt website (www). Follow these phases exactly, stopping for user input where indicated.

## Prerequisites

Before starting, verify:
- You are working in the `www/` repository (NOT the gameserver or another repo)
- The current branch is NOT `main` — you should be on a feature branch
- If either check fails, STOP and tell the user.

## Phase 1: Commit & Rebase

1. Run `git status` to see all changes
2. Run `git diff --stat` to summarize what's modified
3. If there are uncommitted changes, stage and commit them using conventional commit format:
   - `feat:` for new features or UI additions
   - `fix:` for bug fixes
   - `chore:` for internal changes with no user impact (deps, CI, config)
4. Fetch and rebase onto latest main:
   ```
   git fetch origin main
   git rebase origin/main
   ```
5. If there are merge conflicts:
   - Show the user which files conflict and what the conflicts look like
   - Attempt to resolve obvious conflicts (e.g., adjacent code changes)
   - For conflicts you cannot confidently resolve, STOP and present them to the user with context about both sides
6. Run `pnpm lint` (TypeScript type checking via `tsc --noEmit`) — must be clean
   - If lint fails, fix the issues before proceeding
7. Run `pnpm build` to verify the production build succeeds
   - Build requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` env var (use the test key from ci.yml if not set: `pk_test_ZnJlZS1taXRlLTYuY2xlcmsuYWNjb3VudHMuZGV2JA`)
   - If build fails, fix the issues before proceeding

## Phase 2: Code Review

Launch TWO subagents in parallel (type: general-purpose, model: sonnet). Wait for both to complete before presenting results.

**Subagent 1 — Frontend Quality Review:**

Read the full diff (`git diff origin/main...HEAD`) and check for:

1. **Component patterns** — Are new components following existing patterns in the codebase? Check for:
   - Proper use of `'use client'` / `'use server'` directives
   - Consistent styling approach (CSS modules vs inline vs whatever the project uses)
   - Shared components reused where possible (not duplicating existing UI primitives)
   - Proper TypeScript types (no `any`, no type assertions without justification)

2. **React best practices** — Check for:
   - Missing or incorrect dependency arrays in `useEffect`, `useMemo`, `useCallback`
   - State that should be derived instead of stored
   - Event handlers that should be memoized in hot paths
   - `eslint-disable` directives (these are NEVER acceptable — flag every instance)
   - Proper cleanup in effects (event listeners, intervals, subscriptions)

3. **API integration** — If changes touch API calls or data fetching:
   - Correct use of the v2 API client (never v1)
   - Proper error handling for API failures
   - Loading/error states in UI

4. **Accessibility & UX** — Basic checks:
   - Interactive elements are keyboard-accessible
   - Images have alt text
   - Color contrast is reasonable
   - No broken layouts at common viewport widths

5. **Security** — Check for:
   - No secrets or API keys in client-side code
   - Proper sanitization of user input rendered as HTML
   - No `dangerouslySetInnerHTML` without justification

Rate overall quality: CLEAN / MINOR ISSUES / NEEDS FIXES
List specific concerns with file:line references.

**Subagent 2 — Change Impact Assessment:**

Read the full diff (`git diff origin/main...HEAD`) and check for:

1. **Breaking changes** — Will this break existing pages or functionality?
   - Changed URL routes or removed pages
   - Modified shared components used by multiple pages
   - Changed API response handling that other components depend on

2. **Performance** — Check for:
   - Large new dependencies added to client bundles
   - Unoptimized images or assets
   - Expensive computations in render paths without memoization
   - Missing `loading.tsx` or `Suspense` boundaries for new async routes

3. **SEO & metadata** — If pages were added or modified:
   - Proper `<title>` and meta descriptions
   - OpenGraph tags if the page is shareable

4. **Environment & deployment** — Check for:
   - New environment variables that need to be set in Vercel
   - Changes to `next.config.ts` that could affect deployment
   - New server-side dependencies that Vercel needs to install

Rate overall risk: LOW / MEDIUM / HIGH
List specific concerns with file:line references.

---

Present both assessments to the user and STOP. Wait for their response:
- If they approve: proceed to Phase 3
- If they request fixes: make the fixes, re-run lint/build, amend or add commits, and re-run Phase 2

## Phase 3: PR

1. Push the branch: `git push -u origin {branch-name}`

2. Draft the user-facing release notes for this PR:
   - Audience is website users — what changed that they would notice?
   - New pages, UI improvements, bug fixes, new features
   - Do NOT mention: internal refactors, CI changes, dependency updates, developer tooling
   - Concise — 2–5 bullets is ideal
   - Leave blank for internal changes with no user impact (chore/CI/deps)

3. Create a PR with `gh pr create` using this exact body structure:
   ```
   ## Summary
   {explain what this change does and why}

   ## User-Facing Changes
   {bullet points for users — or leave blank for internal-only changes}
   ```
   - Title: short, descriptive, under 70 chars
   - The User-Facing Changes section drives the Discord release notification on merge

4. Monitor CI on the PR:
   ```
   gh pr checks {PR_NUMBER} --watch
   ```
   - If CI fails, read the logs, fix the issue, push a new commit, and wait for CI to pass
   - Do not show the PR to the user until CI is green

5. Once CI passes, show the user the PR URL and the user-facing notes you wrote

6. **STOP. Wait for the user to review the PR and give explicit approval to merge.**

7. Once approved, merge:
   ```
   gh pr merge {PR_NUMBER} --merge
   ```

8. Confirm the merge succeeded.

After merge:
- Vercel automatically deploys the new version (typically within 1-2 minutes)
- The Release Notification workflow extracts user-facing notes from the PR body and sends a Discord notification
- No manual deploy steps needed — the ship-it workflow is complete when the PR is merged.

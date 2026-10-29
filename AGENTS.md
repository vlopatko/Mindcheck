# Codex Operating Rules — Minimal Tokens / Minimal Actions

## CRITICAL EXECUTION RULE

**Do not proactively verify your changes by executing code. Static reasoning is the default. Execution requires explicit user approval.**

After implementing the requested code change, STOP.

Do not automatically run tests, builds, linters, type-checkers, applications, development servers, debugging tools, validation commands, or deployment commands.

If execution could help verify the change, ask the user for permission first.

No explicit approval = no execution.

---

## Primary Goal

Your job is to make **only the code changes explicitly requested by the user**.

Prioritize:

1. Fixing bugs.
2. Implementing requested functions or features.
3. Correcting logic.
4. Correcting calculations or mathematical logic.
5. Making small, targeted code modifications necessary for the requested task.

Do not perform additional work unless explicitly requested.

---

## Token Usage

Minimize token usage aggressively.

- Read only files relevant to the requested change.
- Do not scan the entire repository unless absolutely necessary.
- Do not inspect unrelated directories or files.
- Do not repeatedly read files that have already been inspected unless necessary.
- Do not analyze unrelated architecture.
- Do not produce long explanations.
- Do not generate large summaries of the repository.
- Do not explain obvious code.
- Do not repeat the user's request.
- Do not propose multiple alternative implementations unless asked.
- Do not perform speculative analysis.
- Do not investigate unrelated potential bugs.
- Do not refactor unrelated code.
- Prefer the smallest possible change that solves the requested problem.

When sufficient information is available, edit the code directly instead of continuing exploration.

---

## Strict Scope

Follow the user's request literally.

Make the **minimum necessary code changes**.

Do NOT:

- Refactor unrelated code.
- Rename unrelated variables, functions, files, or folders.
- Reformat unrelated code.
- Rewrite working code unnecessarily.
- Change project architecture.
- Upgrade dependencies.
- Modify configuration unless required by the requested fix.
- Add new abstractions unless necessary.
- Add extra features.
- Fix unrelated bugs you happen to notice.

If you notice another problem, mention it briefly after completing the requested task, but **do not fix it without approval**.

---

## Testing — Approval Required

**DO NOT run tests unless the user explicitly asks you to run them.**

This includes:

- Unit tests
- Integration tests
- End-to-end tests
- Snapshot tests
- Test suites
- Coverage tools
- Custom test scripts

Do not create new tests unless explicitly requested.

Do not modify existing tests unless explicitly requested or the requested task specifically requires changing them.

If testing would be useful, ask for permission first.

Example:

> The code change is complete. Running tests could verify it. Do you want me to run them?

Without explicit approval, stop after making the code change.

---

## Debugging — Approval Required

Do NOT start debugging workflows automatically.

Do not:

- Run applications to reproduce bugs.
- Start development servers.
- Attach debuggers.
- Run diagnostic scripts.
- Add temporary logging.
- Add debug output.
- Perform runtime experiments.
- Perform trial-and-error execution.

You may reason about the bug by reading the relevant code.

If runtime debugging is required, ask for permission first.

---

## Build / Lint / Type Checking — Approval Required

Do NOT automatically run:

- `npm run build`
- `npm run lint`
- `eslint`
- `prettier`
- `tsc`
- `tsc --noEmit`
- `next build`
- `vite build`
- `webpack`
- `cargo check`
- compilation commands
- static analyzers
- formatters
- validation scripts

Do not run any equivalent build, lint, formatting, compilation, or type-checking command without explicit user approval.

---

## Deployment — STRICTLY FORBIDDEN Without Explicit Request

Never deploy automatically.

Do NOT:

- Deploy to production.
- Deploy to staging.
- Deploy preview environments.
- Run deployment scripts.
- Publish packages.
- Push releases.
- Trigger CI/CD pipelines intentionally.
- Upload builds.
- Modify hosting configuration for deployment.

Do not run deployment commands such as:

`vercel`

`netlify deploy`

`firebase deploy`

`npm publish`

`docker push`

`kubectl apply`

`terraform apply`

or equivalent deployment commands.

Deployment is allowed **only when the user explicitly requests the deployment itself**.

---

## Git / Remote Operations

Do not perform remote Git operations unless explicitly requested.

Do NOT automatically:

- `git push`
- create pull requests
- merge branches
- create releases
- push tags
- modify remote branches

Local code edits are allowed.

Do not create commits unless the user explicitly asks for a commit.

---

## Dependency Management — Approval Required

Do NOT install, remove, or upgrade dependencies without explicit approval.

Do not automatically run:

- `npm install`
- `npm update`
- `pnpm install`
- `yarn install`
- `pip install`
- package upgrades
- dependency migrations

If a new dependency appears necessary, explain why and ask for approval before installing it.

Prefer solving the task using existing project dependencies.

---

## Commands

Avoid running commands unless they are required to understand or modify the requested code.

Before running a command, ask:

> Is this command actually required to make the requested code change?

If not, do not run it.

Commands whose primary purpose is testing, validation, debugging, deployment, formatting, building, installation, or environment modification require explicit user approval.

---

## Editing Strategy

For every task:

1. Identify the smallest relevant area of the codebase.
2. Read only the necessary files.
3. Determine the root cause from static code analysis where possible.
4. Make the smallest correct change.
5. Review the changed code logically.
6. Stop.

Do NOT automatically proceed to testing, debugging, building, linting, deployment, or additional improvements.

---

## Approval Boundary

The following actions require explicit user approval:

- Running tests.
- Running the application.
- Starting development servers.
- Debugging.
- Running build commands.
- Running lint.
- Running formatters.
- Running type-checkers.
- Installing dependencies.
- Updating dependencies.
- Changing infrastructure.
- Changing environment configuration.
- Database migrations.
- Deploying.
- Publishing.
- Git push.
- Creating pull requests.
- Creating commits.
- Destructive operations.
- Large refactors.
- Changes outside the requested scope.

Approval for one action does **not** imply approval for other actions.

For example:

- Approval to run `tsc` does not authorize tests.
- Approval to run tests does not authorize deployment.
- Approval to fix one bug does not authorize fixing other bugs.

---

## Communication Style

Keep responses concise.

After making a change, report only:

- What was changed.
- Which file(s) were changed.
- Any important limitation or assumption.

Do not provide lengthy explanations unless requested.

Do not automatically provide testing instructions, deployment instructions, alternative implementations, or architectural recommendations.

If validation has not been performed because it was not authorized, simply state:

> Change implemented. Tests/build/debugging were not run because they were not requested.

---

## Default Behavior

When uncertain whether an action is allowed:

**DO NOT perform it. Ask for approval.**

The default workflow is:

**Inspect minimal relevant code → make requested code change → stop.**

NOT:

**Inspect → modify → test → debug → lint → build → refactor → deploy.**
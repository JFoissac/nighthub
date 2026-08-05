---

# OpenCode Agent Guidelines

## 1. Agent Delegation (Task Tool)

Use the `task` tool only when the user explicitly asks for delegation or when parallel subwork is clearly necessary.

**When to delegate:**

- **Code review**: Launch a `review` agent on a specific PR or file set.
- **Exploration**: Launch an `explore` agent to map a complex module while you continue coding.
- **Testing**: Launch a subagent to write or run tests in parallel.
- **Documentation**: Launch a subagent to generate docs while you implement.

**Rules for delegation:**

- Always provide a complete prompt with all necessary context (file paths, constraints, expected output).
- Specify the `subagent_type`: `review` for code review, `explore` for codebase analysis, `general` for multi-step tasks.
- Tell the subagent whether to write code or just do research.
- Verify subagent results before integrating them.

**Example triggers:**

- "Review this component for accessibility and Angular best practices"
- "Explore how the auth guard is implemented across the monorepo"
- "Write unit tests for the service I just created"

## 2. Plan Mode (Todo Tool)

For any task requiring 3+ steps, **ALWAYS** create a plan with `todowrite` before starting.

**Plan structure:**

1. Break into discrete, actionable steps.
2. Mark only ONE task as `in_progress` at a time.
3. Mark tasks complete immediately after finishing.
4. Include verification steps (tests, build, lint) as explicit todo items.

**When to use plans:**

- New feature implementation
- Refactoring across multiple files
- Bug fixes with unclear root cause
- Any task where the user explicitly wants subtask delegation

**When NOT to use plans:**

- Single file edits
- Simple questions or explanations
- One-liner fixes

## 3. Parallelism

OpenCode can execute multiple non-dependent tool calls simultaneously. **Use this aggressively.**

**Examples:**

- Read 3 unrelated files in parallel instead of sequentially.
- Run `git status`, `git diff`, and `nx graph` at the same time.
- Launch multiple `task` agents for independent reviews.
- Combine `grep` and `glob` searches in one turn.

**Rule:** If two operations don't depend on each other's result, make them parallel.

## 4. Skill Invocation

Skills provide specialized instructions. **Invoke them proactively** when a task matches their description.

**Available skills for this project:**

- `nx-workspace`: For exploring projects, targets, dependencies. Use FIRST when navigating.
- `nx-generate`: For scaffolding (apps, libs, components). Use FIRST before any generator command.
- `nx-run-tasks`: For executing build, test, lint, serve. Prefer over raw npm/pnpm.
- `angular-component`: For creating Angular v20+ standalone components with signals.
- `angular-developer`: For Angular architecture, routing, forms, DI, SSR.
- `angular-signals`: For signal-based state management, converting from RxJS.
- `tailwind-design-system`: For component libraries, design tokens, responsive patterns.
- `ui-ux-pro-max`: For UI/UX review, accessibility, color systems, layout.
- `web-design-guidelines`: For accessibility audits, best practices checks.
- `monitor-ci`: For Nx Cloud CI pipeline tracking and self-healing fixes.

**Never guess** generator syntax or CLI flags when a skill exists for it.

## 5. Challenging the Developer

The user wants to be challenged. Before implementing:

- **State assumptions explicitly.** If uncertain, ask rather than guess.
- **Propose 2-3 approaches** with tradeoffs when multiple solutions exist.
- **Push back on over-engineering.** If the request seems too complex for the problem, say so.
- **Demand success criteria.** Transform vague requests into verifiable goals.
- **Ask for test strategy only when needed.** If the user already gave one, use it.
- **Verify first, assume never.** Check file existence, grep for symbols, read current state before recommending based on memory.

**Trigger phrases from the user that require challenge mode:**

- "Just do it"
- "Make it work"
- "I don't care how"
- Any request lacking clear acceptance criteria

## 6. Token Efficiency

- **Don't summarize what you just did.** The user can read the diffs.
- **Be concise in explanations.** Code speaks louder than prose.
- **Prefer targeted `read`/`grep` over `cat`/`head`/`tail`.** Read only the lines you need.
- **Don't dump file contents in the chat** unless the user explicitly asks.
- **Reuse context.** If you just read a file, don't re-read it 3 turns later.
- **Avoid asking unnecessary questions.** If the user has already given enough direction, act on it.
- **Do not spawn TU/subagents unless the user asks for them.**

## 7. Verification Loop

Every implementation must end with the simplest relevant verification:

- Prefer `npm run test` when the user asks for tests.
- Run additional scripts only if the user asks for them or the change clearly requires them.
- Do not add `nx` verification steps unless the user explicitly requests `nx`.
- If verification fails, fix before declaring completion.

## 8. Git Usage

- Allowed git commands: `git status`, `git log`, `git diff`, and `git commit` when needed.
- Do not use destructive git commands such as `git reset`, `git checkout --`, or `git clean`.
- Do not push commits unless the user explicitly asks.

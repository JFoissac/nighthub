<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->

---

# OpenCode Agent Guidelines

## 1. Agent Delegation (Task Tool)

Use the `task` tool to delegate focused subtasks. This saves tokens and improves quality by isolating context.

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
- Any task where the user says "and also..." or lists multiple things

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
- **Ask for test strategy.** "How should we verify this?" before writing code.
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

## 7. Verification Loop

Every implementation must end with verification:
- Build passes: `pnpm nx build <project>`
- Tests pass: `pnpm nx test <project>`
- Lint passes: `pnpm nx lint <project>`
- Type-check passes: `pnpm nx tsc <project>` (if applicable)

If verification fails, fix before declaring completion.
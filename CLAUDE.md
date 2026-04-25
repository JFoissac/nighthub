# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project Structure & Contribution

This repository distributes the Karpathy guidelines in **three formats** for different use cases. When updating the guidelines, keep all three in sync:

### The Three Formats

1. **`CLAUDE.md`** (this file)
   - Per-project distribution for Claude Code users
   - Intended to be copied into other repositories
   - Contains the full four principles

2. **`.cursor/rules/karpathy-guidelines.mdc`**
   - Cursor-specific rules format
   - Included directly in projects that use Cursor
   - Same content, Cursor markdown syntax

3. **`skills/karpathy-guidelines/SKILL.md`**
   - Claude Code skill format (distributed via marketplace)
   - Published as the `karpathy-guidelines` plugin
   - Same principles, skill metadata header

### How These Files Relate

- Core principles are **identical** across all three (only syntax differs)
- Changes to principles must be applied to **all three files**
- See [`CURSOR.md`](CURSOR.md) for details on using each format
- See [`README.md`](README.md) for installation instructions

### Contribution Guidelines

When modifying the four principles:

1. **Update the source concept first** — decide on the change
2. **Apply to all three files** — update CLAUDE.md, .cursor/rules file, and SKILL.md
3. **Keep sync comments** — see CURSOR.md's "For contributors" section for sync checklist
4. **Test the formats** — verify the content reads correctly in each context:
   - CLAUDE.md: plain markdown
   - Cursor rule: renders in Cursor settings
   - Skill: displays when invoked via Claude Code plugin

### File Purposes

- **`README.md`** — Project overview, installation, and key insights
- **`EXAMPLES.md`** — Real-world code examples demonstrating each principle
- **`CURSOR.md`** — Instructions for Cursor users and format sync details
- **`.claude-plugin/`** — Plugin marketplace metadata (auto-generated from SKILL.md)
- **`README.zh.md`** — Simplified Chinese translation of README

### What Not to Change

- The four core principle **names** (Think, Simplicity, Surgical, Goal-Driven) — these are referenced in docs
- The **structure** of CLAUDE.md (it's designed for easy copying)
- The **principle content** without syncing across all three formats

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

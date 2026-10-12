Create a draft PR that adds an agentic workflow using these instructions:
- https://raw.githubusercontent.com/github/gh-aw/main/.github/aw/create-agentic-workflow.md
- https://raw.githubusercontent.com/github/gh-aw/main/.github/aw/maintainer.md

The purpose of the workflow is: Keep docs accurate and up-to-date

First, analyze this repository so the workflow is optimized for it:
- Read the README, AGENTS.md (and any CONTRIBUTING or docs files) to understand the project purpose and conventions
- Identify the languages, package managers, build/test/lint commands and CI setup actually used
- Note repository conventions such as labels, issue/PR templates and branch naming
- Use those findings to tailor the workflow prompt, tools, and instructions to this repository

## Intent
https://githubnext.github.io/gh-aw-wizard/

Requirements:
- Name: documentation-updater
- Engine: copilot
- Triggers: when a new issue is opened, when a pull request is opened, when a pull request is marked ready for review, on a fuzzy daily/weekly schedule, on push to main
- Allowed outputs: create new issues, add comments on issues/PRs, add labels, open pull requests
- Choose an appropriate kebab-case filename for the new .github/workflows/*.md file
- Enable Playwright CLI for browser automation
- Include explicit boundary constraints in the workflow prompt, for example: Use DO NOT constraints to prevent deleting existing content
- Additional intent for this workflow, provided by the user: https://githubnext.github.io/gh-aw-wizard/
- Derive a single measurable "operational value" statement from that intent — one sentence describing the concrete outcome a successful run must deliver — and register it as the workflow grader: add it as the first entry of an `evals:` frontmatter block with `id: operational_value` and a question that asks whether the agent output demonstrates that value was delivered
- Add BinEval evaluations for the intent: 2-4 further `evals:` questions that each verify one observable property of the intent, phrased as falsifiable YES/NO questions answerable from the agent output alone (no compound questions, unique ids, YES means success)
- Reflect the intent in the workflow prompt itself so the agent optimizes for it at run time
- Keep a `safe-outputs:` block in the workflow so the evals judge can read `agent_output.json`
- Guard sensitive files, for example: Use protected-files: fallback-to-issue for manifests, CI configuration, and agent instructions
- Prevent PR spam on scheduled runs, for example: Add a pre-activation step that skips scheduled runs once too many open PRs share your title prefix, to avoid spamming maintainers
- Follow the workflow-specific guidance, for example: 80% success rate — reliable when scoped to specific doc areas; Add pre-steps to validate docs build before the agent starts

The workflow should be saved as a new Markdown file in .github/workflows/.
Create a pull request with the generated agentic workflow files.

## Suggested workflow file

Use this generated draft as a starting point for the new `.github/workflows/*.md` file, adapting it to the repository as needed:

```markdown
---
name: documentation-updater
description: Keep docs accurate and up-to-date
on:
  issues:
    types: [opened]
  schedule: daily on weekdays
  push:
    branches: [main]
  pull_request:
    types: [opened, ready_for_review]
  skip-if-match: 'is:issue is:open "gh-aw-workflow-id: documentation-updater" in:body'
permissions:
  contents: read
engine: copilot
tools:
  bash: true
  playwright:
    mode: cli
safe-outputs:
  create-issue:
    max: 1
    expires: 7
  add-comment:
  add-labels:
  create-pull-request:
    max: 1
    expires: 7
timeout-minutes: 30
---

Let the agent generate the detailed documentation updater prompt for this repository...
```

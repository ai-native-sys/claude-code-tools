---
description: Release plugins — code review, bump versions, verify consistency, and push to GitHub.
user-invocable: true
allowed-tools: Read, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
---

# Release Plugins

Guide the release process for this plugin marketplace: review changes, bump versions, verify consistency, and push to GitHub.

## Step 1: Code review current changes

Run `git diff main` (or `git diff HEAD` if on main with uncommitted changes) to identify all changed files.

Review the changes for:

- Correctness and code quality
- Potential bugs or regressions
- Security concerns

Summarize findings to the user. If there are significant issues, flag them and ask if the user wants to proceed or fix first.

## Step 2: Identify changed plugins

From the diff, determine which plugins under `plugins/` have been modified. A plugin is considered changed if any file under its `plugins/<name>/` directory was modified.

List the changed plugins for the user.

## Step 3: Check and bump version numbers

For **each changed plugin**, check whether its version has already been bumped by comparing:

- `plugins/<name>/.claude-plugin/plugin.json` → `version` field
- `.claude-plugin/marketplace.json` → the matching entry in `plugins[]` → `version` field

If the version has NOT been updated for a changed plugin, ask the user what the new version number should be (suggest a semver bump based on the nature of the changes — patch for fixes, minor for features, major for breaking changes).

Only update versions for plugins that have actual changes. Do NOT touch versions for unchanged plugins.

## Step 4: Update version numbers

Apply the new version to both locations for each changed plugin:

1. `plugins/<name>/.claude-plugin/plugin.json` → `version`
2. `.claude-plugin/marketplace.json` → the matching `plugins[]` entry → `version`

## Step 5: Verify version consistency

For **every** plugin listed in `.claude-plugin/marketplace.json`, verify that:

- The version in `marketplace.json` matches the version in `plugins/<name>/.claude-plugin/plugin.json`
- The `name` fields match
- The plugin source directory exists

Report any mismatches and fix them before proceeding.

## Step 6: Commit and push

Stage all changes (including version bumps), create a commit with a descriptive message summarizing the release, and push to GitHub.

Use the format: `Release: <plugin-name> v<version>` for single-plugin releases, or `Release: <plugin1> v<ver1>, <plugin2> v<ver2>` for multi-plugin releases.

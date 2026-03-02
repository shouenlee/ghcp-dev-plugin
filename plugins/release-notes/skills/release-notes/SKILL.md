---
name: release-notes
description: 'Generates changelogs from conventional commits, bumps semantic versions in pyproject.toml or package.json, and publishes GitHub releases. Use when asked to "create release", "release notes", "changelog", "bump version", "semantic version", "tag release", "publish release", or "what changed since last release".'
---

# Release Notes

Generate changelogs, bump semantic versions, and publish GitHub releases from conventional commits.

## When to Use

- You want to generate a changelog from commits since the last release
- You need to determine and apply the next semantic version bump
- You want to create a GitHub release with auto-generated notes

## Prerequisites

- Git repository with conventional commit messages (e.g., `feat:`, `fix:`, `docs:`)
- At least one existing git tag for changelog generation (e.g., `v1.0.0`)
- `gh` CLI installed and authenticated for publishing releases (`gh auth status`)

## Workflow

### `/release notes` — Generate changelog

1. Find the most recent git tag:
   ```bash
   git describe --tags --abbrev=0
   ```
   Or use a user-specified tag as the starting point.

2. Get all commits since that tag:
   ```bash
   git log <tag>..HEAD --pretty=format:"%h %s" --no-merges
   ```

3. Parse conventional commit prefixes from each commit message (`feat`, `fix`, `docs`, `chore`, `perf`, `refactor`, `test`, `ci`, `style`).

4. Group commits by type with human-readable headers:
   - **Features** — `feat` commits
   - **Bug Fixes** — `fix` commits
   - **Documentation** — `docs` commits
   - **Performance** — `perf` commits
   - **Breaking Changes** — commits containing `BREAKING CHANGE` in the body or `!` after the type
   - **Other** — `refactor`, `test`, `chore`, `ci`, `style` commits

5. Generate markdown changelog with version header and date:
   ```markdown
   ## v1.2.0 (2026-03-02)

   ### Features
   - abc1234 Add user authentication flow

   ### Bug Fixes
   - def5678 Fix null pointer in config parser
   ```

6. Include links to commits if a GitHub remote is available:
   ```markdown
   - [`abc1234`](https://github.com/owner/repo/commit/abc1234) Add user authentication flow
   ```

7. Output the changelog to stdout, or offer to prepend it to `CHANGELOG.md`.

### `/release bump` — Semantic version bump

1. Analyze commits since the last tag to determine the bump type:
   ```
   BREAKING CHANGE or ! → major
   feat                 → minor
   fix, perf, refactor  → patch
   ```

2. Calculate the new version from the current tag:
   ```bash
   # Example: v1.2.3 with a feat commit → v1.3.0
   git describe --tags --abbrev=0  # returns v1.2.3
   ```

3. Update the version in the project manifest if present:
   ```bash
   # pyproject.toml: [project] version = "1.3.0"
   # package.json:   "version": "1.3.0"
   ```

4. Show the planned change and ask for confirmation:
   ```
   Version bump: v1.2.3 → v1.3.0 (minor — new features detected)
   Updated: pyproject.toml
   ```

5. Create a new git tag:
   ```bash
   git tag v1.3.0
   ```

### `/release publish` — Create GitHub release

1. Determine the latest tag, or accept a user-specified tag:
   ```bash
   git describe --tags --abbrev=0
   ```

2. Generate release notes using the same logic as `/release notes`.

3. Create the GitHub release:
   ```bash
   gh release create <tag> --title "<tag>" --notes "<changelog>"
   ```

4. Offer additional options:
   - `--draft` — create as a draft release
   - `--prerelease` — mark as a pre-release
   - Attach binary assets if the user provides file paths

5. Confirm with the user before publishing the release.

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| `fatal: No names found` | No git tags exist in the repository | Create an initial tag with `git tag v0.1.0` |
| Commits not grouped correctly | Commit messages don't follow conventional format | Use `type: description` format (e.g., `feat: add login`) |
| `gh: not logged in` | gh CLI is not authenticated | Run `gh auth login` |
| Version not updated in manifest | No `pyproject.toml` or `package.json` found | Manually specify the file or create the manifest |
| Tag already exists | The computed version tag already exists | Use a different version or delete the existing tag |

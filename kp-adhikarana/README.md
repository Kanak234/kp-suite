# Adhikarana -- Workspace Governance & Access

Adhikarana protects the files that shouldn't change. You mark files as **locked**
(edits are blocked) or **review** (you're warned when you save them) using glob
patterns, and Adhikarana enforces those rules live as you work. It's built for
student teams and coursework, where one accidental edit to `package.json` or a
config file can break everyone's build.

## What it does

- **Locked files** -- files matching your locked patterns are protected. In
  strict mode, any edit is **undone automatically**; in soft mode you get a
  warning. Configure via `adhikarana.lockedFiles`.
- **Review files** -- files matching your review patterns raise a prompt when you
  **save** them, so sensitive files get a second look. Configure via
  `adhikarana.warningFiles`.
- **Status bar** -- the active file's governance state is always visible:
  Locked, Review, or Governed (editable). Click it for a full report.
- **Dashboard** -- a panel listing every rule and the current file's status.

Everything is real: matching is glob-based against the workspace-relative path,
rules reload the moment you change settings, and in strict mode a locked file is
genuinely reverted -- not just flagged.

## Usage

| Command | What it does |
|---|---|
| **Adhikarana: Check Workspace Permissions** | Report the active file's status and active rules |
| **Adhikarana: Open Dashboard** | Open the governance dashboard |

## Settings

- `adhikarana.enabled` -- turn governance on/off (default: on)
- `adhikarana.lockedFiles` -- glob patterns for protected files
  (default: `**/package.json`, `**/tsconfig.json`, `**/vitest.config.ts`)
- `adhikarana.warningFiles` -- glob patterns that warn on save
  (default: `**/extension.ts`)
- `adhikarana.strictMode` -- when on, edits to locked files are reverted
  automatically; when off, they're only warned (default: off)

## Example

```jsonc
// .vscode/settings.json
{
  "adhikarana.strictMode": true,
  "adhikarana.lockedFiles": [
    "**/package.json",
    "**/*.lock",
    "**/.github/workflows/*.yml"
  ],
  "adhikarana.warningFiles": [
    "**/src/config/**"
  ]
}
```

With this, teammates can't accidentally edit lockfiles or CI workflows, and any
save under `src/config/` prompts a review.

## How it works

Adhikarana listens to `onDidChangeTextDocument` and `onWillSaveTextDocument`.
When a locked file changes in strict mode, it runs VS Code's revert to restore
the file, guarding against re-triggering itself during the undo. Glob matching
uses `minimatch`. No file contents ever leave your machine.

## License

MIT (c) Kanak Prabhakar

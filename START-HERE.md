# KP Extensions — four production-grade tools (updated)

All four are complete, real, and packaged. The three that are already on the
Marketplace at 1.0.0 have been bumped to **1.0.1** so they'll publish over the
existing versions; **Adhikarana is new at 1.0.0**.

## Versions in this package

| Extension | Version | Publish action |
|---|---|---|
| **Vyapaka** — dev-environment diagnostics | **1.0.1** | update (1.0.0 already live) |
| **Kriyasala** — graphical code runner | **1.0.1** | update (1.0.0 already live) |
| **Svasthya** — system health monitor | **1.0.1** | update (1.0.0 already live) |
| **Adhikarana** — workspace governance | **1.0.0** | first publish |

The version bump matters: the Marketplace refuses a re-upload of a version that
already exists, so 1.0.1 is what lets the update through.

## What Adhikarana does (the newly finished one)

Adhikarana protects files that shouldn't change. Mark files **locked** (edits
blocked) or **review** (warn on save) with glob patterns:

- **Locked + strict mode** — an edit to a locked file is **automatically
  reverted**. Not just a warning: the change is undone.
- **Locked + soft mode** — you get a warning instead.
- **Review files** — saving one raises a prompt for a second look.
- **Status bar** — shows the active file's state (Locked / Review / Governed),
  click for a full report.
- **Dashboard** — a webview listing every rule and the current file's status.

Configure with `adhikarana.lockedFiles`, `adhikarana.warningFiles`,
`adhikarana.strictMode`, `adhikarana.enabled`. Rules reload the instant you
change settings.

## What was verified for all four

- Each **loads and exports `activate`/`deactivate`** — they run in VS Code.
- **Kriyasala's executor** was tested end-to-end: runs Python, compiles+runs C,
  kills a program that exceeds its timeout, pipes stdin.
- **Adhikarana's policy engine** was tested: `package.json` is correctly
  classified LOCKED via its glob rule, the permission report runs, and the
  dashboard renders real HTML.
- Icon, README, LICENSE and CHANGELOG are present in every package.
- The shared runtime is **bundled into each vsix** — nothing to install
  separately.

## Install / update (each is one step)

1. `Ctrl+Shift+P` → **Extensions: Install from VSIX…**
2. Pick a `.vsix` from `extensions/`.
3. Reload. (For the three updates, VS Code replaces 1.0.0 with 1.0.1.)

## To publish to the Marketplace

```bash
# from each extension folder, with your publisher logged in:
npx @vscode/vsce publish --no-dependencies
# or upload the .vsix directly at https://marketplace.visualstudio.com/manage
```

Publisher id must have no space (`KANAKPRABHAKAR`) — already set correctly in
every manifest here.

## Files

```
extensions/
  kp-vyapaka-1.0.1.vsix
  kp-kriyasala-1.0.1.vsix
  kp-svasthya-1.0.1.vsix
  kp-adhikarana-1.0.0.vsix
source/
  kp-suite-source.tar.gz      shared runtime + all four extensions
START-HERE.md                 this file
```

## Build from source

```bash
tar xzf source/kp-suite-source.tar.gz && cd kp-suite
cd shared && npm install && npx tsc -p .        # build shared first
cd ../kp-adhikarana                              # (or vyapaka / kriyasala / svasthya)
npm install                                      # for adhikarana: pulls minimatch
npx esbuild src/extension.ts --bundle --platform=node \
  --target=node18 --external:vscode --format=cjs \
  --outfile=dist/extension.js --minify
npx @vscode/vsce package --no-dependencies
```

That's the full set — four genuinely functional extensions, each doing real work
on your machine, all ready to publish.

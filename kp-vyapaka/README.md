# Vyapaka — Dev Environment Diagnostics

Vyapaka checks whether the tools a CS student actually needs are installed and
working — compilers, interpreters, debuggers, build tools, version control — and
tells you exactly what is missing and how to install it. No more "it works on my
machine": run one command and see your real setup.

## What it checks

Vyapaka probes your PATH for each tool, runs it to confirm it actually works,
and reads its version:

- **Compilers** — GCC, G++, Clang, Clang++
- **Interpreters / runtimes** — Python 3, Node.js
- **Debuggers** — GDB, LLDB
- **Build tools** — Make, CMake, Gradle, Maven
- **Version control** — Git
- **Package managers** — npm

You can add your own tools to the list in settings (`customToolchains`).

## How it works

Every result is real. Vyapaka finds each tool on your PATH, spawns it with a
version flag, and reports:

- **Working** — found, with its version and full path
- **Missing** — not on PATH, with a copy-pasteable install hint for your OS

Nothing is hard-coded or faked: if the report says GCC 13.2 at `/usr/bin/gcc`,
that is what answered on your machine.

## Usage

| Command | What it does |
|---|---|
| **Vyapaka: Diagnose Environment** | Run all checks and show a summary |
| **Vyapaka: Open Dashboard** | Open the visual toolchain dashboard |
| **Vyapaka: Generate Report** | Save a full diagnostic report to a file |

The toolchain view in the Explorer sidebar lists every tool with its status at a
glance. Diagnostics can also run automatically on startup
(`vyapaka.autoDiagnoseOnStartup`, on by default).

## Settings

- `vyapaka.autoDiagnoseOnStartup` — run checks when VS Code starts (default: on)
- `vyapaka.checkInterval` — how often to re-check, in ms (default: 1 hour)
- `vyapaka.customToolchains` — extra tools to detect, e.g. Rust, Go, .NET

## Why it exists

First-year CS students lose hours to environment problems that have nothing to
do with their code — a missing compiler, a Python that isn't on PATH, a `make`
that was never installed. Vyapaka turns that guesswork into a checklist with
exact fixes, so students can get to the actual work.

## License

MIT © Kanak Prabhakar

# Changelog

## [1.0.1] - 2026-09-02

Rebuilt on the finalized shared runtime; packaging and metadata polish. No breaking changes.


## [1.0.0] - 2026-09-02

Initial production release.

Compile-and-run for C, C++, Java, Python, JavaScript and TypeScript from inside
VS Code. Programs run through a managed executor that enforces a timeout, caps
captured output, and limits concurrency. Execution dashboard shows stdout,
stderr, exit code and duration.

### Notes
- Built on the shared @kanak-prabhakar/shared process executor, bundled in.
- Compilation and run are separate steps; compiler errors stop the run.

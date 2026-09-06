# Changelog

## [1.0.1] - 2026-09-02

Rebuilt on the finalized shared runtime; packaging and metadata polish. No breaking changes.


## [1.0.0] - 2026-09-02

Initial production release.

Live CPU, memory, load-average and uptime monitoring read straight from the OS,
plus VS Code's own memory footprint. Auto-updating dashboard with colour-coded
health status.

### Notes
- Uses Node's os module and process.memoryUsage() — real metrics, not estimates.

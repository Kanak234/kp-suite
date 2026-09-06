# Svasthya — System Health Monitor

Svasthya shows you what your machine is doing — CPU load, memory use, system
uptime — in a live dashboard inside VS Code. It is handy when a build is
crawling or the editor feels sluggish and you want to know whether it's your
code, your machine, or something else eating the resources.

## What it shows

All figures are read live from the operating system:

- **CPU usage** — overall load, sampled continuously
- **Memory** — used vs total, as a percentage and in absolute terms
- **Load average** — the system's 1 / 5 / 15-minute load
- **Uptime** — how long the machine has been running
- **This process** — VS Code's own memory footprint

Values are colour-coded (healthy / busy / stressed) so problems stand out at a
glance.

## Usage

| Command | What it does |
|---|---|
| **Svasthya: Check Health** | Take a reading and show a summary |
| **Svasthya: Open Dashboard** | Open the live monitoring dashboard |

The dashboard updates on its own while it's open, so you can watch usage climb
during a heavy compile or test run.

## How it works

Svasthya uses Node's built-in `os` module — `totalmem`, `freemem`, `cpus`,
`loadavg`, `uptime` — plus `process.memoryUsage()` for VS Code's own footprint.
CPU usage is computed by sampling the CPUs' idle-vs-busy time across an interval,
the same way system monitors do. Nothing is estimated or faked.

## Why it exists

Students on modest laptops often can't tell whether a slow build is normal or a
sign their machine is overloaded. Svasthya makes the machine's state visible, so
"why is this so slow?" has an answer you can see.

## License

MIT © Kanak Prabhakar

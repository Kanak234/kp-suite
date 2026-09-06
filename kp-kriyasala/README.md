# Kriyasala — Graphical Code Runner

Kriyasala compiles and runs your code from inside VS Code and shows the output
in a clean panel — no terminal juggling, no remembering compiler flags. Open a
file, hit run, see the result. It is built for students learning C, C++, Java,
Python, JavaScript and TypeScript.

## Languages

| Language | How it runs |
|---|---|
| C | `gcc file.c -o file.out` then runs the binary |
| C++ | `g++ file.cpp -o file.out` then runs the binary |
| Java | `javac File.java` then `java File` |
| Python | `python3 file.py` |
| JavaScript | `node file.js` |
| TypeScript | `ts-node file.ts` |

Compilation and run are separate steps: if compilation fails, Kriyasala shows
you the compiler's errors and stops, instead of running stale output.

## Usage

| Command | What it does |
|---|---|
| **Kriyasala: Execute Current File** | Compile (if needed) and run the open file |
| **Kriyasala: Open Dashboard** | Open the execution panel |
| **Kriyasala: Stop Execution** | Kill the running program |
| **Kriyasala: Restart Execution** | Stop and run again |

Output — stdout, stderr, exit code and how long it took — appears in the
dashboard as the program runs.

## Built to be safe

Kriyasala runs your programs through a managed executor that:

- **enforces a timeout** so an infinite loop can't hang VS Code (default 30s)
- **caps captured output** so a runaway `while(true) printf` can't exhaust memory
- **limits concurrency** so you can't accidentally spawn a hundred processes
- **cleans up** every process it starts, and lets you stop them on demand

## Requirements

Whatever languages you use must be installed and on your PATH:

- C / C++ — a `gcc` / `g++` toolchain
- Java — a JDK (`javac`, `java`)
- Python — `python3`
- JS / TS — `node`, and `ts-node` for TypeScript

Tip: install **Vyapaka** (companion extension) to check in one click which of
these you already have.

## Settings

- `kriyasala.timeout` — max run time per program, in ms (default: 30000)
- `kriyasala.maxConcurrent` — how many programs may run at once (default: 3)

## License

MIT © Kanak Prabhakar

# 🎨 Terminal Color Flood Game

A Python terminal puzzle that lets you play Color Flood and compare your result with search-based AI solvers. The repository also includes a browser edition that runs without Python or installation.

## ▶️ Play in your browser

**[Play Color Flood](https://zikrazoo.github.io/terminal-color-flood-game/)**

The website is published from `web/` with GitHub Pages. If the link is not live yet, see [GitHub Pages setup](#github-pages-setup) below.

## 🎮 Rules

The board is **15 columns × 8 rows** (120 tiles) and uses six colors. Flooding starts in the top-left corner. Choose a different color; the connected flooded region changes to that color and absorbs orthogonally adjacent tiles of the same color. Continue until the entire board is one connected color. The aim is to solve it in as few moves as you can.

The browser edition supports color-button clicks and keyboard shortcuts (`R`, `G`, `B`, `Y`, `C`, `P`), undo, a Greedy hint, solver playback, and a step-by-step comparison view. It follows the Python game rules, but uses a seeded JavaScript random generator, so a browser seed does not recreate the exact same random board as Python.

## ✨ Features

- **Interactive terminal game** with colored board rendering and move counting.
- **Flood-fill using BFS** to find the connected region from the top-left tile.
- **Greedy solver** that chooses a color for the largest immediate increase in the flooded region.
- **A\* search solver** using a priority queue and a heuristic based on the distinct colors remaining outside the flooded region.
- **Bounded search:** A* stops after a node limit and completes the remaining path with Greedy if necessary. In that case, the returned path is a useful reference, but it is **not guaranteed to be globally optimal**.
- **Benchmark mode** to compare Greedy and A* move counts and runtime across generated boards. Existing human results are included when matching records are present.
- **Human-session logging** to `human_data.json` for local benchmark comparisons.
- **Browser version** hosted as a static site; no Python runtime is required to play it.

## 🧰 Run the Python version

### Requirements

- Python 3
- The `bext` package

Install the dependency from the repository root:

```bash
python -m pip install -r requirements.txt
```

Or install it directly:

```bash
python -m pip install bext
```

### Start an interactive game

```bash
python game.py
```

Start a repeatable interactive game using a fixed seed:

```bash
python game.py --seed 42
```

### Run benchmarks

Run the default 10 benchmark trials:

```bash
python game.py --benchmark
```

Run 100 trials:

```bash
python game.py --benchmark --trials 100
```

The benchmark mode iterates through seeds starting at `0`, runs both Greedy and A*, and reports move counts and elapsed time. The optional `--seed` flag is used by interactive mode; benchmark mode generates its own sequence of trial seeds.

## 🧠 How the algorithms work

### Flood fill / BFS

The current color of the top-left tile defines the flooded region. Breadth-first search visits horizontally and vertically adjacent tiles of that color.

### Greedy

Greedy tests each alternative color and selects the one that gives the largest immediate flooded region. It is fast, but a locally good move does not necessarily give the shortest complete solution.

### A* search

A* stores candidate board states in a priority queue and ranks them using:

\[
f(n) = g(n) + h(n)
\]

- `g(n)` is the number of moves used to reach a state.
- `h(n)` estimates the remaining work using the number of distinct colors outside the flooded region.

The Python implementation caps search at 15,000 expanded nodes and uses a Greedy completion if that limit is exceeded. For that reason, the code's “A* target” should be understood as an A*-derived reference score, not a guarantee of an optimal solution on every board.

## 📁 Repository layout

```text
terminal-color-flood-game/
├── game.py                    # Original Python game and solvers
├── requirements.txt            # Python dependency
├── README.md
├── .gitignore
├── web/
│   ├── index.html              # Browser UI
│   ├── style.css               # Responsive styling
│   └── game.js                 # Browser game logic and solvers
└── .github/
    └── workflows/
        └── pages.yml           # GitHub Pages deployment
```

`human_data.json` is generated locally after interactive sessions and is intentionally ignored by Git.

## 🌐 GitHub Pages setup

1. Push the repository to GitHub on the `main` branch.
2. Open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
3. Check the **Actions** tab for the `Deploy Color Flood to GitHub Pages` workflow. The workflow publishes the contents of `web/`.
4. Once deployment succeeds, open the Play link at the top of this README.

**Repository visibility matters:** GitHub Pages on GitHub Free requires the repository to be public. If this repo remains private, publishing Pages requires a plan that supports Pages for private repositories. A published Pages site is publicly accessible, so do not publish secrets or private data in the deployed files.

If deployment still fails, open the failed workflow run in **Actions** and read the first red step. The workflow log gives the precise error; the red icon by itself does not identify the cause.

## 🛠️ Technologies

- Python 3
- JavaScript, HTML, CSS
- Breadth-first search (BFS)
- Greedy search
- A* state-space search
- Priority queues and heuristics
- GitHub Actions and GitHub Pages

## 🔭 Possible next steps

- Add benchmark charts and exportable results.
- Visualize the search frontier and the solver's choices.
- Add more board sizes and difficulty settings.
- Improve the Python/browser board-generation reproducibility across implementations.

---

Built by **[ZikraZoo](https://github.com/ZikraZoo)**.

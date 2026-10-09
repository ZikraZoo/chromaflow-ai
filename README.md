# 🎨 Color Flood — Human vs A*

A terminal-style Color Flood puzzle where you try to solve a board in as few moves as possible while competing against an A* search solver.

## 🎮 Play it in your browser

**[▶ PLAY COLOR FLOOD](./web/index.html)**

When this repository is published with GitHub Pages, the browser game becomes a normal public link — no Python, VS Code, or installation is required.

## 🧠 What is inside?

- **Flood-fill / BFS** to determine the connected flooded region.
- **Greedy search** as a fast baseline solver.
- **A\* search** to find an optimal path for the puzzle under the game's move model.
- **Human vs AI comparison** using the same initial board.
- **Side-by-side replay** showing the AI's choices against the player's choices.
- **Seeded boards** so a puzzle can be reproduced.
- Original Python terminal implementation plus a browser implementation.

## 📁 Project structure

```text
color-flood-ai/
├── game.py                 # Original Python terminal game + benchmark suite
├── web/
│   ├── index.html          # Browser UI
│   ├── style.css           # Terminal-inspired styling
│   └── game.js             # Browser game + BFS/Greedy/A* logic
├── .github/workflows/
│   └── pages.yml           # Automatic GitHub Pages deployment
└── README.md
```

## 💻 Run the original Python version

The original project is a terminal application. It uses `bext` for colored terminal output.

```bash
pip install bext
python game.py
```

Benchmark mode:

```bash
python game.py --benchmark --trials 10
```

You can also test a fixed board seed:

```bash
python game.py --seed 12345
```

## 🤖 Algorithms

The game starts from the top-left tile. A flood-fill finds all connected tiles of the current color. Choosing a new color repaints that connected component, potentially absorbing adjacent regions of the chosen color.

The A* solver treats each board configuration as a state and uses the number of distinct colors remaining outside the flooded region as its heuristic. It explores candidate color changes until the board is solved, with a node limit and greedy fallback in the original implementation.

## 🌐 Browser version

The browser edition is deliberately dependency-free: plain HTML, CSS and JavaScript. That makes it suitable for GitHub Pages and means visitors only need a web browser.

## 📌 Portfolio note

The Python file is the original implementation. The `web/` version adapts the same game concepts to browser controls so a visitor can play the project immediately while still being able to inspect the Python source.

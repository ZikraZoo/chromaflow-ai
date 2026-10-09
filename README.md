# 🎨 Terminal Color Flood Game

A terminal-based Color Flood puzzle written in Python where a human player
competes against search-based AI solvers.

The project started as a command-line game and was extended with a
browser-playable version so that the game can be experienced without
installing Python.

---

## 🎮 Play the Game

### 🌐 Play in Your Browser

**[▶️ PLAY COLOR FLOOD](YOUR-GITHUB-PAGES-LINK-HERE)**

> The browser version recreates the core Color Flood gameplay and provides
> an interactive way to play directly from a web browser.

---

## 🧩 About the Game

Color Flood is a puzzle where the objective is to make the entire board
one color.

The game starts from the **top-left corner** of the board.

On each move, the player selects a new color. The connected flooded region
changes to that color and may absorb neighboring cells of the same color.

The goal is to solve the board using as few moves as possible.

---

## ✨ Features

### 👤 Human Player

- Interactive terminal gameplay
- Six available colors
- Move counter
- Board visualization using colored terminal output
- Replay support
- Human gameplay statistics

### 🤖 AI Solvers

The project contains multiple solving strategies:

- **Greedy Solver**
- **A\* Search Solver**

The AI can automatically search for solutions and compare its performance
against the human player.

### 📊 Benchmarking

The project includes a benchmark mode for running multiple generated
boards and comparing solver performance.

The benchmark can be used to study:

- Number of moves required
- Solver performance
- Greedy vs A* behavior
- Solution quality across different boards

### 🧠 Search Algorithms

The project uses graph-search concepts to solve the puzzle.

#### Flood Fill / BFS

The flooded region is identified using a breadth-first search starting from
the top-left cell.

#### Greedy Search

The greedy solver selects the color that produces the best immediate
expansion of the flooded region.

#### A* Search

The A* solver explores possible board states using a cost function and
heuristic to search for a better solution.

A node limit is used to prevent excessive search, with a fallback strategy
when necessary.

---

## 🖥️ Terminal Version

The original implementation is written entirely in Python and runs from
the command line.

### Requirements

- Python 3
- `bext`

Install the dependency with:

```bash
pip install bext
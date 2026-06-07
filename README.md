# Terminal Color Flood Game with Greedy AI Solver

An interactive, terminal-based puzzle game built in Python. The game uses a graph traversal algorithm (**Breadth-First Search**) to track board state changes and features an integrated **Greedy Look-Ahead AI Solver** that calculates the minimum number of moves required to clear the board, challenging players to optimize their strategy.

## 🕹️ Gameplay Mechanics
The player starts at the top-left tile of a randomized, 15x8 color matrix. 
* By selecting a color from the choices provided, the player "floods" their connected territory.
* Any adjacent tile matching the chosen color becomes captured into the player's territory block.
* The goal is to flood the entire board into a single solid color in fewer moves than the AI.

---

## 🚀 Key Technical Features
* **Graph Traversal (BFS Component):** Implemented a queue-based `get_connected_component` algorithm to map matching neighbor nodes dynamically `[(0, 1), (1, 0), (0, -1), (-1, 0)]` across a custom matrix dictionary coordinate map.
* **Simulated Look-Ahead AI:** The AI agent clones the existing board configuration, executes all 6 available color choices simultaneously, analyzes the state expansions, and dynamically builds a game-winning array map using a greedy optimization strategy.
* **Replay & Animation Framework:** Utilizes Windows terminal sub-layer interfaces via `bext` alongside native OS system state wipes to render animations without interface scrolling or trailing string artifacts.

---

## 🛠️ Setup & Local Execution

1. Clone this repository:
   ```bash
   git clone [https://github.com/ZikraZoo/terminal-color-flood-game.git](https://github.com/ZikraZoo/terminal-color-flood-game.git)
   cd terminal-color-flood-game

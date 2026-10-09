
import random
import bext
import time
import sys
import os
import json
import argparse
import heapq
# Keeping the main settings here makes it easy to change the game without touching the logic.

class GameConfig:
    """Centralized configuration for the game."""
    WIDTH = 15
    HEIGHT = 8
    ZOOM_X = 2
    TILE_TYPES = (0, 1, 2, 3, 4, 5)
    COLORS_MAP = {0: "red", 1: "green", 2: "blue", 3: "yellow", 4: "cyan", 5: "purple"}
    HUMAN_DATA_FILE = "human_data.json"


class FloodBoard:
    """Represents the game board, its state, and its rules."""
    def __init__(self, width=GameConfig.WIDTH, height=GameConfig.HEIGHT):
        self.width = width
        self.height = height
        self.grid = {}

        # First fill the board randomly. The smoothing below makes the layout a little less chaotic.
    def initialize_random(self):
        """Fills the board with random colors and slightly smooths it."""
        for x in range(self.width):
            for y in range(self.height):
                self.grid[(x, y)] = random.choice(GameConfig.TILE_TYPES)
        
        # Give neighboring tiles a chance to match so we get slightly bigger color groups.
        # Smooth out the board slightly
        for _ in range(self.height * self.width):
            x = random.randint(0, self.width - 2)
            y = random.randint(0, self.height - 1)
            self.grid[(x + 1, y)] = self.grid[(x, y)]

        # The AI needs copies of the board so it can test moves without changing the real one.
    def clone(self):
        """Returns a deep copy of the current board."""
        new_board = FloodBoard(self.width, self.height)
        new_board.grid = self.grid.copy()
        return new_board

    def get_connected_component(self):
        """Returns a set of coordinates for the current flooded blob."""
        # The flood always starts from the top-left corner.
        target_color = self.grid[(0, 0)]
        visited = set()
        queue = [(0, 0)]
        
        # Use a simple BFS to find every same-colored tile connected to the starting tile.
        while queue:
            x, y = queue.pop(0)
            if (x, y) not in visited:
                visited.add((x, y))
                # Only horizontal and vertical neighbors count as connected.
                for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in self.grid and self.grid[(nx, ny)] == target_color:
                        if (nx, ny) not in visited:
                            queue.append((nx, ny))
        return visited

        # Find the current blob first, then repaint all of its tiles.
    def change_color(self, new_color):
        """Paints the entire connected component with a new color."""
        blob = self.get_connected_component()
        for (x, y) in blob:
            self.grid[(x, y)] = new_color

    @property
    def is_solved(self):
        """Checks if the entire board is one color."""
        return len(self.get_connected_component()) == self.width * self.height

    @property
    def state_key(self):
        """Returns a hashable tuple representing the current board state."""
        return tuple(self.grid[x, y] for y in range(self.height) for x in range(self.width))


class TerminalUI:
    """Handles all terminal rendering, animations, and user input."""
    BLOCK = chr(9608)
    TILE_STR = BLOCK * GameConfig.ZOOM_X 
    H_LINE = chr(9472)
    V_LINE = chr(9474)
    TL_CORNER = chr(9484)
    TR_CORNER = chr(9488)
    DL_CORNER = chr(9492)
    DR_CORNER = chr(9496)

    @staticmethod
        # 'cls' is for Windows; 'clear' is used on Linux/macOS.
    def clear_screen():
        os.system('cls' if os.name == 'nt' else 'clear')
        bext.goto(0, 0)

    @classmethod
    def print_static_logo(cls):
        logo = [
            "███████╗██╗      ██████╗  ██████╗ ██████╗ ███████╗██████╗ ",
            "██╔════╝██║     ██╔═══██╗██╔═══██╗██╔══██╗██╔════╝██╔══██╗",
            "█████╗  ██║     ██║   ██║██║   ██║██║  ██║█████╗  ██████╔╝",
            "██╔══╝  ██║     ██║   ██║██║   ██║██║  ██║██╔══╝  ██╔══██╗",
            "██║     ███████╗╚██████╔╝╚██████╔╝██████╔╝███████╗██║  ██║",
            "╚═╝     ╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝"
        ]
        colors = ['red', 'yellow', 'green','cyan', 'blue', 'purple','cyan', 'magenta']
        bext.fg(random.choice(colors))
        for line in logo:
            print(line)
        print()
        bext.fg('white')

    @classmethod
    def welcome_ascii_art(cls):
        colors = ['red', 'yellow', 'green','cyan', 'blue', 'purple','cyan', 'magenta']
        cls.clear_screen()
        bext.fg(random.choice(colors))
        print("\nWelcome to the\n")
        cls.print_static_logo()
        time.sleep(0.5)

    @classmethod
        # The game is rendered with colored terminal blocks instead of a graphical window.
    def display_board(cls, board):
        bext.fg('white')
        width_scaled = board.width * GameConfig.ZOOM_X
        print(cls.TL_CORNER + cls.H_LINE * width_scaled + cls.TR_CORNER)
        
        for y in range(board.height):
            bext.fg('white')
            print('>' if y == 0 else cls.V_LINE, end="")
            for x in range(board.width):
                bext.fg(GameConfig.COLORS_MAP[board.grid[(x,y)]])  
                print(cls.TILE_STR, end="")
            bext.fg('white')
            print(cls.V_LINE)
            
        print(cls.DL_CORNER + cls.H_LINE * width_scaled + cls.DR_CORNER)

    @classmethod
    def display_parallel_boards(cls, board_ai, board_human):
        bext.fg('white')
        spacing = "      "
        border = cls.H_LINE * (board_ai.width * GameConfig.ZOOM_X)
        
        print(cls.TL_CORNER + border + cls.TR_CORNER + spacing + cls.TL_CORNER + border + cls.TR_CORNER)
        
        for y in range(board_ai.height):
            # AI Board
            bext.fg('white')
            print('>' if y == 0 else cls.V_LINE, end="")
            for x in range(board_ai.width):
                bext.fg(GameConfig.COLORS_MAP[board_ai.grid[(x,y)]])
                print(cls.TILE_STR, end="")
            bext.fg('white')
            print(cls.V_LINE, end=spacing)
            
            # Human Board
            bext.fg('white')
            print('>' if y == 0 else cls.V_LINE, end="")
            for x in range(board_human.width):
                bext.fg(GameConfig.COLORS_MAP[board_human.grid[(x,y)]])
                print(cls.TILE_STR, end="")
            bext.fg('white')
            print(cls.V_LINE)
            
        print(cls.DL_CORNER + border + cls.DR_CORNER + spacing + cls.DL_CORNER + border + cls.DR_CORNER)

    @classmethod
    def ask_for_player_move(cls):
        while True:
            options = [('red', '(R)ed '), ('green', '(G)reen '), ('blue', '(B)lue '),
                       ('yellow', '(Y)ellow '), ('cyan', '(C)yan '), ('purple', '(P)urple ')]
            bext.fg('white')
            print("Choose one of ", end="")
            for color, text in options:
                bext.fg(color)
                print(text, end="")
            bext.fg('white')
            print("or QUIT:")
            # Quit cleanly if the player is done.
            
            response = input("> ").upper().strip()
            if response == "QUIT":
                cls.clear_screen()
                print("Thanks for playing!")
                sys.exit()
                
            if response and response[0] in ['R', 'G', 'B', 'Y', 'C', 'P']:
                key_map = {'R':0, 'G': 1, 'B':2, 'Y':3, 'C':4, 'P':5}
                return key_map[response[0]]


class FloodAI:
    """Contains logic for Greedy and A* search pathfinding."""
    
        # Count the different colors that are still outside the flooded area.
    @staticmethod
    def get_unique_colors_remaining(board, current_blob):
        return len({color for pos, color in board.grid.items() if pos not in current_blob})

    @classmethod
    def get_best_greedy_move(cls, board):
        current_blob = board.get_connected_component()
        current_color = board.grid[(0, 0)]
        best_color = current_color
        max_new_size = len(current_blob)
        
        # Try every color and see which one gives the biggest immediate gain.
        for color in range(6):
            if color == current_color: continue
            board_copy = board.clone()
            board_copy.change_color(color)
            new_size = len(board_copy.get_connected_component())
            if new_size > max_new_size:
                max_new_size = new_size
                best_color = color
                
        # If nothing grows the blob, pick another color so we don't get stuck.
        if best_color == current_color:
            valid_colors = [c for c in range(6) if c != current_color]
            best_color = random.choice(valid_colors)
        return best_color

    @classmethod
    def solve_greedy(cls, board):
        # This is only a simulation, so keep the original board untouched.
        temp_board = board.clone()
        moves = []
        while not temp_board.is_solved:
            best_color = cls.get_best_greedy_move(temp_board)
            moves.append(best_color)
            temp_board.change_color(best_color)
        return moves

    @classmethod
        # A* checks possible future moves and prioritizes states that look closer to a solution.
    def solve_astar(cls, board, max_nodes=15000):
        initial_blob = board.get_connected_component()
        start_h = cls.get_unique_colors_remaining(board, initial_blob)
        
        counter = 0 
        # Queue entries contain the estimated cost, moves so far, board state, and path taken.
        pq = [(start_h, 0, counter, board.clone(), [])]
        visited = {board.state_key}
        nodes_expanded = 0

        while pq:
            f, g, _, current_board, path = heapq.heappop(pq)
            nodes_expanded += 1
            
            # Stop A* from taking forever on a difficult board; finish with greedy instead.
            if nodes_expanded > max_nodes:
                greedy_remainder = cls.solve_greedy(current_board)
                return path + greedy_remainder, nodes_expanded

            if current_board.is_solved:
                return path, nodes_expanded

            current_color = current_board.grid[(0, 0)]
            for next_color in range(6):
                if next_color == current_color: continue
                    
                next_board = current_board.clone()
                next_board.change_color(next_color)
                state_key = next_board.state_key
                
                # We've already seen this exact board, so there's no point exploring it again.
                if state_key not in visited:
                    visited.add(state_key)
                    next_blob = next_board.get_connected_component()
                    h = cls.get_unique_colors_remaining(next_board, next_blob)
                    counter += 1 
                    heapq.heappush(pq, (g + 1 + h, g + 1, counter, next_board, path + [next_color]))

        return [], nodes_expanded


    # Save human results so the same puzzles can be compared with the AI later.
class PlayerStats:
    """Handles logging and retrieving human gameplay telemetry."""
    
    @staticmethod
    def save_session(seed, width, height, moves_taken, time_taken_sec):
        data = {}
        if os.path.exists(GameConfig.HUMAN_DATA_FILE):
            with open(GameConfig.HUMAN_DATA_FILE, "r") as f:
                try: data = json.load(f)
                except json.JSONDecodeError: pass

        # The seed identifies the exact puzzle, which makes comparisons reproducible.
        key = f"{width}x{height}_seed_{seed}"
        if key not in data: data[key] = []

        data[key].append({
            "moves": moves_taken,
            "time_sec": round(time_taken_sec, 2),
            "timestamp": time.time()
        })

        with open(GameConfig.HUMAN_DATA_FILE, "w") as f:
            json.dump(data, f, indent=4)

    @staticmethod
    def load_best_session(seed, width, height):
        if not os.path.exists(GameConfig.HUMAN_DATA_FILE): return None
        with open(GameConfig.HUMAN_DATA_FILE, "r") as f:
            try: data = json.load(f)
            except json.JSONDecodeError: return None
            
        key = f"{width}x{height}_seed_{seed}"
        sessions = data.get(key, [])
        if not sessions: return None
        return min(sessions, key=lambda x: x["moves"])


class ColorFloodGame:
    """Main application orchestrator."""
    
    @staticmethod
        # Benchmark mode skips the fancy UI and focuses on solver performance.
    def run_benchmark(num_trials, width, height):
        print("=" * 80)
        print(f" RUNNING HEADLESS BENCHMARK ({num_trials} Trials | Board: {width}x{height})")
        print("=" * 80)
        print(f"{'Seed':<6} | {'Solver/Human':<12} | {'Moves':<6} | {'Nodes Expanded':<15} | {'Time (s)':<10}")
        print("-" * 80)

        metrics = {"greedy_moves": 0, "greedy_time": 0, "astar_moves": 0, "astar_time": 0, "human_moves": 0, "human_count": 0}

            # Seeding lets us recreate the exact same board in another run.
        for seed in range(num_trials):
            random.seed(seed)
            board = FloodBoard(width, height)
            board.initialize_random()

            # Greedy
            start_t = time.time()
            greedy_path = FloodAI.solve_greedy(board)
            greedy_time = time.time() - start_t
            metrics["greedy_moves"] += len(greedy_path)
            metrics["greedy_time"] += greedy_time

            # A*
            start_t = time.time()
            astar_path, astar_nodes = FloodAI.solve_astar(board)
            astar_time = time.time() - start_t
            metrics["astar_moves"] += len(astar_path)
            metrics["astar_time"] += astar_time

            # If the human has played this puzzle before, include their best result.
            # Human
            human_stats = PlayerStats.load_best_session(seed, width, height)

            print(f"{seed:<6} | {'Greedy':<12} | {len(greedy_path):<6} | {'N/A':<15} | {greedy_time:.4f}")
            print(f"{'':<6} | {'A* Search':<12} | {len(astar_path):<6} | {astar_nodes:<15} | {astar_time:.4f}")
            if human_stats:
                print(f"{'':<6} | {'Human':<12} | {human_stats['moves']:<6} | {'N/A':<15} | {human_stats['time_sec']:.4f}")
                metrics["human_moves"] += human_stats['moves']
                metrics["human_count"] += 1
            print("-" * 80)

        print("\n" + "=" * 80)
        print(" SUMMARY BENCHMARK RESULTS")
        print("=" * 80)
        print(f"Greedy Solver -> Avg Moves: {metrics['greedy_moves'] / num_trials:.2f} | Avg Time: {metrics['greedy_time'] / num_trials:.4f}s")
        print(f"A* Search     -> Avg Moves: {metrics['astar_moves'] / num_trials:.2f} | Avg Time: {metrics['astar_time'] / num_trials:.4f}s")
        if metrics['human_count'] > 0:
            print(f"Human Player  -> Avg Moves: {metrics['human_moves'] / metrics['human_count']:.2f} (Across {metrics['human_count']} logged seeds)")
        else:
            print("Human Player  -> No human data found.")
        print("=" * 80)

    @classmethod
        # A fixed seed is useful for testing; otherwise start a fresh random game.
    def run_interactive(cls, target_seed):
        game_seed = target_seed if target_seed is not None else random.randint(1, 100000)
        random.seed(game_seed)
        
        TerminalUI.welcome_ascii_art()
        
        board = FloodBoard(GameConfig.WIDTH, GameConfig.HEIGHT)
        board.initialize_random()
        initial_board = board.clone() 
        total_tiles = board.width * board.height

        TerminalUI.clear_screen()
        TerminalUI.print_static_logo()
        # Work out the AI solution first so we have a target to compare the player against.
        print("Calculating optimal A* AI path...")
        ai_moves_sequence, _ = FloodAI.solve_astar(initial_board)
        ai_target_score = len(ai_moves_sequence)
        time.sleep(0.5)

        human_moves_sequence = []
        player_moves = 0
        start_time = time.time()

        # Keep playing until the flooded area covers the whole board.
        while not board.is_solved:
            TerminalUI.clear_screen()
            TerminalUI.print_static_logo()
            TerminalUI.display_board(board)
            current_blob_size = len(board.get_connected_component())
            
            print(f"\nSeed: {game_seed}")
            print(f"Optimal A* Target: {ai_target_score} moves")
            print(f"Your Moves: {player_moves}")
            print(f"Tiles captured: {current_blob_size} / {total_tiles}\n")
                
            next_color = TerminalUI.ask_for_player_move()
                # Choosing the current color changes nothing, so it shouldn't count as a move.
            if next_color != board.grid[(0,0)]:
                board.change_color(next_color)
                human_moves_sequence.append(next_color)
                player_moves += 1

        # Store the result so it can be used in future benchmark comparisons.
        game_duration = time.time() - start_time
        PlayerStats.save_session(game_seed, board.width, board.height, player_moves, game_duration)

        TerminalUI.clear_screen()
        TerminalUI.print_static_logo()
        TerminalUI.display_board(board)
        print(f"\nBoard Solved! You took {player_moves} moves in {game_duration:.2f} seconds.")
        print("Your gameplay data has been logged for benchmarking.")

        # Give the player some feedback based on how their result compares with A*.
        if player_moves <= ai_target_score:
            bext.fg('green')
            print(f"INCREDIBLE! You beat or matched the A* optimal target of {ai_target_score} moves!")
            bext.fg('white')
        else:
            bext.fg('red')
            print(f"The AI optimally solved it in {ai_target_score} moves. That's {player_moves - ai_target_score} moves fewer than you.")
            bext.fg('white')
            
            print("\nPress ENTER to start the side-by-side replay analysis...")
            input("> ")
            cls.run_replay(initial_board, ai_moves_sequence, human_moves_sequence)

    @classmethod
        # Both boards start from the same state so the replay is a fair comparison.
    def run_replay(cls, initial_board, ai_moves, human_moves):
        board_ai = initial_board.clone()
        board_human = initial_board.clone()
        max_moves = max(len(ai_moves), len(human_moves))
        
            # Show one move at a time from both sides so the difference is easy to follow.
        for i in range(max_moves):
            TerminalUI.clear_screen()
            TerminalUI.print_static_logo()
            
            ai_move = ai_moves[i] if i < len(ai_moves) else None
            human_move = human_moves[i] if i < len(human_moves) else None
            
            if ai_move is not None: board_ai.change_color(ai_move)
            if human_move is not None: board_human.change_color(human_move)
            
            board_pixel_width = board_ai.width * GameConfig.ZOOM_X + 2 
            header_space = " " * ((board_pixel_width + 6) - len("AI OPTIMAL PATH"))
            print(f"AI OPTIMAL PATH{header_space}YOUR PLAY")
            
            TerminalUI.display_parallel_boards(board_ai, board_human)
            
            print(f"\nStep {i+1} / {max_moves}")
            ai_text = GameConfig.COLORS_MAP[ai_move].upper() if ai_move is not None else "FINISHED"
            human_text = GameConfig.COLORS_MAP[human_move].upper() if human_move is not None else "FINISHED"
            
            print(f"AI Chose: {ai_text:<20} You Chose: {human_text}")
            print("-" * 50)
            
            if i < max_moves - 1:
                print("Press ENTER for next step...")
                input()
            
        print("\nReplay complete! Press ENTER to exit.")
        input()


    # Command-line flags let the same program run as a game or as a benchmark.
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Terminal Color Flood Puzzle & Benchmark Suite")
    parser.add_argument("--benchmark", action="store_true", help="Run headless benchmarking mode")
    parser.add_argument("--trials", type=int, default=10, help="Number of benchmark board trials")
    parser.add_argument("--seed", type=int, default=None, help="Specific board seed to play or test")
    args = parser.parse_args()

    if args.benchmark:
        ColorFloodGame.run_benchmark(args.trials, GameConfig.WIDTH, GameConfig.HEIGHT)
    else:
        ColorFloodGame.run_interactive(args.seed)

        

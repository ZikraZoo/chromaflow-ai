import random, bext, time, sys, os

# All color tiles used on the board
tile_types = (0,1,2,3,4,5)  
colors_map = {0: "red", 1: "green", 2: "blue", 3: "yellow", 4:"cyan", 5: "purple"}

# Board details
board_width = 15
board_height = 8
horizontal_line = chr(9472)
vertical_line = chr(9474)
top_left_corner = chr(9484)
top_right_corner = chr(9488)
down_left_corner = chr(9492)
down_right_corner = chr(9496)
block = chr(9608)

def clear_screen():
    """Completely wipes the terminal to prevent ugly artifacts or scrolling."""
    os.system('cls' if os.name == 'nt' else 'clear')
    bext.goto(0, 0)

def get_new_board():
    """Assigning coordinates to the board with specified tuple colour"""
    board = {}
    for x in range(board_width):
        for y in range(board_height):
            board[(x,y)] = random.choice(tile_types)
    
    # Smooth out the board slightly to make it more playable
    for i in range(board_height * board_width):
        x = random.randint(0, board_width-2)
        y = random.randint(0, board_height-1)
        board[(x+1,y)] = board[(x,y)]
    return board
    
def display_board(board): 
    """Display the board on the screen"""
    bext.fg('white')
    print(top_left_corner + horizontal_line*board_width + top_right_corner)
    for y in range(board_height):
        bext.fg('white')
        if y == 0:
            print('>', end = "")
        else:
            print(vertical_line, end="")
        for x in range(board_width):
            bext.fg(colors_map[board[(x,y)]])  
            print(block, end = "")
        bext.fg('white')
        print(vertical_line)
    print(down_left_corner + horizontal_line*board_width + down_right_corner)

def welcome_ascii_art():
    """For that welcome thing!"""
    colors = ['red', 'yellow', 'green','cyan', 'blue', 'purple','cyan', 'magenta']
    clear_screen()
    bext.fg(random.choice(colors))
    print("\nWelcome to the\n")

    logo = [
    "███████╗██╗      ██████╗  ██████╗ ██████╗ ███████╗██████╗ ",
    "██╔════╝██║     ██╔═══██╗██╔═══██╗██╔══██╗██╔════╝██╔══██╗",
    "█████╗  ██║     ██║   ██║██║   ██║██║  ██║█████╗  ██████╔╝",
    "██╔══╝  ██║     ██║   ██║██║   ██║██║  ██║██╔══╝  ██╔══██╗",
    "██║     ███████╗╚██████╔╝╚██████╔╝██████╔╝███████╗██║  ██║",
    "╚═╝     ╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝"
    ]

    for i, line in enumerate(logo):
        bext.fg(colors[i % len(colors)])
        print(line)
        time.sleep(0.2)

    print()
    bext.fg(random.choice(colors))
    print("                                                 Game!!!")
    bext.fg('white')
    time.sleep(1)

def ask_for_player_move():
    """Let the player select a color to paint upper left tile"""
    while True:
        options = [('red', '(R)ed '),('green', '(G)reen '),('blue', '(B)lue '),('yellow', '(Y)ellow '),('cyan', '(C)yan '),('purple', '(P)urple ')]
        
        bext.fg('white')
        print("Choose one of ", end="")
        for color, text in options:
            bext.fg(color)
            print(text, end="")
            
        bext.fg('white')
        print("or QUIT:")
        
        response = input("> ").upper().strip()
        if response == "QUIT":
            clear_screen()
            print("Thanks for playing!")
            sys.exit()
            
        # Check if they typed a valid first letter
        if response and response[0] in ['R', 'G', 'B', 'Y', 'C', 'P']:
            key_map = {'R':0, 'G': 1, 'B':2, 'Y':3, 'C':4, 'P':5}
            return key_map[response[0]]

def get_connected_component(board):
    """Finds all tiles connected to the top-left (0,0) that share the same color."""
    target_color = board[(0, 0)]
    visited = set()
    queue = [(0, 0)]
    
    while queue:
        x, y = queue.pop(0)
        if (x, y) not in visited:
            visited.add((x, y))
            for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                nx, ny = x + dx, y + dy
                if (nx, ny) in board and board[(nx, ny)] == target_color:
                    if (nx, ny) not in visited:
                        queue.append((nx, ny))
    return visited

def change_tile(board, new_color):
    """Paints the entire connected component with the new color."""
    current_blob = get_connected_component(board)
    for (x, y) in current_blob:
        board[(x, y)] = new_color

def get_best_greedy_move(board):
    """Simulates all possible moves and picks the one that captures the most tiles."""
    current_blob = get_connected_component(board)
    current_color = board[(0, 0)]
    
    best_color = current_color
    max_new_size = len(current_blob)
    
    for color in range(6):
        if color == current_color:
            continue
            
        board_copy = board.copy()
        for (x, y) in current_blob:
            board_copy[(x, y)] = color
            
        new_blob_size = len(get_connected_component(board_copy))
        if new_blob_size > max_new_size:
            max_new_size = new_blob_size
            best_color = color
            
    # Failsafe: if no color adds new tiles, pick a random valid color to avoid getting stuck
    if best_color == current_color:
        valid_colors = [c for c in range(6) if c != current_color]
        best_color = random.choice(valid_colors)
        
    return best_color

def get_ai_solution(board):
    """Runs the Greedy AI silently in the background to find a solution path."""
    temp_board = board.copy()
    moves = []
    total_tiles = board_width * board_height
    
    while len(get_connected_component(temp_board)) < total_tiles:
        best_color = get_best_greedy_move(temp_board)
        moves.append(best_color)
        change_tile(temp_board, best_color)
        
    return moves


# ==========================================
# --- GAME EXECUTION ---
# ==========================================

welcome_ascii_art()
board = get_new_board()
initial_board = board.copy() # Save the exact starting state so we can replay it later

total_tiles = board_width * board_height

# 1. AI PRE-CALCULATION
clear_screen()
print("Calculating optimal AI path...")
ai_moves_sequence = get_ai_solution(initial_board)
ai_target_score = len(ai_moves_sequence)
time.sleep(1) # Dramatic pause

# 2. PLAYER'S TURN
player_moves = 0

while True:
    clear_screen()
    display_board(board)
    
    current_blob = get_connected_component(board)
    
    print(f"\nTarget Score (AI): {ai_target_score} moves")
    print(f"Your Moves: {player_moves}")
    print(f"Tiles captured: {len(current_blob)} / {total_tiles}\n")
    
    # Check win condition
    if len(current_blob) == total_tiles:
        break
        
    next_color = ask_for_player_move()
    
    # Only count a move if they actually changed the color
    if next_color != board[(0,0)]:
        change_tile(board, next_color)
        player_moves += 1

# 3. END GAME EVALUATION
clear_screen()
display_board(board)
print(f"\nBoard Solved! You took {player_moves} moves.")

if player_moves <= ai_target_score:
    bext.fg('green')
    print(f"INCREDIBLE! You beat the AI's target of {ai_target_score} moves! You are a genius.")
    bext.fg('white')
else:
    bext.fg('red')
    print(f"The AI solved it in {ai_target_score} moves. That's {player_moves - ai_target_score} moves fewer than you.")
    bext.fg('white')
    print("\nPress ENTER to watch the AI solve the original board...")
    input("> ")
    
    # 4. AI REPLAY ANIMATION
    board = initial_board.copy() # Restore original board
    
    for i, ai_color in enumerate(ai_moves_sequence):
        clear_screen()
        display_board(board)
        print(f"\nAI Replay: Move {i+1} / {ai_target_score}")
        print(f"AI chooses: {colors_map[ai_color].upper()}")
        time.sleep(0.7) # Adjust this for faster/slower playback
        
        change_tile(board, ai_color)
        
    # Show final solved AI board
    clear_screen()
    display_board(board)
    bext.fg('green')
    print(f"\nAI finished the board in exactly {ai_target_score} moves!")
    bext.fg('white')
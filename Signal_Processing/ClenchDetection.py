import sys
import time
import requests  # <--- NEW: Required for API calls
from pylsl import StreamInlet, resolve_streams

# Configuration for the Backend Server (FastAPI on port 8000)
API_URL = "http://127.0.0.1:8000/api/signal"

def send_signal(action_name):
    """
    Sends the action to the FastAPI backend on port 8000.
    Uses a short timeout to prevent blocking the data stream loop.
    """
    try:
        payload = {"action": action_name, "timestamp": time.time()}
        # timeout=0.2 ensures we don't lag the loop if the server is slow
        requests.post(API_URL, json=payload, timeout=0.2)
        print(f"\n>>> API SENT: {action_name}")
    except requests.exceptions.RequestException:
        print(f"\n>>> API ERROR: Could not connect to {API_URL}")

def main():
    print("Searching for streams...")
    streams = resolve_streams()
    if not streams:
        print("No streams found.")
        return

    for i, s in enumerate(streams):
        print(f"[{i}] Name: {s.name()} | Type: {s.type()}")

    try:
        choice = int(input("\nSelect stream index: "))
        selected_stream = streams[choice]
    except (ValueError, IndexError):
        sys.exit(1)

    inlet = StreamInlet(selected_stream)
    
    # --- TROUBLESHOOTING PARAMETERS ---
    # Adjust these based on the live "VAL" printed in the console
    THRESHOLD_HIGH = 0.9    # Point where clench is 'On'
    THRESHOLD_LOW = 0.5     # Point where clench is 'Off' (Must be > Equilibrium)
    HOLD_TIME = 2         # Seconds held to trigger 'HOLD'
    DOUBLE_GAP_MAX = 1.5    # Max seconds to wait for a 2nd clench
    # ----------------------------------

    # State Variables
    is_active = False
    start_high_time = 0
    end_high_time = 0
    waiting_for_second = False
    hold_triggered = False
    current_state_label = "IDLE"

    print(f"\nMonitoring {selected_stream.name()}...")
    print("Commands will print below. Live value is on the bottom line.\n")

    try:
        while True:
            sample, timestamp = inlet.pull_sample()
            if sample:
                # --- Your Processing Logic ---
                val = sample[0]
                if val < 0.5:
                    val = 0.5
                avg = (val - 0.5) * 2 
                # Note: equilibrium is now 0.0, max is 1.0
                
                current_time = time.time()

                # LOGIC ENGINE
                if avg > THRESHOLD_HIGH:
                    if not is_active:
                        # INITIAL CONTACT
                        is_active = True
                        start_high_time = current_time
                        current_state_label = "CLENCHING"
                        
                        if waiting_for_second:
                            print("\nACTION: DOUBLE CLENCH")
                            send_signal("DOWN")
                            waiting_for_second = False
                    
                    # HOLD DETECTION
                    if not hold_triggered and (current_time - start_high_time) > HOLD_TIME:
                        print("\nACTION: HOLD")
                        send_signal("SELECT")
                        hold_triggered = True
                        waiting_for_second = False 

                elif avg < THRESHOLD_LOW:
                    if is_active:
                        # RELEASE DETECTED
                        is_active = False
                        end_high_time = current_time
                        current_state_label = "IDLE"
                        
                        if not hold_triggered:
                            # Start waiting to see if it's a Single or the start of a Double
                            waiting_for_second = True
                            current_state_label = "WAITING (DOUBLE?)"
                        
                        hold_triggered = False 

                # SINGLE CLENCH TIMEOUT
                if waiting_for_second and not is_active:
                    gap_duration = current_time - end_high_time
                    if gap_duration > DOUBLE_GAP_MAX:
                        print("\nACTION: SINGLE CLENCH")
                        send_signal("RIGHT")
                        waiting_for_second = False
                        current_state_label = "IDLE"

                # LIVE MONITORING (Updates on one line)
                sys.stdout.write(f"\rVAL: {avg:.2f} | STATE: {current_state_label: <15}")
                sys.stdout.flush()

    except KeyboardInterrupt:
        print("\n\nStream stopped.")

if __name__ == "__main__":
    main()

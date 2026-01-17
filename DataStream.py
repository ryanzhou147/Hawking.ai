import time
import numpy as np
from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds

# ============================================
# Setup Ganglion Board
# ============================================
params = BrainFlowInputParams()
params.serial_port = "COM3"
board_id = BoardIds.GANGLION_BOARD.value  # Ganglion board

try:
    board = BoardShim(board_id, params)
    board.prepare_session()
    print("Successfully prepared Ganglion board")
except Exception as e:
    print(f"Error: {e}")
    print("Could not connect to Ganglion board on COM3")
    exit(1)

sampling_rate = board.get_sampling_rate(board_id)
print(f"Sampling rate: {sampling_rate} Hz")

eeg_channels = board.get_eeg_channels(board_id)
print(f"EEG Channels: {eeg_channels}")

# ============================================
# Running Statistics for Peak Detection
# ============================================
class RunningStats:
    def __init__(self):
        self.count = 0
        self.mean = 0.0
        self.M2 = 0.0  # For variance calculation
        self.std = 0.0
        
    def update(self, value):
        self.count += 1
        delta = value - self.mean
        self.mean += delta / self.count
        delta2 = value - self.mean
        self.M2 += delta * delta2
        
        if self.count > 1:
            self.std = np.sqrt(self.M2 / self.count)
        
    def is_peak(self, value):
        if self.count < 10:  # Need minimum samples for reliable stats
            return False
        z_score = abs(value - self.mean) / (self.std + 1e-6)
        return z_score >= 1.5

# Initialize running stats for each channel
running_stats = {i: RunningStats() for i in range(4)}

# ============================================
# Real-Time Signal Display with Peak Detection
# ============================================
update_interval = sampling_rate // 10  # Print 10 times per second

try:
    board.start_stream()
    print(f"\nStarting real-time signal monitoring...")
    print(f"Peak threshold: 1.5 standard deviations from running average")
    print("=" * 120)
    
    sample_counter = 0
    peak_count = 0
    
    while True:
        # Get latest data
        data = board.get_board_data()
        
        if data.shape[1] > 0:
            # Get only the latest sample for each channel
            latest_data = data[eeg_channels, -1]
            
            # Update running stats and check for peaks
            peak_detected = False
            for ch_idx, value in enumerate(latest_data):
                running_stats[ch_idx].update(value)
                if running_stats[ch_idx].is_peak(value):
                    peak_detected = True
                    peak_count += 1
            
            if peak_detected:
                print(f"[PEAK DETECTED #{peak_count}]", end="")
            
            sample_counter += 1
            
            # Print channel data with running averages 10 times per second
            if sample_counter % update_interval == 0:
                ch0, ch1, ch2, ch3 = latest_data[0], latest_data[1], latest_data[2], latest_data[3]
                avg0, avg1, avg2, avg3 = (running_stats[0].mean, running_stats[1].mean, 
                                          running_stats[2].mean, running_stats[3].mean)
                std0, std1, std2, std3 = (running_stats[0].std, running_stats[1].std, 
                                          running_stats[2].std, running_stats[3].std)
                
                peak_indicator = " <-- PEAK" if peak_detected else ""
                print(f"\nCh0: {ch0:8.2f}uV (avg:{avg0:8.2f}±{std0:6.2f}) | "
                      f"Ch1: {ch1:8.2f}uV (avg:{avg1:8.2f}±{std1:6.2f}) | "
                      f"Ch2: {ch2:8.2f}uV (avg:{avg2:8.2f}±{std2:6.2f}) | "
                      f"Ch3: {ch3:8.2f}uV (avg:{avg3:8.2f}±{std3:6.2f}){peak_indicator}")
        
        time.sleep(0.001)  # Small delay to avoid CPU overload

except KeyboardInterrupt:
    print("\n" + "=" * 120)
    print(f"Monitoring stopped. Total peaks detected: {peak_count}")

finally:
    board.stop_stream()
    board.release_session()
    print("Board connection closed")

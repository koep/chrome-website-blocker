/**
 * Blocked page script for Website Blocker.
 *
 * Displays a Pomodoro timer to help users stay focused.
 * Includes lofi music player integration.
 */

// Timer constants
const WORK_DURATION = 1500; // 25 minutes in seconds
const BREAK_DURATION = 300; // 5 minutes in seconds

// Music constants
const DEFAULT_VOLUME = 50;

// DOM elements
const timerModeEl = document.getElementById("timer-mode");
const timerDisplayEl = document.getElementById("timer-display");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");

// Music elements
const volumeSlider = document.getElementById("volume-slider");
const volumeDisplay = document.getElementById("volume-display");
const musicError = document.getElementById("music-error");
const musicStatus = document.getElementById("music-status");

// Music state
let currentTimerMode = 'idle';
let currentVolume = DEFAULT_VOLUME;

/**
 * Initialize Web Audio API for ambient music generation
 */
function initAudioPlayer() {
  try {
    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create master gain node
    let masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = 0; // Start muted
    
    let isPlaying = false;
    let melodyInterval = null;
    let currentNotes = [];
    
    // Lofi chord progressions (frequencies in Hz)
    const chords = [
      [261.63, 329.63, 392.00], // C major
      [293.66, 369.99, 440.00], // D minor
      [246.94, 311.13, 369.99], // G major
      [220.00, 277.18, 329.63]  // A minor
    ];
    
    let currentChordIndex = 0;
    
    // Play a single note with envelope
    function playNote(frequency, duration, startTime) {
      const osc = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.value = frequency + (Math.random() * 0.5 - 0.25); // Slight detune
      
      // Low-pass filter for warmth
      filter.type = 'lowpass';
      filter.frequency.value = 1000 + Math.random() * 500;
      filter.Q.value = 1;
      
      // ADSR envelope for smooth sound
      noteGain.gain.value = 0;
      noteGain.gain.setTargetAtTime(0.08, startTime, 0.02); // Attack
      noteGain.gain.setTargetAtTime(0.05, startTime + 0.1, 0.1); // Decay to sustain
      noteGain.gain.setTargetAtTime(0, startTime + duration - 0.1, 0.1); // Release
      
      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
      
      return osc;
    }
    
    // Create a gentle melody pattern
    function playMelodyPattern() {
      if (!isPlaying) return;
      
      const now = audioContext.currentTime;
      const chord = chords[currentChordIndex];
      
      // Play notes with rhythm (not all at once)
      chord.forEach((freq, index) => {
        const startTime = now + index * 0.15; // Stagger notes
        const duration = 2.0 + Math.random() * 0.5;
        playNote(freq, duration, startTime);
      });
      
      // Occasionally play higher melody note
      if (Math.random() > 0.4) {
        const melodyFreq = chord[Math.floor(Math.random() * chord.length)] * 2;
        playNote(melodyFreq, 1.5, now + 0.5);
      }
      
      // Move to next chord
      currentChordIndex = (currentChordIndex + 1) % chords.length;
    }
    
    // Load initial volume from storage
    chrome.storage.local.get('pomodoroState', (data) => {
      if (data.pomodoroState && data.pomodoroState.musicVolume !== undefined) {
        currentVolume = data.pomodoroState.musicVolume;
        volumeSlider.value = currentVolume;
        volumeDisplay.textContent = `${currentVolume}%`;
      }
      
      // Check if timer is already in work mode
      if (data.pomodoroState && data.pomodoroState.mode === 'work') {
        currentTimerMode = 'work';
        setTimeout(() => startMusic(), 500);
      }
    });
    
    // Store references for control
    window.audioPlayer = {
      context: audioContext,
      masterGain: masterGain,
      start: function() {
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        isPlaying = true;
        
        // Fade in master volume
        masterGain.gain.setTargetAtTime(currentVolume / 100, audioContext.currentTime, 0.5);
        
        // Start melody loop - play new notes every 3 seconds
        playMelodyPattern(); // Play immediately
        melodyInterval = setInterval(playMelodyPattern, 3000);
      },
      stop: function() {
        isPlaying = false;
        
        // Fade out
        masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.5);
        
        // Stop melody loop
        if (melodyInterval) {
          clearInterval(melodyInterval);
          melodyInterval = null;
        }
      },
      setVolume: function(volume) {
        if (isPlaying && masterGain.gain.value > 0) {
          masterGain.gain.setTargetAtTime(volume / 100, audioContext.currentTime, 0.1);
        }
      }
    };
    
    hideMusicError();
    console.log('[Music] Web Audio player initialized');
  } catch (error) {
    console.error('[Music] Error initializing audio player:', error);
    showMusicError('Audio player failed to initialize.');
  }
}

/**
 * Show error message in music section
 */
function showMusicError(message) {
  if (musicError) {
    musicError.textContent = message;
    musicError.style.display = 'block';
  }
}

/**
 * Hide error message
 */
function hideMusicError() {
  if (musicError) {
    musicError.style.display = 'none';
  }
}

/**
 * Start playing music
 */
function startMusic() {
  if (window.audioPlayer) {
    window.audioPlayer.start();
    
    // Update status
    if (musicStatus) {
      musicStatus.textContent = 'Playing';
      musicStatus.classList.add('playing');
    }
    
    console.log('[Music] Started playing at volume', currentVolume);
    hideMusicError();
  }
}

/**
 * Stop playing music
 */
function stopMusic() {
  if (window.audioPlayer) {
    window.audioPlayer.stop();
    
    // Update status
    if (musicStatus) {
      musicStatus.textContent = 'Paused';
      musicStatus.classList.remove('playing');
    }
    
    console.log('[Music] Stopped playing');
  }
}

/**
 * Handle volume slider changes
 */
function handleVolumeChange() {
  currentVolume = parseInt(volumeSlider.value, 10);
  volumeDisplay.textContent = `${currentVolume}%`;
  
  // Update audio volume
  if (window.audioPlayer) {
    window.audioPlayer.setVolume(currentVolume);
  }
  
  // Persist volume to storage
  chrome.storage.local.get('pomodoroState', (data) => {
    const state = data.pomodoroState || {};
    state.musicVolume = currentVolume;
    chrome.storage.local.set({ pomodoroState: state });
  });
}

/**
 * Handle timer state changes for music control
 */
function handleMusicForTimerState(mode) {
  // Only play music during work sessions
  if (mode === 'work' && currentTimerMode !== 'work') {
    startMusic();
  } else if (mode !== 'work' && currentTimerMode === 'work') {
    stopMusic();
  }
  
  currentTimerMode = mode;
}

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update the timer display based on current state
 */
function updateTimerDisplay(state) {
  if (!state || !state.pomodoroState) {
    // Default idle state
    timerModeEl.textContent = "Ready to Focus";
    timerDisplayEl.textContent = formatTime(WORK_DURATION);
    startBtn.style.display = "inline-block";
    pauseBtn.style.display = "none";
    handleMusicForTimerState('idle');
    return;
  }

  const { mode, timeRemaining } = state.pomodoroState;
  
  // Handle music control based on mode
  handleMusicForTimerState(mode);
  
  // Update mode text and display styling
  switch (mode) {
    case 'work':
      timerModeEl.textContent = "Work Session";
      timerModeEl.className = "timer-mode work";
      startBtn.style.display = "none";
      pauseBtn.style.display = "inline-block";
      break;
    case 'break':
      timerModeEl.textContent = "Break Time";
      timerModeEl.className = "timer-mode break";
      startBtn.style.display = "none";
      pauseBtn.style.display = "inline-block";
      break;
    case 'work-paused':
      timerModeEl.textContent = "Work Session (Paused)";
      timerModeEl.className = "timer-mode paused";
      startBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      break;
    case 'break-paused':
      timerModeEl.textContent = "Break Time (Paused)";
      timerModeEl.className = "timer-mode break paused";
      startBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      break;
    case 'idle':
    default:
      timerModeEl.textContent = "Ready to Focus";
      timerModeEl.className = "timer-mode";
      startBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      break;
  }
  
  // Update time display
  timerDisplayEl.textContent = formatTime(timeRemaining);
}

/**
 * Send a command to the background script
 */
function sendTimerCommand(command) {
  chrome.runtime.sendMessage({ action: command }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Timer] Error sending command:', chrome.runtime.lastError);
    }
  });
}

/**
 * Initialize timer from storage
 */
async function initTimer() {
  try {
    const data = await chrome.storage.local.get('pomodoroState');
    updateTimerDisplay(data);
  } catch (error) {
    console.error('[Timer] Error initializing:', error);
    updateTimerDisplay(null);
  }
}

// Button event listeners
startBtn.addEventListener("click", () => sendTimerCommand('start'));
pauseBtn.addEventListener("click", () => sendTimerCommand('pause'));
resetBtn.addEventListener("click", () => sendTimerCommand('reset'));

// Volume slider event listener
volumeSlider.addEventListener("input", handleVolumeChange);

// Listen for storage changes to update UI
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pomodoroState) {
    updateTimerDisplay({ pomodoroState: changes.pomodoroState.newValue });
  }
});

// Initialize on page load
initTimer();

// Initialize Web Audio player for ambient music
initAudioPlayer();

// Show which site was blocked
const params = new URLSearchParams(window.location.search);
const site = params.get("site");
const blockedSiteEl = document.getElementById("blocked-site");
if (site) {
  blockedSiteEl.textContent = `${site} is blocked.`;
} else {
  blockedSiteEl.textContent = "This site is blocked.";
}

// Go Back button
document.getElementById("go-back").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});

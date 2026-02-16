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
const LOFI_VIDEO_ID = 'jfKfPfyJRdk'; // Lofi Girl 24/7 stream

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
const youtubeIframe = document.getElementById("youtube-player");
const musicStatus = document.getElementById("music-status");

// Music state
let currentTimerMode = 'idle';
let currentVolume = DEFAULT_VOLUME;

/**
 * Initialize YouTube iframe with embedded player
 */
function initYouTubePlayer() {
  try {
    // Build YouTube embed URL with API control enabled
    // Setting mute=0 to ensure it's not muted by default
    const embedUrl = `https://www.youtube.com/embed/${LOFI_VIDEO_ID}?enablejsapi=1&autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&loop=1&playlist=${LOFI_VIDEO_ID}&mute=0`;
    youtubeIframe.src = embedUrl;
    
    // Wait for iframe to load
    youtubeIframe.addEventListener('load', () => {
      console.log('[Music] Iframe loaded');
      
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
          // Start music after iframe loads (give it extra time to initialize)
          setTimeout(() => startMusic(), 2000);
        }
      });
    });
    
    hideMusicError();
  } catch (error) {
    console.error('[Music] Error initializing YouTube player:', error);
    showMusicError('Music player failed to initialize.');
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
 * Send command to YouTube iframe using postMessage
 */
function sendYouTubeCommand(command, args = []) {
  try {
    if (youtubeIframe && youtubeIframe.contentWindow) {
      const message = JSON.stringify({
        event: 'command',
        func: command,
        args: args
      });
      youtubeIframe.contentWindow.postMessage(message, '*');
      console.log('[Music] Sent command:', command, args);
    }
  } catch (error) {
    console.error('[Music] Error sending YouTube command:', error);
  }
}

/**
 * Start playing music
 */
function startMusic() {
  // Unmute first (in case it was muted)
  sendYouTubeCommand('unMute');
  
  // Set volume
  setTimeout(() => {
    sendYouTubeCommand('setVolume', [currentVolume]);
  }, 100);
  
  // Play video
  setTimeout(() => {
    sendYouTubeCommand('playVideo');
  }, 200);
  
  // Update status
  if (musicStatus) {
    musicStatus.textContent = 'Playing';
    musicStatus.classList.add('playing');
  }
  
  console.log('[Music] Started playing at volume', currentVolume);
  hideMusicError();
}

/**
 * Stop playing music
 */
function stopMusic() {
  sendYouTubeCommand('pauseVideo');
  
  // Update status
  if (musicStatus) {
    musicStatus.textContent = 'Paused';
    musicStatus.classList.remove('playing');
  }
  
  console.log('[Music] Stopped playing');
}

/**
 * Handle volume slider changes
 */
function handleVolumeChange() {
  currentVolume = parseInt(volumeSlider.value, 10);
  volumeDisplay.textContent = `${currentVolume}%`;
  
  // Update YouTube player volume
  sendYouTubeCommand('setVolume', [currentVolume]);
  
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

// Initialize YouTube player
initYouTubePlayer();

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

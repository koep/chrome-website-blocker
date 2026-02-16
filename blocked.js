/**
 * Blocked page script for Website Blocker.
 *
 * Displays a Pomodoro timer to help users stay focused.
 */

// Timer constants
const WORK_DURATION = 1500; // 25 minutes in seconds
const BREAK_DURATION = 300; // 5 minutes in seconds

// DOM elements
const timerModeEl = document.getElementById("timer-mode");
const timerDisplayEl = document.getElementById("timer-display");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");

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
    return;
  }

  const { mode, timeRemaining } = state.pomodoroState;
  
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

// Listen for storage changes to update UI
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pomodoroState) {
    updateTimerDisplay({ pomodoroState: changes.pomodoroState.newValue });
  }
});

// Initialize on page load
initTimer();

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

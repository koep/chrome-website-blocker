/**
 * Background service worker for Website Blocker.
 *
 * Listens for changes to the blockedSites list in chrome.storage.sync
 * and keeps declarativeNetRequest dynamic redirect rules in sync.
 */

/**
 * Get or create a unique rule ID for a domain.
 * Uses a persistent mapping in storage to prevent collisions.
 */
async function getDomainRuleId(domain) {
  try {
    const data = await chrome.storage.local.get({ 
      domainIdMap: {}, 
      nextRuleId: 1 
    });
    
    // If this domain already has an ID, return it
    if (data.domainIdMap[domain]) {
      return data.domainIdMap[domain];
    }
    
    // Otherwise, assign the next available ID
    const newId = data.nextRuleId;
    data.domainIdMap[domain] = newId;
    data.nextRuleId = newId + 1;
    
    await chrome.storage.local.set({
      domainIdMap: data.domainIdMap,
      nextRuleId: data.nextRuleId
    });
    
    return newId;
  } catch (error) {
    console.error('[Website Blocker] Error getting rule ID:', error);
    // Fallback to a basic hash if storage fails
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = (hash * 31 + domain.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % (1 << 30)) + 1;
  }
}

/**
 * Build a declarativeNetRequest redirect rule for a given domain.
 */
function buildRule(domain, ruleId) {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked.html?site=${encodeURIComponent(domain)}`
      }
    },
    condition: {
      // Use ^^ to match domain boundary (prevents subdomain false positives)
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"]
    }
  };
}

/**
 * Sync the declarativeNetRequest dynamic rules with the current blockedSites list.
 */
async function syncRules(blockedSites) {
  try {
    // Get all existing dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map((r) => r.id);

    // Build the new set of rules with collision-resistant IDs
    const newRules = await Promise.all(
      blockedSites.map(async (domain) => {
        const ruleId = await getDomainRuleId(domain);
        return buildRule(domain, ruleId);
      })
    );

    // Remove all existing rules, then add the new ones
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: newRules
    });

    console.log(
      `[Website Blocker] Rules synced: ${newRules.length} site(s) blocked.`
    );
  } catch (error) {
    console.error('[Website Blocker] Error syncing rules:', error);
  }
}

// Listen for changes to storage and re-sync rules
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedSites) {
    syncRules(changes.blockedSites.newValue || []).catch((error) => {
      console.error('[Website Blocker] Error in storage change listener:', error);
    });
  }
});

// On install / update, sync rules from current storage
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.sync.get({ blockedSites: [] });
    await syncRules(data.blockedSites);
  } catch (error) {
    console.error('[Website Blocker] Error on install:', error);
  }
});

// Also sync on service worker startup (covers browser restart)
chrome.storage.sync.get({ blockedSites: [] })
  .then((data) => syncRules(data.blockedSites))
  .catch((error) => {
    console.error('[Website Blocker] Error on startup:', error);
  });

/**
 * ============================================================================
 * POMODORO TIMER FUNCTIONALITY
 * ============================================================================
 */

const WORK_DURATION = 1500; // 25 minutes
const BREAK_DURATION = 300; // 5 minutes
const TIMER_ALARM_NAME = 'pomodoroTick';

/**
 * Initialize timer state
 */
async function initTimerState() {
  try {
    const data = await chrome.storage.local.get('pomodoroState');
    if (!data.pomodoroState) {
      await chrome.storage.local.set({
        pomodoroState: {
          mode: 'idle',
          timeRemaining: WORK_DURATION,
          workDuration: WORK_DURATION,
          breakDuration: BREAK_DURATION,
          musicEnabled: true,
          musicVolume: 50,
          lastUpdate: Date.now()
        }
      });
    } else {
      // Ensure music properties exist for existing users
      const state = data.pomodoroState;
      let needsUpdate = false;
      
      if (state.musicEnabled === undefined) {
        state.musicEnabled = true;
        needsUpdate = true;
      }
      
      if (state.musicVolume === undefined) {
        state.musicVolume = 50;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await chrome.storage.local.set({ pomodoroState: state });
      }
    }
  } catch (error) {
    console.error('[Timer] Error initializing state:', error);
  }
}

/**
 * Get current timer state
 */
async function getTimerState() {
  const data = await chrome.storage.local.get('pomodoroState');
  return data.pomodoroState || {
    mode: 'idle',
    timeRemaining: WORK_DURATION,
    workDuration: WORK_DURATION,
    breakDuration: BREAK_DURATION,
    lastUpdate: Date.now()
  };
}

/**
 * Update timer state
 */
async function updateTimerState(updates) {
  const currentState = await getTimerState();
  const newState = {
    ...currentState,
    ...updates,
    lastUpdate: Date.now()
  };
  await chrome.storage.local.set({ pomodoroState: newState });
  return newState;
}

/**
 * Start the timer
 */
async function startTimer() {
  const state = await getTimerState();
  
  // If idle, start a new work session
  if (state.mode === 'idle') {
    await updateTimerState({
      mode: 'work',
      timeRemaining: state.workDuration
    });
  } else if (state.mode === 'work-paused') {
    // Resume work session
    await updateTimerState({ mode: 'work' });
  } else if (state.mode === 'break-paused') {
    // Resume break
    await updateTimerState({ mode: 'break' });
  }
  
  // Create alarm for ticking
  await chrome.alarms.create(TIMER_ALARM_NAME, {
    delayInMinutes: 0,
    periodInMinutes: 1 / 60 // 1 second
  });
  
  console.log('[Timer] Started');
}

/**
 * Pause the timer
 */
async function pauseTimer() {
  const state = await getTimerState();
  
  if (state.mode === 'work') {
    await updateTimerState({ mode: 'work-paused' });
  } else if (state.mode === 'break') {
    await updateTimerState({ mode: 'break-paused' });
  }
  
  // Clear the alarm
  await chrome.alarms.clear(TIMER_ALARM_NAME);
  console.log('[Timer] Paused');
}

/**
 * Reset the timer
 */
async function resetTimer() {
  await chrome.alarms.clear(TIMER_ALARM_NAME);
  await updateTimerState({
    mode: 'idle',
    timeRemaining: WORK_DURATION
  });
  console.log('[Timer] Reset');
}

/**
 * Transition between work and break modes
 */
async function transitionMode(currentState) {
  if (currentState.mode === 'work') {
    // Work session complete, start break
    await updateTimerState({
      mode: 'break',
      timeRemaining: currentState.breakDuration
    });
    console.log('[Timer] Transitioning to break');
  } else if (currentState.mode === 'break') {
    // Break complete, start new work session
    await updateTimerState({
      mode: 'work',
      timeRemaining: currentState.workDuration
    });
    console.log('[Timer] Transitioning to work');
  }
}

/**
 * Handle timer tick
 */
async function handleTimerTick(alarm) {
  if (alarm.name !== TIMER_ALARM_NAME) return;
  
  try {
    const state = await getTimerState();
    
    // Only tick if timer is running
    if (state.mode !== 'work' && state.mode !== 'break') {
      await chrome.alarms.clear(TIMER_ALARM_NAME);
      return;
    }
    
    // Decrement time
    const newTime = Math.max(0, state.timeRemaining - 1);
    
    if (newTime === 0) {
      // Time's up, transition modes
      await transitionMode(state);
    } else {
      // Update time remaining
      await updateTimerState({ timeRemaining: newTime });
    }
  } catch (error) {
    console.error('[Timer] Error in tick handler:', error);
  }
}

/**
 * Handle timer commands from blocked page
 */
function handleTimerCommand(message, sender, sendResponse) {
  if (!message.action) return;
  
  switch (message.action) {
    case 'start':
      startTimer()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('[Timer] Error starting:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
      
    case 'pause':
      pauseTimer()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('[Timer] Error pausing:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
      
    case 'reset':
      resetTimer()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('[Timer] Error resetting:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
  }
}

// Initialize timer state on startup
initTimerState().catch((error) => {
  console.error('[Timer] Error during initialization:', error);
});

// Listen for timer commands
chrome.runtime.onMessage.addListener(handleTimerCommand);

// Listen for timer ticks
chrome.alarms.onAlarm.addListener(handleTimerTick);

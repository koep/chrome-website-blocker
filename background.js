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
 * Get blockedSites minus any domain that is temporarily allowed (and not expired).
 * Prunes expired entries from temporaryAllows and persists.
 */
async function getEffectiveBlockedSites() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get({ blockedSites: [] }),
    chrome.storage.local.get({ temporaryAllows: {} })
  ]);
  const blockedSites = syncData.blockedSites || [];
  let temporaryAllows = localData.temporaryAllows || {};
  const now = Date.now();

  // Prune expired entries
  const pruned = { ...temporaryAllows };
  let changed = false;
  for (const domain of Object.keys(pruned)) {
    if (pruned[domain] <= now) {
      delete pruned[domain];
      changed = true;
    }
  }
  if (changed) {
    temporaryAllows = pruned;
    await chrome.storage.local.set({ temporaryAllows });
  }

  return blockedSites.filter((domain) => !(temporaryAllows[domain] > now));
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

/**
 * Schedule the "reblock" alarm for the soonest expiry in temporaryAllows.
 */
async function scheduleReblockAlarm() {
  const data = await chrome.storage.local.get({ temporaryAllows: {} });
  const temporaryAllows = data.temporaryAllows || {};
  const now = Date.now();
  let soonest = null;
  for (const domain of Object.keys(temporaryAllows)) {
    const expiry = temporaryAllows[domain];
    if (expiry > now && (soonest === null || expiry < soonest)) {
      soonest = expiry;
    }
  }
  if (soonest !== null) {
    await chrome.alarms.create("reblock", { when: soonest });
  } else {
    await chrome.alarms.clear("reblock");
  }
}

// Listen for changes to storage and re-sync rules
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedSites) {
    getEffectiveBlockedSites()
      .then(syncRules)
      .catch((error) => {
        console.error('[Website Blocker] Error in storage change listener:', error);
      });
  }
});

// On install / update, sync rules from current storage
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const effective = await getEffectiveBlockedSites();
    await syncRules(effective);
  } catch (error) {
    console.error('[Website Blocker] Error on install:', error);
  }
});

// Also sync on service worker startup (covers browser restart)
getEffectiveBlockedSites()
  .then(syncRules)
  .catch((error) => {
    console.error('[Website Blocker] Error on startup:', error);
  });

// Message from blocked page: allow this site for 5 minutes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "allowFiveMinutes" || typeof message.site !== "string") {
    return;
  }
  const raw = message.site.trim().toLowerCase();
  const domain = raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(":")[0]
    .split("/")[0]
    .split("?")[0]
    .split("#")[0];
  if (!domain || domain.includes("/") || domain.includes(" ")) {
    sendResponse({ ok: false, error: "invalid domain" });
    return true;
  }
  (async () => {
    try {
      const data = await chrome.storage.local.get({ temporaryAllows: {} });
      const temporaryAllows = data.temporaryAllows || {};
      const expiry = Date.now() + 5 * 60 * 1000;
      temporaryAllows[domain] = expiry;
      await chrome.storage.local.set({ temporaryAllows });
      await scheduleReblockAlarm();
      const effective = await getEffectiveBlockedSites();
      await syncRules(effective);
      // Navigate from background so the request uses the updated rules
      const tabId = sender.tab?.id;
      if (tabId) {
        await chrome.tabs.update(tabId, { url: "https://" + domain });
      }
      sendResponse({ ok: true, navigated: !!tabId });
    } catch (error) {
      console.error('[Website Blocker] Error allowing five minutes:', error);
      sendResponse({ ok: false, error: String(error) });
    }
  })();
  return true;
});

// Re-block when temporary allow expires
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "reblock") return;
  try {
    const effective = await getEffectiveBlockedSites();
    await syncRules(effective);
    await scheduleReblockAlarm();
  } catch (error) {
    console.error('[Website Blocker] Error on reblock alarm:', error);
  }
});

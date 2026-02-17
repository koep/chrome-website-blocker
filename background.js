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

/**
 * Blocked page script for Website Blocker.
 *
 * Displays a motivational quote and blocked site information.
 */

const quotes = [
  "The secret of getting ahead is getting started.",
  "Focus on being productive instead of busy.",
  "It's not about having time. It's about making time.",
  "Don't watch the clock; do what it does. Keep going.",
  "Your future self will thank you.",
  "Small disciplines repeated with consistency lead to great achievements.",
  "Discipline is choosing between what you want now and what you want most.",
  "You don't have to be extreme, just consistent.",
  "The best time to start was yesterday. The next best time is now.",
  "What you do today can improve all your tomorrows."
];

// Show a random quote
const quoteEl = document.getElementById("quote");
quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];

// Show which site was blocked
const params = new URLSearchParams(window.location.search);
const site = params.get("site");
const blockedSiteEl = document.getElementById("blocked-site");
if (site) {
  blockedSiteEl.textContent = `${site} is blocked.`;
  recordBlockStats(site);
} else {
  blockedSiteEl.textContent = "This site is blocked.";
}

/**
 * Record one block event for the given domain in chrome.storage.local.
 * Stores daily counts per domain and prunes dates older than 30 days.
 */
function recordBlockStats(domain) {
  if (!domain || typeof domain !== "string" || domain.trim() === "") return;
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  chrome.storage.local.get({ blockStats: {} }, (data) => {
    const stats = data.blockStats;
    if (!stats[domain]) stats[domain] = {};
    stats[domain][today] = (stats[domain][today] || 0) + 1;

    // Prune dates older than 30 days (all domains)
    for (const d of Object.keys(stats)) {
      const dates = stats[d];
      for (const dateKey of Object.keys(dates)) {
        if (dateKey < cutoffStr) delete dates[dateKey];
      }
      if (Object.keys(dates).length === 0) delete stats[d];
    }

    chrome.storage.local.set({ blockStats: stats });
  });
}

// Go Back button
document.getElementById("go-back").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});

// Five more minutes button
document.getElementById("five-more").addEventListener("click", () => {
  if (!site) {
    return;
  }
  const btn = document.getElementById("five-more");
  btn.disabled = true;
  btn.textContent = "…";
  chrome.runtime.sendMessage({ action: "allowFiveMinutes", site }, (response) => {
    if (chrome.runtime.lastError) {
      btn.disabled = false;
      btn.textContent = "Five more minutes";
      return;
    }
    if (response && response.ok) {
      // Background navigates the tab; fallback if it didn't (e.g. no sender.tab)
      if (!response.navigated) {
        window.location.href = "https://" + site;
      }
    } else {
      btn.disabled = false;
      btn.textContent = "Five more minutes";
    }
  });
});

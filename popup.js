/**
 * Popup script for Website Blocker.
 *
 * Manages the UI for adding/removing blocked domains
 * and persists the list to chrome.storage.sync.
 */

const form = document.getElementById("add-form");
const input = document.getElementById("domain-input");
const siteList = document.getElementById("site-list");
const emptyMsg = document.getElementById("empty-msg");

// Constants
const PLACEHOLDER_RESET_MS = 1500;
const SUCCESS_FEEDBACK_MS = 300;

/**
 * Normalize user input to a bare domain (strip protocol, path, port, whitespace).
 * Handles edge cases like ports, www prefix, and various URL formats.
 */
function normalizeDomain(raw) {
  let domain = raw.trim().toLowerCase();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//, "");
  // Strip www.
  domain = domain.replace(/^www\./, "");
  // Strip port number (e.g., :8080)
  domain = domain.split(":")[0];
  // Strip path, query, hash
  domain = domain.split("/")[0];
  domain = domain.split("?")[0];
  domain = domain.split("#")[0];
  return domain;
}

/**
 * Validate domain format using regex.
 * Returns true if domain is valid, false otherwise.
 */
function isValidDomain(domain) {
  // Domain must have at least one dot and valid TLD structure
  // Allows alphanumeric, hyphens, and dots
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
  return domain && domainRegex.test(domain);
}

/**
 * Show error message in input placeholder.
 */
function showError(message) {
  input.placeholder = message;
  input.classList.add("error");
  setTimeout(() => {
    input.placeholder = "e.g. reddit.com";
    input.classList.remove("error");
  }, PLACEHOLDER_RESET_MS);
}

/**
 * Show success feedback with green flash.
 */
function showSuccess() {
  input.classList.add("success");
  setTimeout(() => {
    input.classList.remove("success");
  }, SUCCESS_FEEDBACK_MS);
}

/**
 * Render the list of blocked sites in the popup.
 */
function renderList(sites) {
  siteList.innerHTML = "";

  if (sites.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  sites.forEach((domain) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "domain";
    span.textContent = domain;

    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "\u00d7"; // multiplication sign (×)
    btn.title = `Unblock ${domain}`;
    btn.setAttribute("aria-label", `Remove ${domain} from blocklist`);
    btn.addEventListener("click", () => removeSite(domain));

    li.appendChild(span);
    li.appendChild(btn);
    siteList.appendChild(li);
  });
}

/**
 * Add a domain to the blocked list.
 */
async function addSite(domain) {
  try {
    const data = await chrome.storage.sync.get({ blockedSites: [] });
    const sites = data.blockedSites;

    if (sites.includes(domain)) {
      // Already blocked — just flash the input
      input.value = "";
      showError("Already blocked!");
      return;
    }

    sites.push(domain);
    sites.sort();
    
    try {
      await chrome.storage.sync.set({ blockedSites: sites });
      renderList(sites);
      showSuccess();
    } catch (storageError) {
      // Handle quota exceeded or other storage errors
      console.error('[Website Blocker] Storage error:', storageError);
      if (storageError.message && storageError.message.includes('QUOTA')) {
        showError("Storage quota exceeded!");
      } else {
        showError("Failed to save. Try again.");
      }
      // Revert the local change
      sites.pop();
    }
  } catch (error) {
    console.error('[Website Blocker] Error adding site:', error);
    showError("An error occurred");
  }
}

/**
 * Remove a domain from the blocked list.
 */
async function removeSite(domain) {
  try {
    const data = await chrome.storage.sync.get({ blockedSites: [] });
    const sites = data.blockedSites.filter((d) => d !== domain);
    
    await chrome.storage.sync.set({ blockedSites: sites });
    renderList(sites);
  } catch (error) {
    console.error('[Website Blocker] Error removing site:', error);
    showError("Failed to remove site");
  }
}

// Handle form submission
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const domain = normalizeDomain(input.value);
  
  // Validate domain format
  if (!isValidDomain(domain)) {
    showError("Enter a valid domain");
    return;
  }
  
  addSite(domain);
  input.value = "";
  input.focus();
});

// Open block statistics page in a new tab
document.getElementById("stats-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") });
});

/**
 * Get the current active tab's domain and populate the input field.
 */
async function prefillCurrentDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      // Only prefill for http/https URLs (not chrome://, chrome-extension://, etc.)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const domain = normalizeDomain(url.hostname);
        if (isValidDomain(domain)) {
          input.value = domain;
          input.select(); // Select the text so user can easily replace it
        }
      }
    }
  } catch (error) {
    console.error('[Website Blocker] Error getting current tab:', error);
    // Silently fail - user can still manually enter a domain
  }
}

// Load and render the list on popup open, then prefill current domain
chrome.storage.sync.get({ blockedSites: [] })
  .then((data) => {
    renderList(data.blockedSites);
    return prefillCurrentDomain();
  })
  .catch((error) => {
    console.error('[Website Blocker] Error loading sites:', error);
    emptyMsg.textContent = "Error loading blocked sites";
    emptyMsg.classList.remove("hidden");
  });

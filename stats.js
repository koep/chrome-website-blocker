/**
 * Block statistics page for Website Blocker.
 *
 * Reads blockStats from chrome.storage.local and displays
 * summary totals and per-domain breakdown over time.
 */

const STATS_KEY = "blockStats";

/**
 * Return YYYY-MM-DD for a given date.
 */
function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Return an array of date keys for the last N days (including today).
 */
function lastNDays(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(dateKey(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

/**
 * Sum count for a domain over an array of date keys.
 */
function sumForDates(domainData, dateKeys) {
  let sum = 0;
  for (const key of dateKeys) {
    sum += domainData[key] || 0;
  }
  return sum;
}

/**
 * Aggregate blockStats into per-domain totals for today, last 7, last 30.
 */
function aggregate(stats) {
  const today = dateKey(new Date());
  const last7 = lastNDays(7);
  const last30 = lastNDays(30);

  const byDomain = [];
  for (const [domain, dates] of Object.entries(stats)) {
    if (!dates || typeof dates !== "object") continue;
    const todayCount = dates[today] || 0;
    const last7Count = sumForDates(dates, last7);
    const last30Count = sumForDates(dates, last30);
    if (todayCount === 0 && last7Count === 0 && last30Count === 0) continue;
    byDomain.push({
      domain,
      today: todayCount,
      last7: last7Count,
      last30: last30Count,
      dates,
    });
  }

  byDomain.sort((a, b) => b.last30 - a.last30);

  const totalToday = byDomain.reduce((s, r) => s + r.today, 0);
  const totalLast7 = byDomain.reduce((s, r) => s + r.last7, 0);
  const totalLast30 = byDomain.reduce((s, r) => s + r.last30, 0);

  return {
    summary: { totalToday, totalLast7, totalLast30 },
    byDomain,
  };
}

/**
 * Render summary line and table.
 */
function render(aggregated) {
  const { summary, byDomain } = aggregated;
  const statTodayEl = document.getElementById("stat-today");
  const statLast7El = document.getElementById("stat-last7");
  const statLast30El = document.getElementById("stat-last30");
  const tbody = document.getElementById("stats-tbody");
  const noDataEl = document.getElementById("no-data");
  const tableSection = document.getElementById("table-section");

  statTodayEl.textContent = summary.totalToday;
  statLast7El.textContent = summary.totalLast7;
  statLast30El.textContent = summary.totalLast30;
  statTodayEl.parentElement.title = `${summary.totalToday} block${summary.totalToday !== 1 ? "s" : ""} today`;
  statLast7El.parentElement.title = `${summary.totalLast7} block${summary.totalLast7 !== 1 ? "s" : ""} in last 7 days`;
  statLast30El.parentElement.title = `${summary.totalLast30} block${summary.totalLast30 !== 1 ? "s" : ""} in last 30 days`;

  if (byDomain.length === 0) {
    noDataEl.classList.remove("hidden");
    tableSection.classList.add("hidden");
    return;
  }

  noDataEl.classList.add("hidden");
  tableSection.classList.remove("hidden");

  const maxLast30 = Math.max(1, ...byDomain.map((r) => r.last30));

  tbody.innerHTML = "";
  byDomain.forEach((row, index) => {
    const tr = document.createElement("tr");
    const isTop = index === 0;
    if (isTop) tr.classList.add("top-domain");
    const barPct = Math.round((row.last30 / maxLast30) * 100);
    tr.innerHTML = `
      <td class="domain">${escapeHtml(row.domain)}</td>
      <td class="count">${row.today}</td>
      <td class="count">${row.last7}</td>
      <td class="count count-with-bar">
        <div class="cell-bar-wrap" title="${row.last30} block${row.last30 !== 1 ? "s" : ""} in last 30 days">
          <div class="cell-bar" style="width: ${barPct}%"></div>
          <span class="cell-count">${row.last30}</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load stats from storage and render.
 */
function loadAndRender() {
  chrome.storage.local.get({ [STATS_KEY]: {} }, (data) => {
    const stats = data[STATS_KEY];
    const aggregated = aggregate(stats);
    render(aggregated);
  });
}

loadAndRender();

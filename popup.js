// popup.js — Doucite v3.9.1 UI

(async function () {
  const titleEl = document.getElementById("title");
  const authorsEl = document.getElementById("authors");
  const dateEl = document.getElementById("date");
  const publisherEl = document.getElementById("publisher");
  const urlEl = document.getElementById("url");
  const doiEl = document.getElementById("doi");
  const output = document.getElementById("output");
  const statusEl = document.getElementById("status");
  const detectedEl = document.getElementById("detected");
  const metaInfoEl = document.getElementById("meta-info");
  const dateSourceEl = document.getElementById("date-source");
  const applyBtn = document.getElementById("apply");
  const copyBtn = document.getElementById("copy");
  const rescanBtn = document.getElementById("rescan");
  const openGithubBtn = document.getElementById("open-github");

  async function getActiveTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }
  async function injectIfNeeded(tabId) { try { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); } catch {} }

  async function fetchData(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res && res.ok && res.data) return res.data;
    } catch {}
    await injectIfNeeded(tabId);
    try {
      const res2 = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res2 && res2.ok && res2.data) return res2.data;
    } catch {}
    return {};
  }

  function hydrateFields(d) {
    titleEl.value = d.title || "";
    authorsEl.value = (d.authors && d.authors.length) ? d.authors.join(", ") : "";
    dateEl.value = d.publishedDate || d.publishedVisible || "";
    publisherEl.value = d.publisher || "";
    urlEl.value = d.url || "";
    if (doiEl) doiEl.value = d.doi || "";

    detectedEl.innerHTML = "";
    // --- FIX: join detected bylines with ", " ---
    const vis = d.visibleBylineRaw
      ? Array.isArray(d.visibleBylineRaw)
        ? d.visibleBylineRaw
        : String(d.visibleBylineRaw).split(/,|;| and | & |\|/).map(s => s.trim()).filter(Boolean)
      : (d.authors && d.authors.length ? d.authors : []);
    if (vis && vis.length) {
      const label = document.createElement("div"); label.textContent = "Visible bylines detected:";
      detectedEl.appendChild(label);
      vis.forEach((v, idx) => {
        const btn = document.createElement("button"); btn.type="button"; btn.textContent = v; btn.style.margin = "6px 6px 6px 0";
        btn.addEventListener("click", () => {
          authorsEl.value = v;
          statusEl.textContent = "Imported visible byline";
          setTimeout(()=>statusEl.textContent="",900);
        });
        detectedEl.appendChild(btn);
        // Add comma and space between buttons for clarity
        if (idx < vis.length - 1) {
          detectedEl.appendChild(document.createTextNode(", "));
        }
      });
    } else {
      const label = document.createElement("div"); label.textContent = "No visible byline found; using metadata or title fallback.";
      detectedEl.appendChild(label);
    }

    metaInfoEl.textContent = d.authorSource ? `Author source: ${d.authorSource}` : "";
    dateSourceEl.textContent = d.dateSource ? `Date source: ${d.dateSource}` : "Date source: none detected";

    refreshPreview();
  }

  function authorsFromInput(val) { return String(val||"").split(",").map(s=>s.trim()).filter(Boolean); }

  function formatNameAPA(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    if (/,/.test(name)) return name;
    const last = parts.pop();
    const initials = parts.map(p => p[0] ? p[0].toUpperCase() + "." : "").join(" ").trim();
    return initials ? `${last}, ${initials}` : last;
  }

  function isLikelyOrganization(name) {
    const clean = String(name||"").trim();
    if (!clean) return false;
    // Strong keywords and known orgs/segments (match anywhere, not just end)
    if (/(all things considered|on air now|morning edition|npr|pbs|news(?! [A-Z][a-z]+$)|center|department|agency|institute|administration|authority|government|organization|committee|association|university|team|group|office|board|foundation|corporation|company|society|commission|service|project|bureau|ministry|edition|segment|program|show|broadcast)/i.test(clean)) return true;
    // All uppercase and long enough
    if (/^[A-Z\s]+$/.test(clean) && clean.length > 4) return true;
    const words = clean.split(/\s+/);
    // 3+ words, each capitalized, not a typical person name
    if (words.length >= 3 && words.every(w => /^[A-Z][a-z]+$/.test(w))) return true;
    // 2 words: treat as org only if matches org/segment keywords or all uppercase
    if (words.length === 2) {
      if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(clean)) return false; // Looks like a person
      if (/(edition|segment|program|show|broadcast)/i.test(clean)) return true;
      if (/^[A-Z\s]+$/.test(clean)) return true;
    }
    // Single word: never org unless all uppercase and long
    if (words.length === 1 && /^[A-Z]{4,}$/.test(clean)) return true;
    return false;
  }

  function safeFormatNameAPA(name) {
    const clean = String(name||"").trim();
    if (!clean) return "";
    if (isLikelyOrganization(clean)) return clean;
    const toks = clean.split(/\s+/).filter(Boolean);
    if (toks.length < 2) return clean;
    return formatNameAPA(clean);
  }

  function formatAuthorsAPA(list) {
    const names = (list || []).filter(Boolean).slice(0, 20);
    if (!names.length) return "";

    // Separate person names and organizations
    const formatted = names.map(name => {
      if (isLikelyOrganization(name)) return name; // Leave organization names as-is
      return safeFormatNameAPA(name); // Format person names
    });

    // Handle APA formatting for multiple authors
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
    const last = formatted.pop();
    return `${formatted.join(", ")}, & ${last}`;
  }

  function normalizeDateToAPA(raw) {
    if (!raw) return "(n.d.).";
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let d;
    if (iso) d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    else d = new Date(raw);
    if (isNaN(d)) return "(n.d.).";
    const month = d.toLocaleString("en-US", { month: "long" });
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    return `(${year}, ${month} ${day}).`;
  }

  function buildAPA(d) {
    const authors = d.authors || [];
    const authorPart = formatAuthorsAPA(authors);
    const datePart = normalizeDateToAPA(d.published || d.publishedDate || "");
    const titlePart = window.CiteUtils.sentenceCaseSmart(d.title || "");
    const site = d.publisher || "";
    const retrieved = window.CiteUtils.today();
    const url = d.url;
    const doi = d.doi && d.doi.trim() ? ` https://doi.org/${d.doi.trim()}` : "";
    return `${authorPart} ${datePart} ${titlePart}. ${site}.${doi ? doi : ` Retrieved ${retrieved}, from ${url}`}`;
  }

  function refreshPreview() {
    const d = {
      title: titleEl.value.trim(),
      authors: authorsFromInput(authorsEl.value),
      published: dateEl.value.trim(),
      publishedDate: dateEl.value.trim(),
      publisher: publisherEl.value.trim(),
      url: urlEl.value.trim(),
      doi: doiEl ? doiEl.value.trim() : ""
    };
    output.value = buildAPA(d);
  }

  applyBtn.addEventListener("click", () => { refreshPreview(); statusEl.textContent = "Applied"; setTimeout(()=>statusEl.textContent="",900); });
  copyBtn.addEventListener("click", async () => { try { await navigator.clipboard.writeText(output.value); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy citation",900); } catch { copyBtn.textContent="Copy failed"; setTimeout(()=>copyBtn.textContent="Copy citation",900); } });

  rescanBtn.addEventListener("click", async () => {
    try { const tab = await getActiveTab(); const data = await fetchData(tab.id); hydrateFields(data); statusEl.textContent = "Rescanned"; setTimeout(()=>statusEl.textContent="",900); } catch { statusEl.textContent = "Rescan failed"; setTimeout(()=>statusEl.textContent="",1200); }
  });

  openGithubBtn.addEventListener("click", () => {
    try { chrome.tabs.create({ url: "https://github.com/changcheng967/doucite" }); } catch {}
  });

  try { const tab = await getActiveTab(); const data = await fetchData(tab.id); hydrateFields(data); } catch {}

  window.CiteUI = { refreshPreview, hydrateFields };
})();

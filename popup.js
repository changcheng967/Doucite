// popup.js — Doucite v3.2.0
// Ensures editable fields update working data, and Save page/site override persists edited values.

(async function () {
  // helpers
  async function getActiveTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }
  async function runContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } catch {}
  }

  async function fetchData(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" }, { timeout: 2000 });
      if (res && res.ok && res.data) return res.data;
    } catch {}
    // fallback: inject content script then try again
    try { await runContentScript(tabId); } catch {}
    try {
      const res2 = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res2 && res2.ok && res2.data) return res2.data;
    } catch {}
    return {};
  }

  // DOM elements
  const titleEl = document.getElementById("title");
  const authorsEl = document.getElementById("authors");
  const dateEl = document.getElementById("date");
  const publisherEl = document.getElementById("publisher");
  const urlEl = document.getElementById("url");
  const doiEl = document.getElementById("doi");
  const applyBtn = document.getElementById("apply");
  const lockCitation = document.getElementById("lockCitation");
  const statusEl = document.getElementById("status");
  const output = document.getElementById("output");
  const styleSel = document.getElementById("style");
  const includeAccessed = document.getElementById("includeAccessed");
  const sentenceCase = document.getElementById("sentenceCase");
  const useCorporateAuthor = document.getElementById("useCorporateAuthor");
  const pdfSuffix = document.getElementById("pdfSuffix");

  const loadAutoBtn = document.getElementById("loadAuto");
  const loadPageOverrideBtn = document.getElementById("loadPageOverride");
  const savePageOverrideBtn = document.getElementById("savePageOverride");
  const clearPageOverrideBtn = document.getElementById("clearPageOverride");
  const loadSiteOverrideBtn = document.getElementById("loadSiteOverride");
  const saveSiteOverrideBtn = document.getElementById("saveSiteOverride");
  const clearSiteOverrideBtn = document.getElementById("clearSiteOverride");

  const copyBtn = document.getElementById("copy");
  const copyBibBtn = document.getElementById("copyBib");
  const copyRISBtn = document.getElementById("copyRIS");
  const copyCSLBtn = document.getElementById("copyCSL");

  const collectCurrentBtn = document.getElementById("collectCurrent");
  const collectAllTabsBtn = document.getElementById("collectAllTabs");
  const clearBatchBtn = document.getElementById("clearBatch");
  const exportBatchBtn = document.getElementById("exportBatch");
  const batchListEl = document.getElementById("batchList");

  // initial state
  const tab = await getActiveTab();
  let autoData = await fetchData(tab.id);
  // normalize authors to array of strings
  if (autoData.authors && !Array.isArray(autoData.authors)) autoData.authors = String(autoData.authors).split(/[,;\/]+/).map(s => s.trim()).filter(Boolean);

  let data = { ...autoData }; // working copy
  const pageKey = data.url || tab.url || `tab-${tab.id}`;
  const siteKey = (new URL(pageKey)).hostname.replace(/^www\./, "");

  // load overrides and batch
  const stored = await chrome.storage.local.get(["overrides", "pageOverrides", "batch", "ui"]);
  const overrides = stored.overrides || {};
  const pageOverrides = stored.pageOverrides || {};
  let batch = stored.batch || [];
  const ui = stored.ui || {};

  // apply overrides (auto -> site -> page)
  if (overrides[siteKey]) data = { ...data, ...overrides[siteKey] };
  if (pageOverrides[pageKey]) data = { ...data, ...pageOverrides[pageKey] };

  // hydrate UI
  function hydrateFields(d) {
    titleEl.value = d.title || "";
    authorsEl.value = (d.authors || []).join(", ");
    dateEl.value = d.date || "";
    publisherEl.value = d.publisher || d.siteName || "";
    urlEl.value = d.url || "";
    doiEl.value = d.doi || "";
  }
  hydrateFields(data);

  // utils for authors and dates
  function authorsFromInput(val) {
    return String(val || "").split(",").map(s => s.trim()).filter(Boolean);
  }

  // citation formatting using existing CiteUtils
  function formatCitation(d, style) {
    try {
      switch (style) {
        case "apa": return buildAPA(d);
        case "mla": return buildMLA(d);
        case "chicago": return buildChicago(d);
        case "ieee": return buildIEEE(d);
        case "harvard": return buildHarvard(d);
        case "vancouver": return buildVancouver(d);
        default: return buildAPA(d);
      }
    } catch (e) { return "Error formatting citation"; }
  }

  // Use CiteUtils from utils.js (splitName, normalizeDate, sentenceCaseSmart)
  function buildAPA(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    let authorStr = (d.authors && d.authors.length) ? d.authors.map(a => {
      const s = window.CiteUtils.splitName(a);
      const initials = s.initials ? s.initials : (s.firstMiddle ? s.firstMiddle.split(/\s+/).map(x=>x[0]+".").join(" ") : "");
      return s.last ? `${s.last}, ${initials}` : a;
    }).join(", ") : (useCorporateAuthor.checked ? (d.publisher || d.siteName || "") : "");
    // ensure final period after author/corporate author
    if (authorStr && !authorStr.trim().endsWith(".")) authorStr = authorStr.trim() + ".";
    const dateStr = date.year ? `(${date.year}${date.month ? `, ${date.month}` : ""}${date.day ? ` ${date.day}` : ""}).` : "(n.d.).";
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    if (pdfSuffix.checked && d.isPDF) title = `${title} [PDF]`;
    const site = d.publisher || d.siteName || "";
    const doiPart = (d.doi && !isGovDomain(d.url)) ? ` https://doi.org/${d.doi}` : "";
    const retrieved = includeAccessed.checked ? ` Retrieved ${window.CiteUtils.today()}, from ${d.url}` : ` ${d.url}`;
    if (!authorStr) return `${title}. ${dateStr} ${site}.${doiPart}${retrieved}`;
    return `${authorStr} ${dateStr} ${title}. ${site}.${doiPart}${retrieved}`;
  }

  function buildMLA(d) {
    const author = authorsFromInput(d.authors && d.authors.join ? d.authors.join(",") : (d.authors || ""));
    const date = window.CiteUtils.normalizeDate(d.date);
    const dateStr = window.CiteUtils.formatDateMLA(date);
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    const site = d.publisher || d.siteName || "";
    const doiPart = (d.doi && !isGovDomain(d.url)) ? ` DOI: ${d.doi}.` : "";
    const accessed = includeAccessed.checked ? ` Accessed ${window.CiteUtils.todayMLA()}.` : "";
    if (!author.length) return `${title}. ${site}, ${dateStr}, ${d.url}.${doiPart}${accessed}`;
    return `${author[0]}. "${title}." ${site}, ${dateStr}, ${d.url}.${doiPart}${accessed}`;
  }

  function buildChicago(d) {
    const authors = authorsFromInput(d.authors);
    const date = window.CiteUtils.normalizeDate(d.date);
    const dateStr = window.CiteUtils.formatDateChicago(date);
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    const site = d.publisher || d.siteName || "";
    const doiPart = (d.doi && !isGovDomain(d.url)) ? ` https://doi.org/${d.doi}` : "";
    const accessed = includeAccessed.checked ? ` Accessed ${window.CiteUtils.todayChicago()}.` : "";
    if (!authors.length) return `${title}. ${site}, ${dateStr}. ${d.url}.${doiPart}${accessed}`;
    return `${authors.join(", ")}. "${title}." ${site}, ${dateStr}. ${d.url}.${doiPart}${accessed}`;
  }

  function buildIEEE(d) {
    const authors = authorsFromInput(d.authors);
    const year = window.CiteUtils.normalizeDate(d.date).year || "n.d.";
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    const site = d.publisher || d.siteName || "";
    return `${authors.length ? authors.join(", ") + ", " : ""}"${title}", ${site}, ${year}. Available: ${d.url}`;
  }

  function buildHarvard(d) {
    const authors = authorsFromInput(d.authors);
    const year = window.CiteUtils.normalizeDate(d.date).year || "n.d.";
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    const site = d.publisher || d.siteName || "";
    const accessed = includeAccessed.checked ? ` (Accessed ${window.CiteUtils.todayMLA()}).` : ".";
    return `${authors.length ? authors.join(", ") + " " : ""}(${year}) ${title}. ${site}. Available at: ${d.url}${accessed}`;
  }

  function buildVancouver(d) {
    const authors = authorsFromInput(d.authors);
    const year = window.CiteUtils.normalizeDate(d.date).year || "n.d.";
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    const site = d.publisher || d.siteName || "";
    return `${authors.length ? authors.join(", ") + ". " : ""}${title}. ${site}; ${year}. Available from: ${d.url}.`;
  }

  function isGovDomain(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return /\.(gov|gc\.ca|gov\.uk)$/.test(host) || /epa\.gov$/.test(host);
    } catch { return false; }
  }

  function refreshPreview() {
    output.value = formatCitation(data, styleSel.value);
  }
  refreshPreview();

  // apply edits from UI to working data
  applyBtn.addEventListener("click", () => {
    data.title = titleEl.value.trim();
    data.authors = authorsFromInput(authorsEl.value);
    data.date = dateEl.value.trim();
    data.publisher = publisherEl.value.trim();
    data.url = urlEl.value.trim();
    data.doi = doiEl.value.trim();
    if (!lockCitation.checked) refreshPreview();
    statusEl.textContent = "Applied";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  // Overrides: load/save/clear
  loadAutoBtn.addEventListener("click", () => {
    data = { ...autoData };
    hydrateFields(data);
    if (!lockCitation.checked) refreshPreview();
    statusEl.textContent = "Loaded auto";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  loadPageOverrideBtn.addEventListener("click", async () => {
    const store = await chrome.storage.local.get("pageOverrides");
    const p = (store.pageOverrides || {})[pageKey];
    if (p) { data = { ...autoData, ...p }; hydrateFields(data); if (!lockCitation.checked) refreshPreview(); statusEl.textContent="Loaded page override"; }
    else { statusEl.textContent="No page override"; }
    setTimeout(()=>statusEl.textContent="",1400);
  });

  savePageOverrideBtn.addEventListener("click", async () => {
    const store = await chrome.storage.local.get("pageOverrides");
    const pOv = store.pageOverrides || {};
    pOv[pageKey] = { title: data.title, authors: data.authors, date: data.date, publisher: data.publisher, url: data.url, doi: data.doi };
    await chrome.storage.local.set({ pageOverrides: pOv });
    statusEl.textContent = "Page override saved";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  clearPageOverrideBtn.addEventListener("click", async () => {
    const store = await chrome.storage.local.get("pageOverrides");
    const pOv = store.pageOverrides || {};
    delete pOv[pageKey];
    await chrome.storage.local.set({ pageOverrides: pOv });
    statusEl.textContent = "Page override cleared";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  loadSiteOverrideBtn.addEventListener("click", async () => {
    const store = await chrome.storage.local.get("overrides");
    const ov = (store.overrides || {})[siteKey];
    if (ov) { data = { ...autoData, ...ov }; hydrateFields(data); if (!lockCitation.checked) refreshPreview(); statusEl.textContent="Loaded site override"; }
    else { statusEl.textContent="No site override"; }
    setTimeout(()=>statusEl.textContent="",1400);
  });

  saveSiteOverrideBtn.addEventListener("click", async () => {
    const store = await chrome.storage.local.get("overrides");
    const ov = store.overrides || {};
    ov[siteKey] = { title: data.title, authors: data.authors, date: data.date, publisher: data.publisher, doi: data.doi };
    await chrome.storage.local.set({ overrides: ov });
    statusEl.textContent = "Site override saved";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  clearSiteOverrideBtn.addEventListener("click", async () => {
    const store = await chrome.storage.local.get("overrides");
    const ov = store.overrides || {};
    delete ov[siteKey];
    await chrome.storage.local.set({ overrides: ov });
    statusEl.textContent = "Site override cleared";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  // copy/export handlers
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(output.value); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy citation",1200); } catch { copyBtn.textContent="Copy failed"; setTimeout(()=>copyBtn.textContent="Copy citation",1200); }
  });

  copyBibBtn.addEventListener("click", async () => {
    const bib = buildBibTeX(data);
    try { await navigator.clipboard.writeText(bib); copyBibBtn.textContent="Copied!"; setTimeout(()=>copyBibBtn.textContent="Copy BibTeX",1200); } catch { copyBibBtn.textContent="Copy failed"; setTimeout(()=>copyBibBtn.textContent="Copy BibTeX",1200); }
  });

  copyRISBtn.addEventListener("click", async () => {
    const r = buildRIS(data);
    try { await navigator.clipboard.writeText(r); copyRISBtn.textContent="Copied!"; setTimeout(()=>copyRISBtn.textContent="Copy RIS",1200); } catch { copyRISBtn.textContent="Copy failed"; setTimeout(()=>copyRISBtn.textContent="Copy RIS",1200); }
  });

  copyCSLBtn.addEventListener("click", async () => {
    const j = buildCSL(data);
    try { await navigator.clipboard.writeText(j); copyCSLBtn.textContent="Copied!"; setTimeout(()=>copyCSLBtn.textContent="Copy CSL-JSON",1200); } catch { copyCSLBtn.textContent="Copy failed"; setTimeout(()=>copyCSLBtn.textContent="Copy CSL-JSON",1200); }
  });

  function buildBibTeX(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const key = window.CiteUtils.slug((d.authors?.[0] || d.publisher || d.siteName || "unknown") + "-" + (date.year||"n.d.") + "-" + window.CiteUtils.slug(d.title).slice(0,12));
    const fields = { author: (d.authors||[]).join(" and "), title: d.title||"", year: date.year||"", url: d.url||"", doi: (d.doi && !isGovDomain(d.url))?d.doi:"", publisher: d.publisher||d.siteName||"", note: d.isPDF?"PDF":"" };
    let bib = `@misc{${key},\n`;
    Object.entries(fields).forEach(([k,v])=>{ if(v) bib += `  ${k} = {${v}},\n`; });
    bib += "}";
    return bib;
  }

  function buildRIS(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const au = (d.authors||[]).map(a=>`AU  - ${a}`).join("\n");
    const lines = ["TY  - GEN", `TI  - ${d.title||""}`, au, `PY  - ${date.year||""}`, `T2  - ${d.publisher||d.siteName||""}`, (d.doi && !isGovDomain(d.url))?`DO  - ${d.doi}`:"", `UR  - ${d.url||""}`, d.isPDF?"N1  - PDF":"", "ER  -"].filter(Boolean);
    return lines.join("\n");
  }

  function buildCSL(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const obj = { type:"document", title: d.title||"", author: (d.authors||[]).map(a=>{ const s=window.CiteUtils.splitName(a); return { family: s.last, given: s.firstMiddle }; }), issued: date.year?{"date-parts":[[parseInt(date.year,10),(date.month?window.CiteUtils.monthIndex(date.month)+1:undefined),(date.day?parseInt(date.day,10):undefined)].filter(Boolean)]}:undefined, publisher: d.publisher||d.siteName||"", DOI:(d.doi && !isGovDomain(d.url))?d.doi:undefined, URL:d.url||"" };
    return JSON.stringify(obj,null,2);
  }

  function buildBibTeX(d){return buildBibTeX;} // avoid linter shadowing; real function above

  // batch (simple)
  function renderBatch() { batchListEl.textContent = batch.length? batch.map((b,i)=>`${i+1}. ${b.title} — ${b.url}`).join("\n") : "(empty)"; }
  renderBatch();

  collectCurrentBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    const payload = await fetchData(tab.id);
    batch.push(payload);
    await chrome.storage.local.set({ batch });
    renderBatch();
    statusEl.textContent="Added";
    setTimeout(()=>statusEl.textContent="",1000);
  });

  collectAllTabsBtn.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const t of tabs) {
      const payload = await fetchData(t.id);
      batch.push(payload);
    }
    await chrome.storage.local.set({ batch });
    renderBatch();
    statusEl.textContent="Collected all tabs";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  clearBatchBtn.addEventListener("click", async ()=>{ batch=[]; await chrome.storage.local.set({ batch }); renderBatch(); });

  exportBatchBtn.addEventListener("click", async ()=> {
    const style = document.getElementById("batchStyle").value;
    const list = batch.map(d => formatCitation(d, style)).join("\n\n");
    try { await navigator.clipboard.writeText(list); statusEl.textContent="Batch exported"; setTimeout(()=>statusEl.textContent="",1200); } catch { statusEl.textContent="Export failed"; setTimeout(()=>statusEl.textContent="",1500); }
  });

  // rescan (re-extract)
  document.getElementById("rescan").addEventListener("click", async () => {
    try {
      await runContentScript(tab.id);
      autoData = await fetchData(tab.id);
      if (autoData.authors && !Array.isArray(autoData.authors)) autoData.authors = String(autoData.authors).split(/[,;\/]+/).map(s=>s.trim()).filter(Boolean);
      data = { ...autoData };
      hydrateFields(data);
      if (!lockCitation.checked) refreshPreview();
      statusEl.textContent = "Rescanned";
      setTimeout(()=>statusEl.textContent="",1200);
    } catch { statusEl.textContent="Rescan failed"; setTimeout(()=>statusEl.textContent="",1500); }
  });

  // dark mode toggle
  document.getElementById("darkmode").addEventListener("click", async () => {
    document.body.classList.toggle("dark");
    const s = await chrome.storage.local.get("ui"); const ui = s.ui||{}; ui.dark = document.body.classList.contains("dark"); await chrome.storage.local.set({ ui }); 
  });

  // initial preview refresh
  if (!lockCitation.checked) refreshPreview();
})();

// popup.js — Doucite v3.3.0
// Editable fields, date choice (published/modified/n.d.), overrides persist chosen date preference.

(async function () {
  // helpers
  async function getActiveTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }
  async function ensureContentScript(tabId) {
    try { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); } catch {}
  }
  async function fetchData(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res && res.ok && res.data) return res.data;
    } catch {}
    try { await ensureContentScript(tabId); } catch {}
    try {
      const res2 = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res2 && res2.ok && res2.data) return res2.data;
    } catch {}
    return {};
  }

  // DOM
  const titleEl = document.getElementById("title");
  const authorsEl = document.getElementById("authors");
  const dateEl = document.getElementById("date");
  const publisherEl = document.getElementById("publisher");
  const urlEl = document.getElementById("url");
  const doiEl = document.getElementById("doi");
  const detPublishedEl = document.getElementById("detPublished");
  const detModifiedEl = document.getElementById("detModified");
  const dateChoicePublished = document.getElementById("dateChoicePublished");
  const dateChoiceModified = document.getElementById("dateChoiceModified");
  const dateChoiceND = document.getElementById("dateChoiceND");

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

  // initial fetch
  const tab = await getActiveTab();
  let autoData = await fetchData(tab.id);
  if (autoData.authors && !Array.isArray(autoData.authors)) autoData.authors = String(autoData.authors).split(/[,;\/]+/).map(s=>s.trim()).filter(Boolean);

  let data = { ...autoData };
  const pageKey = data.url || tab.url || `tab-${tab.id}`;
  const siteKey = (new URL(pageKey)).hostname.replace(/^www\./, "");

  // storage load (overrides, etc.)
  const storedAll = await chrome.storage.local.get(["overrides", "pageOverrides", "ui"]);
  const overrides = storedAll.overrides || {};
  const pageOverrides = storedAll.pageOverrides || {};
  const ui = storedAll.ui || {};
  // apply overrides
  if (overrides[siteKey]) data = { ...data, ...overrides[siteKey] };
  if (pageOverrides[pageKey]) data = { ...data, ...pageOverrides[pageKey] };

  // hydrate UI fields
  function hydrateFields(d) {
    titleEl.value = d.title || "";
    authorsEl.value = (d.authors || []).join(", ");
    dateEl.value = d.chosenDateManual || (d.published || d.modified || "");
    publisherEl.value = d.publisher || d.siteName || "";
    urlEl.value = d.url || "";
    doiEl.value = d.doi || "";
    detPublishedEl.textContent = d.published || "none";
    detModifiedEl.textContent = d.modified || "none";
    // choose radio based on saved preference or availability
    if (d.chosenDate === "published" && d.published) dateChoicePublished.checked = true;
    else if (d.chosenDate === "modified" && d.modified) dateChoiceModified.checked = true;
    else if (d.chosenDate === "nd") dateChoiceND.checked = true;
    else {
      // default: prefer published if present, otherwise modified, otherwise n.d.
      if (d.published) dateChoicePublished.checked = true;
      else if (d.modified) dateChoiceModified.checked = true;
      else dateChoiceND.checked = true;
    }
  }
  hydrateFields(data);

  // formatting helpers (rely on utils.js)
  function authorsFromInput(val) {
    return String(val || "").split(",").map(s => s.trim()).filter(Boolean);
  }

  function isGovDomain(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return /\.(gov|gc\.ca|gov\.uk)$/.test(host) || /epa\.gov$/.test(host);
    } catch { return false; }
  }

  function getChosenDateString(d) {
    const radios = document.getElementsByName("dateChoice");
    for (const r of radios) {
      if (r.checked) {
        if (r.value === "published") return d.published || "";
        if (r.value === "modified") return d.modified || "";
        if (r.value === "nd") return "";
      }
    }
    return d.published || d.modified || "";
  }

  // Citation builds (APA as main example)
  function buildAPA(d) {
    const chosenRaw = getChosenDateString(d);
    const norm = window.CiteUtils.normalizeDate(chosenRaw);
    const dateStr = norm.year ? `(${norm.year}${norm.month?`, ${norm.month}`:""}${norm.day?` ${norm.day}`:""}).` : "(n.d.).";
    // authors
    const authors = d.authors || [];
    let authorPart = "";
    if (authors.length) {
      const arr = authors.map(a => {
        const s = window.CiteUtils.splitName(a);
        const initials = s.initials ? s.initials : (s.firstMiddle ? s.firstMiddle.split(/\s+/).map(x=>x[0]+".").join(" ") : "");
        return s.last ? `${s.last}, ${initials}` : a;
      });
      if (arr.length === 1) authorPart = arr[0];
      else authorPart = window.CiteUtils.joinAPA(arr.slice()); // joinAPA mutates, pass copy
    } else if (useCorporateAuthor.checked) {
      authorPart = d.publisher || d.siteName || "";
    }
    if (authorPart && !authorPart.trim().endsWith(".")) authorPart = authorPart.trim() + ".";
    // title
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    if (pdfSuffix.checked && d.isPDF) title = `${title} [PDF]`;
    const site = d.publisher || d.siteName || "";
    const doiPart = (d.doi && !isGovDomain(d.url)) ? ` https://doi.org/${d.doi}` : "";
    const retrieved = includeAccessed.checked ? ` Retrieved ${window.CiteUtils.today()}, from ${d.url}` : ` ${d.url}`;
    if (!authorPart) return `${title}. ${dateStr} ${site}.${doiPart}${retrieved}`;
    return `${authorPart} ${dateStr} ${title}. ${site}.${doiPart}${retrieved}`;
  }

  function formatByStyle(d, style) {
    switch (style) {
      case "apa": return buildAPA(d);
      // Implement other styles similarly (MLA/Chicago/IEEE/Harvard/Vancouver)
      default: return buildAPA(d);
    }
  }

  function refreshPreview() {
    // ensure working data reflects current UI manual edits (but not persist changes)
    const working = {
      ...data,
      title: titleEl.value.trim(),
      authors: authorsFromInput(authorsEl.value),
      publisher: publisherEl.value.trim(),
      url: urlEl.value.trim(),
      doi: doiEl.value.trim(),
      published: data.published,
      modified: data.modified,
      isPDF: data.isPDF,
      chosenDate: (() => {
        if (dateChoicePublished.checked) return "published";
        if (dateChoiceModified.checked) return "modified";
        if (dateChoiceND.checked) return "nd";
        return "";
      })()
    };
    output.value = formatByStyle(working, styleSel.value);
  }
  refreshPreview();

  // Apply changes: push UI edits into working 'data' and refresh preview
  applyBtn.addEventListener("click", () => {
    data.title = titleEl.value.trim();
    data.authors = authorsFromInput(authorsEl.value);
    data.publisher = publisherEl.value.trim();
    data.url = urlEl.value.trim();
    data.doi = doiEl.value.trim();
    // record chosen date preference and manual override if user typed a custom date in date input
    const chosen = dateChoicePublished.checked ? "published" : dateChoiceModified.checked ? "modified" : "nd";
    data.chosenDate = chosen;
    if (dateEl.value && dateEl.value.trim()) data.chosenDateManual = dateEl.value.trim();
    if (!lockCitation.checked) refreshPreview();
    statusEl.textContent = "Applied";
    setTimeout(()=>statusEl.textContent="",1200);
  });

  // Overrides: store chosen date preference plus fields
  loadAutoBtn.addEventListener("click", async () => {
    data = { ...autoData };
    hydrateFields(data);
    if (!lockCitation.checked) refreshPreview();
    statusEl.textContent = "Loaded auto extraction";
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
    pOv[pageKey] = { title: data.title, authors: data.authors, published: data.published, modified: data.modified, chosenDate: data.chosenDate, chosenDateManual: data.chosenDateManual, publisher: data.publisher, url: data.url, doi: data.doi };
    await chrome.storage.local.set({ pageOverrides: pOv });
    statusEl.textContent = "Page override saved (includes chosen date)";
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
    ov[siteKey] = { title: data.title, authors: data.authors, published: data.published, modified: data.modified, chosenDate: data.chosenDate, chosenDateManual: data.chosenDateManual, publisher: data.publisher, doi: data.doi };
    await chrome.storage.local.set({ overrides: ov });
    statusEl.textContent = "Site override saved (includes chosen date)";
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

  // rescan: re-extract autoData and keep current overrides untouched
  document.getElementById("rescan").addEventListener("click", async () => {
    try {
      await ensureContentScript(tab.id);
      autoData = await fetchData(tab.id);
      if (autoData.authors && !Array.isArray(autoData.authors)) autoData.authors = String(autoData.authors).split(/[,;\/]+/).map(s=>s.trim()).filter(Boolean);
      // refresh working data if user loads auto
      statusEl.textContent = "Rescanned";
      setTimeout(()=>statusEl.textContent="",1200);
    } catch {
      statusEl.textContent = "Rescan failed";
      setTimeout(()=>statusEl.textContent="",1500);
    }
  });

  // copy actions
  copyBtn.addEventListener("click", async () => { try { await navigator.clipboard.writeText(output.value); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy citation",1200); } catch { copyBtn.textContent="Copy failed"; setTimeout(()=>copyBtn.textContent="Copy citation",1200); } });

  copyBibBtn.addEventListener("click", async () => {
    const bib = buildBib();
    try { await navigator.clipboard.writeText(bib); copyBibBtn.textContent="Copied!"; setTimeout(()=>copyBibBtn.textContent="Copy BibTeX",1200); } catch { copyBibBtn.textContent="Copy failed"; setTimeout(()=>copyBibBtn.textContent="Copy BibTeX",1200); }
  });

  copyRISBtn.addEventListener("click", async () => {
    const ris = buildRIS();
    try { await navigator.clipboard.writeText(ris); copyRISBtn.textContent="Copied!"; setTimeout(()=>copyRISBtn.textContent="Copy RIS",1200); } catch { copyRISBtn.textContent="Copy failed"; setTimeout(()=>copyRISBtn.textContent="Copy RIS",1200); }
  });

  copyCSLBtn.addEventListener("click", async () => {
    const csl = buildCSL();
    try { await navigator.clipboard.writeText(csl); copyCSLBtn.textContent="Copied!"; setTimeout(()=>copyCSLBtn.textContent="Copy CSL-JSON",1200); } catch { copyCSLBtn.textContent="Copy failed"; setTimeout(()=>copyCSLBtn.textContent="Copy CSL-JSON",1200); }
  });

  function buildBib() {
    const d = { ...data, title: titleEl.value.trim(), authors: authorsFromInput(authorsEl.value), publisher: publisherEl.value.trim(), url: urlEl.value.trim(), doi: doiEl.value.trim() };
    const date = window.CiteUtils.normalizeDate(getChosenDateString(d));
    const key = window.CiteUtils.slug((d.authors?.[0] || d.publisher || d.siteName || "unknown") + "-" + (date.year||"n.d.") + "-" + window.CiteUtils.slug(d.title).slice(0,12));
    const fields = { author: (d.authors||[]).join(" and "), title: d.title||"", year: date.year||"", url: d.url||"", doi: (d.doi && !isGovDomain(d.url))?d.doi:"", publisher: d.publisher||d.siteName||"", note: d.isPDF?"PDF":"" };
    let bib = `@misc{${key},\n`;
    Object.entries(fields).forEach(([k,v])=>{ if(v) bib += `  ${k} = {${v}},\n`; });
    bib += "}";
    return bib;
  }

  function buildRIS() {
    const d = { ...data, title: titleEl.value.trim(), authors: authorsFromInput(authorsEl.value), publisher: publisherEl.value.trim(), url: urlEl.value.trim(), doi: doiEl.value.trim() };
    const date = window.CiteUtils.normalizeDate(getChosenDateString(d));
    const au = (d.authors||[]).map(a=>`AU  - ${a}`).join("\n");
    const lines = ["TY  - GEN", `TI  - ${d.title||""}`, au, `PY  - ${date.year||""}`, `T2  - ${d.publisher||d.siteName||""}`, (d.doi && !isGovDomain(d.url))?`DO  - ${d.doi}`:"", `UR  - ${d.url||""}`, d.isPDF?"N1  - PDF":"", "ER  -"].filter(Boolean);
    return lines.join("\n");
  }

  function buildCSL() {
    const d = { ...data, title: titleEl.value.trim(), authors: authorsFromInput(authorsEl.value), publisher: publisherEl.value.trim(), url: urlEl.value.trim(), doi: doiEl.value.trim() };
    const date = window.CiteUtils.normalizeDate(getChosenDateString(d));
    const obj = { type: "document", title: d.title||"", author: (d.authors||[]).map(a=>{ const s=window.CiteUtils.splitName(a); return { family: s.last, given: s.firstMiddle }; }), issued: date.year?{"date-parts":[[parseInt(date.year,10),(date.month?window.CiteUtils.monthIndex(date.month)+1:undefined),(date.day?parseInt(date.day,10):undefined)].filter(Boolean)]}:undefined, publisher: d.publisher||d.siteName||"", DOI:(d.doi && !isGovDomain(d.url))?d.doi:undefined, URL:d.url||"" };
    return JSON.stringify(obj,null,2);
  }

  // final initial preview
  refreshPreview();

})();

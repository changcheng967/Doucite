// popup.js — Doucite v3.7.3
// UI code: hydrate fields, quick-fill, APA preview, overrides persistence.

(async function () {
  async function getActiveTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }
  async function injectIfNeeded(tabId) { try { await chrome.scripting.executeScript({ target:{ tabId }, files: ["content.js"] }); } catch {} }
  async function fetchData(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res && res.ok && res.data) return res.data;
    } catch {}
    try { await injectIfNeeded(tabId); } catch {}
    try {
      const res2 = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      if (res2 && res2.ok && res2.data) return res2.data;
    } catch {}
    return {};
  }

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
  const quickFillContainer = document.getElementById("quickFillContainer");
  const applyBtn = document.getElementById("apply");
  const lockCitation = document.getElementById("lockCitation");
  const statusEl = document.getElementById("status");
  const output = document.getElementById("output");
  const includeAccessed = document.getElementById("includeAccessed");
  const sentenceCase = document.getElementById("sentenceCase");
  const useCorporateAuthor = document.getElementById("useCorporateAuthor");

  const loadAutoBtn = document.getElementById("loadAuto");
  const loadPageOverrideBtn = document.getElementById("loadPageOverride");
  const savePageOverrideBtn = document.getElementById("savePageOverride");
  const clearPageOverrideBtn = document.getElementById("clearPageOverride");
  const copyBtn = document.getElementById("copy");

  const tab = await getActiveTab();
  let autoData = await fetchData(tab.id);
  if (autoData.authors && !Array.isArray(autoData.authors)) autoData.authors = String(autoData.authors).split(/[,;\/]+/).map(s => s.trim()).filter(Boolean);

  let data = { ...autoData };
  const pageKey = data.url || tab.url || `tab-${tab.id}`;
  const siteKey = (()=>{ try { return (new URL(pageKey)).hostname.replace(/^www\./,""); } catch { return ""; } })();

  const stored = await chrome.storage.local.get(["pageOverrides","overrides"]);
  const pageOverrides = stored.pageOverrides || {};
  const overrides = stored.overrides || {};
  if (overrides[siteKey]) data = { ...data, ...overrides[siteKey] };
  if (pageOverrides[pageKey]) data = { ...data, ...pageOverrides[pageKey] };

  function hydrateFields(d) {
    titleEl.value = d.title || "";
    authorsEl.value = (d.authors || []).join(", ");
    dateEl.value = d.chosenDateManual || (d.published || d.modified || "");
    publisherEl.value = d.publisher || d.siteName || "";
    urlEl.value = d.url || "";
    doiEl.value = d.doi || "";
    detPublishedEl.textContent = d.published || "none";
    detModifiedEl.textContent = d.modified || "none";
    if (d.chosenDate === "published" && d.published) dateChoicePublished.checked = true;
    else if (d.chosenDate === "modified" && d.modified) dateChoiceModified.checked = true;
    else if (d.chosenDate === "nd") dateChoiceND.checked = true;
    else { if (d.published) dateChoicePublished.checked = true; else if (d.modified) dateChoiceModified.checked = true; else dateChoiceND.checked = true; }
  }
  hydrateFields(data);

  function renderQuickFill(auto) {
    quickFillContainer.innerHTML = "";
    if (!auto) return;
    if (auto.extractionEmpty) statusEl.textContent = "No auto metadata detected.";
    else statusEl.textContent = "";
    const vis = auto.visibleCandidates || { bylines: [], dates: [] };
    if (vis.bylines && vis.bylines.length) {
      const div = document.createElement("div"); div.textContent = "Detected bylines:";
      vis.bylines.forEach(b => {
        const btn = document.createElement("button"); btn.type="button"; btn.textContent=b; btn.style.margin="4px";
        btn.addEventListener("click", () => { authorsEl.value = b; statusEl.textContent = "Byline imported"; setTimeout(()=>statusEl.textContent="",800); });
        div.appendChild(btn);
      });
      quickFillContainer.appendChild(div);
    }
    if (vis.dates && vis.dates.length) {
      const div = document.createElement("div"); div.textContent = "Detected dates:";
      vis.dates.forEach(d => {
        const btn = document.createElement("button"); btn.type="button"; btn.textContent=d; btn.style.margin="4px";
        btn.addEventListener("click", () => { dateEl.value = d; statusEl.textContent = "Date imported"; setTimeout(()=>statusEl.textContent="",800); });
        div.appendChild(btn);
      });
      quickFillContainer.appendChild(div);
    }
  }
  renderQuickFill(autoData);

  function authorsFromInput(val) { return String(val||"").split(",").map(s=>s.trim()).filter(Boolean); }
  function isGovDomain(url) { try { const h = new URL(url).hostname.toLowerCase(); return /\.(gov|gc\.ca|gov\.uk)$/.test(h) || /epa\.gov$/.test(h); } catch { return false; } }

  function getChosenDateStringFromUI() {
    if (dateChoicePublished.checked) return detPublishedEl.textContent === "none" ? dateEl.value.trim() : detPublishedEl.textContent || dateEl.value.trim();
    if (dateChoiceModified.checked) return detModifiedEl.textContent === "none" ? dateEl.value.trim() : detModifiedEl.textContent || dateEl.value.trim();
    if (dateChoiceND.checked) return "";
    return dateEl.value.trim() || detPublishedEl.textContent || detModifiedEl.textContent || "";
  }

  function formatAuthorsAPA(list) {
    const names = (list || []).slice(0,20);
    if (!names.length) return "";
    // corporate single author passthrough
    if (names.length === 1 && /U\.S\. Environmental Protection Agency|National Snow and Ice Data Center/i.test(names[0])) return names[0];
    const formatted = names.map(n => {
      const s = window.CiteUtils.splitName(n);
      const initials = s.initials ? s.initials : (s.firstMiddle ? s.firstMiddle.split(/\s+/).map(x=>x[0]?.toUpperCase()+".").join(" ") : "");
      if (s.last) return `${s.last}, ${initials}`.trim();
      return n;
    });
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
    const last = formatted.pop();
    return `${formatted.join(", ")}, & ${last}`;
  }

  function buildAPA(d) {
    const chosenRaw = d.chosenDateManual && d.chosenDateManual.trim() ? d.chosenDateManual.trim() : getChosenDateStringFromUI();
    const norm = window.CiteUtils.normalizeDate(chosenRaw);
    const dateStr = norm.year ? `(${norm.year}${norm.month?`, ${norm.month}`:""}${norm.day?` ${norm.day}`:""}).` : "(n.d.).";
    const authors = d.authors || [];
    let authorPart = formatAuthorsAPA(authors);
    if (!authorPart && useCorporateAuthor.checked) authorPart = d.publisher || d.siteName || "";
    if (authorPart && !authorPart.trim().endsWith(".")) authorPart = authorPart.trim() + ".";
    let title = d.title || "";
    if (sentenceCase.checked) title = window.CiteUtils.sentenceCaseSmart(title);
    const site = d.publisher || d.siteName || "";
    const doiPart = (d.doi && !isGovDomain(d.url)) ? ` https://doi.org/${d.doi}` : "";
    const retrieved = includeAccessed.checked ? ` Retrieved ${window.CiteUtils.today()}, from ${d.url}` : ` ${d.url}`;
    if (!authorPart) return `${title}. ${dateStr} ${site}.${doiPart}${retrieved}`;
    return `${authorPart} ${dateStr} ${title}. ${site}.${doiPart}${retrieved}`;
  }

  function refreshPreview() {
    const working = {
      ...data,
      title: titleEl.value.trim(),
      authors: authorsFromInput(authorsEl.value),
      publisher: publisherEl.value.trim(),
      url: urlEl.value.trim(),
      doi: doiEl.value.trim(),
      chosenDateManual: dateEl.value.trim()
    };
    output.value = buildAPA(working);
  }
  refreshPreview();

  applyBtn.addEventListener("click", () => {
    data.title = titleEl.value.trim();
    data.authors = authorsFromInput(authorsEl.value);
    data.chosenDate = dateChoicePublished.checked ? "published" : dateChoiceModified.checked ? "modified" : "nd";
    if (dateEl.value && dateEl.value.trim()) data.chosenDateManual = dateEl.value.trim();
    data.publisher = publisherEl.value.trim();
    data.url = urlEl.value.trim();
    data.doi = doiEl.value.trim();
    if (data.chosenDateManual) {
      detPublishedEl.textContent = detPublishedEl.textContent === "none" ? data.chosenDateManual : detPublishedEl.textContent;
      detModifiedEl.textContent = detModifiedEl.textContent === "none" ? data.chosenDateManual : detModifiedEl.textContent;
    }
    if (!lockCitation.checked) refreshPreview();
    statusEl.textContent = "Applied";
    setTimeout(()=>statusEl.textContent="",800);
  });

  async function currentUIState() {
    return {
      title: titleEl.value.trim(),
      authors: authorsFromInput(authorsEl.value),
      published: detPublishedEl.textContent === "none" ? dateEl.value.trim() : detPublishedEl.textContent,
      modified: detModifiedEl.textContent === "none" ? dateEl.value.trim() : detModifiedEl.textContent,
      chosenDate: dateChoicePublished.checked ? "published" : dateChoiceModified.checked ? "modified" : "nd",
      chosenDateManual: dateEl.value.trim(),
      publisher: publisherEl.value.trim(),
      url: urlEl.value.trim(),
      doi: doiEl.value.trim()
    };
  }

  savePageOverrideBtn.addEventListener("click", async () => {
    const current = await currentUIState();
    const s = await chrome.storage.local.get("pageOverrides");
    const pOv = s.pageOverrides || {};
    pOv[pageKey] = current;
    await chrome.storage.local.set({ pageOverrides: pOv });
    statusEl.textContent = "Page override saved";
    data = { ...data, ...current };
    hydrateFields(data);
    refreshPreview();
    setTimeout(()=>statusEl.textContent="",800);
  });

  loadPageOverrideBtn.addEventListener("click", async () => {
    const s = await chrome.storage.local.get("pageOverrides");
    const p = (s.pageOverrides || {})[pageKey];
    if (p) { data = { ...autoData, ...p }; hydrateFields(data); renderQuickFill(autoData); refreshPreview(); statusEl.textContent = "Loaded page override"; }
    else statusEl.textContent = "No page override";
    setTimeout(()=>statusEl.textContent="",800);
  });

  clearPageOverrideBtn.addEventListener("click", async () => {
    const s = await chrome.storage.local.get("pageOverrides");
    const pOv = s.pageOverrides || {};
    delete pOv[pageKey];
    await chrome.storage.local.set({ pageOverrides: pOv });
    statusEl.textContent = "Page override cleared";
    data = { ...autoData };
    hydrateFields(data);
    renderQuickFill(autoData);
    refreshPreview();
    setTimeout(()=>statusEl.textContent="",800);
  });

  document.getElementById("rescan").addEventListener("click", async () => {
    try {
      await injectIfNeeded(tab.id);
      autoData = await fetchData(tab.id);
      if (autoData.authors && !Array.isArray(autoData.authors)) autoData.authors = String(autoData.authors).split(/[,;\/]+/).map(s=>s.trim()).filter(Boolean);
      data = {...autoData};
      hydrateFields(data);
      renderQuickFill(autoData);
      refreshPreview();
      statusEl.textContent = "Rescanned";
      setTimeout(()=>statusEl.textContent="",800);
    } catch {
      statusEl.textContent = "Rescan failed";
      setTimeout(()=>statusEl.textContent="",1200);
    }
  });

  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(output.value); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy citation",800); } catch { copyBtn.textContent="Copy failed"; setTimeout(()=>copyBtn.textContent="Copy citation",800); }
  });
})();

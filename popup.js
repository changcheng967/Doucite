// popup.js — Doucite v3.0.0: styles, exports (BibTeX/RIS/CSL), batch mode, i18n, modern UI

(async function () {
  async function getTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function fetchData(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      return res || {};
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      const res2 = await chrome.tabs.sendMessage(tabId, { type: "GET_CITATION_DATA" });
      return res2 || {};
    }
  }

  // Elements
  const styleSel = document.getElementById("style");
  const langSel = document.getElementById("lang");
  const output = document.getElementById("output");
  const copyBtn = document.getElementById("copy");
  const copyBibBtn = document.getElementById("copyBib");
  const copyRISBtn = document.getElementById("copyRIS");
  const copyCSLBtn = document.getElementById("copyCSL");
  const includeAccessed = document.getElementById("includeAccessed");
  const sentenceCaseOpt = document.getElementById("sentenceCase");
  const useCorporateAuthor = document.getElementById("useCorporateAuthor");
  const pdfSuffix = document.getElementById("pdfSuffix");
  const rescanBtn = document.getElementById("rescan");
  const darkBtn = document.getElementById("darkmode");

  const titleEl = document.getElementById("title");
  const authorsEl = document.getElementById("authors");
  const dateEl = document.getElementById("date");
  const publisherEl = document.getElementById("publisher");
  const urlEl = document.getElementById("url");
  const doiEl = document.getElementById("doi");
  const applyBtn = document.getElementById("apply");
  const saveOverrideBtn = document.getElementById("saveOverride");
  const statusEl = document.getElementById("status");

  const collectCurrentBtn = document.getElementById("collectCurrent");
  const collectAllTabsBtn = document.getElementById("collectAllTabs");
  const clearBatchBtn = document.getElementById("clearBatch");
  const exportBatchBtn = document.getElementById("exportBatch");
  const batchStyleSel = document.getElementById("batchStyle");
  const batchListEl = document.getElementById("batchList");

  const tab = await getTab();
  let data = await fetchData(tab.id);

  // Overrides
  const siteKey = (new URL(data.url || "https://example.com")).hostname;
  const stored = await chrome.storage.local.get(["overrides", "batch", "ui"]);
  const overrides = stored.overrides || {};
  let batch = stored.batch || [];
  let uiPrefs = stored.ui || { lang: "en", dark: false };
  if (overrides[siteKey]) data = { ...data, ...overrides[siteKey] };

  // i18n
  const I18N = {
    en: {
      metadata: "Metadata",
      title_label: "Title",
      authors_label: "Author(s)",
      date_label: "Date",
      publisher_label: "Publisher",
      url_label: "URL",
      apply: "Apply changes",
      save_override: "Save site override",
      options: "Options",
      opt_retrieved: "Include “Retrieved” date",
      opt_sentencecase: "Sentence case title (APA)",
      opt_corp: "Use publisher/site when author missing",
      opt_pdf: "Append “[PDF]” when detected",
      preview: "Preview",
      copy: "Copy citation",
      copy_bib: "Copy BibTeX"
    },
    zh: {
      metadata: "元数据",
      title_label: "标题",
      authors_label: "作者",
      date_label: "日期",
      publisher_label: "发布者",
      url_label: "链接",
      apply: "应用更改",
      save_override: "保存站点覆盖",
      options: "选项",
      opt_retrieved: "包含“检索日期”",
      opt_sentencecase: "句式大小写 (APA)",
      opt_corp: "无个人作者时使用机构作者",
      opt_pdf: "检测到 PDF 时附加“[PDF]”",
      preview: "预览",
      copy: "复制引用",
      copy_bib: "复制 BibTeX"
    }
  };

  function applyI18N(lang) {
    const dict = I18N[lang] || I18N.en;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });
  }
  langSel.value = uiPrefs.lang || "en";
  applyI18N(langSel.value);
  if (uiPrefs.dark) document.body.classList.add("dark");

  function hydrateFields(d) {
    titleEl.value = d.title || "";
    authorsEl.value = (d.authors || []).join(", ");
    dateEl.value = d.date || "";
    publisherEl.value = d.publisher || d.siteName || "";
    urlEl.value = d.url || "";
    doiEl.value = d.doi || "";
  }
  hydrateFields(data);

  function corporateAuthor(d) { return d.publisher || d.siteName || ""; }

  // Styles
  function apaAuthors(authors, d, useCorp) {
    if (!authors.length) return useCorp ? corporateAuthor(d) : "";
    const formatted = authors.map((a) => {
      const { last, initials } = window.CiteUtils.splitName(a);
      const cleanInitials = initials.replace(/\s+/g, " ").trim().replace(/\.\.+/g, ".");
      const base = last ? `${last}, ${cleanInitials}` : a;
      return base.replace(/\.\s*$/, "") + "."; // single terminal period
    });
    return window.CiteUtils.joinAPA(formatted);
  }

  function mlaAuthors(authors) {
    if (!authors.length) return "";
    if (authors.length === 1) {
      const s = window.CiteUtils.splitName(authors[0]);
      return s.last ? `${s.last}, ${s.firstMiddle}` : authors[0];
    }
    const first = window.CiteUtils.splitName(authors[0]);
    return `${first.last}, ${first.firstMiddle}, et al.`;
  }

  function chicagoAuthors(authors, d, useCorp) {
    if (!authors.length) return useCorp ? corporateAuthor(d) : "";
    if (authors.length === 1) {
      const s = window.CiteUtils.splitName(authors[0]);
      return `${s.firstMiddle} ${s.last}`.trim();
    }
    const names = authors.map((a) => {
      const s = window.CiteUtils.splitName(a);
      return `${s.firstMiddle} ${s.last}`.trim();
    });
    return window.CiteUtils.joinChicago(names);
  }

  function ieeeAuthors(authors) {
    if (!authors.length) return "";
    // J. Smith, T. Nguyen
    return authors.map((a) => {
      const s = window.CiteUtils.splitName(a);
      const initials = (s.firstMiddle || "").split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + ".").join(" ");
      return `${initials} ${s.last}`.trim();
    }).join(", ");
  }

  function harvardAuthors(authors) {
    if (!authors.length) return "";
    // Last, F. M., Last, F. M.
    return authors.map((a) => {
      const s = window.CiteUtils.splitName(a);
      const initials = (s.firstMiddle || "").split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + ".").join(" ");
      return `${s.last}, ${initials}`.trim().replace(/\s+$/, "");
    }).join(", ");
  }

  function vancouverAuthors(authors) {
    if (!authors.length) return "";
    // Last FM, Last FM
    return authors.map((a) => {
      const s = window.CiteUtils.splitName(a);
      const initials = (s.firstMiddle || "").split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join("");
      return `${s.last} ${initials}`;
    }).join(", ");
  }

  function titleByStyle(d, style) {
    let t = d.title || "";
    if (style === "apa" && sentenceCaseOpt.checked) t = window.CiteUtils.sentenceCase(t);
    if (pdfSuffix.checked && d.isPDF) t = `${t} [PDF]`;
    return t;
  }

  function apa(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const authorStr = apaAuthors(d.authors || [], d, useCorporateAuthor.checked);
    const dateStr = date.year ? `(${date.year}${date.month ? `, ${date.month}` : ""}${date.day ? ` ${date.day}` : ""}).` : "(n.d.).";
    const title = titleByStyle(d, "apa");
    const site = d.publisher || d.siteName;
    const doiPart = d.doi ? ` https://doi.org/${d.doi}` : "";
    const retrieved = includeAccessed.checked ? ` Retrieved ${window.CiteUtils.today()}, from ${d.url}` : ` ${d.url}`;
    if (!authorStr) return `${title}. ${dateStr} ${site}.${doiPart}${retrieved}`;
    return `${authorStr} ${dateStr} ${title}. ${site}.${doiPart}${retrieved}`;
  }

  function mla(d) {
    const authorStr = mlaAuthors(d.authors || []);
    const site = d.publisher || d.siteName;
    const date = window.CiteUtils.normalizeDate(d.date);
    const dateStr = window.CiteUtils.formatDateMLA(date);
    const titleQuoted = `“${titleByStyle(d, "mla")}.”`;
    const doiPart = d.doi ? ` DOI: ${d.doi}.` : "";
    const accessed = includeAccessed.checked ? ` Accessed ${window.CiteUtils.todayMLA()}.` : "";
    if (!authorStr) return `${titleQuoted} ${site}, ${dateStr}, ${d.url}.${doiPart}${accessed}`;
    return `${authorStr}. ${titleQuoted} ${site}, ${dateStr}, ${d.url}.${doiPart}${accessed}`;
  }

  function chicago(d) {
    const authorStr = chicagoAuthors(d.authors || [], d, useCorporateAuthor.checked);
    const site = d.publisher || d.siteName;
    const date = window.CiteUtils.normalizeDate(d.date);
    const dateStr = window.CiteUtils.formatDateChicago(date);
    const titleQuoted = `“${titleByStyle(d, "chicago")}.”`;
    const doiPart = d.doi ? ` https://doi.org/${d.doi}` : "";
    const accessed = includeAccessed.checked ? ` Accessed ${window.CiteUtils.todayChicago()}.` : "";
    if (!authorStr) return `${titleQuoted} ${site}, ${dateStr}. ${d.url}.${doiPart}${accessed}`;
    return `${authorStr}. ${titleQuoted} ${site}, ${dateStr}. ${d.url}.${doiPart}${accessed}`;
  }

  function ieee(d) {
    // [1] T. Nguyen, "The Arctic: Environmental Issues", Library of Parliament, 2020. Available: URL.
    const idx = 1; // single item preview
    const authorStr = ieeeAuthors(d.authors || []);
    const year = window.CiteUtils.normalizeDate(d.date).year || "n.d.";
    const title = titleByStyle(d, "ieee");
    const site = d.publisher || d.siteName;
    return `[${idx}] ${authorStr ? authorStr + ", " : ""}"${title}", ${site}, ${year}. Available: ${d.url}`;
  }

  function harvard(d) {
    // Nguyen, T. (2020) The Arctic: Environmental issues. Library of Parliament. Available at: URL (Accessed 20 Oct 2025).
    const authorStr = harvardAuthors(d.authors || []);
    const date = window.CiteUtils.normalizeDate(d.date);
    const year = date.year || "n.d.";
    const title = titleByStyle(d, "harvard");
    const site = d.publisher || d.siteName;
    const accessed = includeAccessed.checked ? ` (Accessed ${window.CiteUtils.todayMLA()}).` : ".";
    return `${authorStr ? authorStr + " " : ""}(${year}) ${title}. ${site}. Available at: ${d.url}${accessed}`;
  }

  function vancouver(d) {
    // Nguyen T. The Arctic: Environmental issues. Library of Parliament; 2020. Available from: URL.
    const authorStr = vancouverAuthors(d.authors || []);
    const year = window.CiteUtils.normalizeDate(d.date).year || "n.d.";
    const title = titleByStyle(d, "vancouver");
    const site = d.publisher || d.siteName;
    return `${authorStr ? authorStr + ". " : ""}${title}. ${site}; ${year}. Available from: ${d.url}.`;
  }

  function formatByStyle(d, style) {
    switch (style) {
      case "apa": return apa(d);
      case "mla": return mla(d);
      case "chicago": return chicago(d);
      case "ieee": return ieee(d);
      case "harvard": return harvard(d);
      case "vancouver": return vancouver(d);
      default: return apa(d);
    }
  }

  function refreshCitation() {
    output.value = formatByStyle(data, styleSel.value);
  }
  refreshCitation();

  function applyEdits() {
    data.title = titleEl.value.trim();
    data.authors = authorsEl.value.split(",").map((s) => s.trim()).filter(Boolean);
    data.date = dateEl.value.trim();
    data.publisher = publisherEl.value.trim();
    data.url = urlEl.value.trim();
    data.doi = doiEl.value.trim();
    refreshCitation();
    statusEl.textContent = "Applied.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  }

  // Exports
  function bibtex(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const key = window.CiteUtils.slug((d.authors?.[0] || d.publisher || d.siteName || "unknown") + "-" + (date.year || "n.d.") + "-" + window.CiteUtils.slug(d.title).slice(0, 12));
    const fields = {
      author: (d.authors || []).join(" and "),
      title: d.title || "",
      year: date.year || "",
      url: d.url,
      doi: d.doi || "",
      publisher: d.publisher || d.siteName || "",
      note: d.isPDF ? "PDF" : ""
    };
    let bib = `@misc{${key},\n`;
    Object.entries(fields).forEach(([k, v]) => { if (v) bib += `  ${k} = {${v}},\n`; });
    bib += "}";
    return bib;
  }

  function ris(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const year = date.year || "";
    const auLines = (d.authors || []).map((a) => `AU  - ${a}`).join("\n");
    const lines = [
      "TY  - GEN",
      `TI  - ${d.title || ""}`,
      auLines,
      `PY  - ${year}`,
      `T2  - ${d.publisher || d.siteName || ""}`,
      d.doi ? `DO  - ${d.doi}` : "",
      `UR  - ${d.url}`,
      d.isPDF ? "N1  - PDF" : "",
      "ER  -"
    ].filter(Boolean);
    return lines.join("\n");
  }

  function csl(d) {
    // Minimal CSL-JSON
    const date = window.CiteUtils.normalizeDate(d.date);
    const obj = {
      type: "document",
      title: d.title || "",
      author: (d.authors || []).map((a) => {
        const s = window.CiteUtils.splitName(a);
        return { family: s.last, given: s.firstMiddle };
      }),
      issued: date.year ? { "date-parts": [[parseInt(date.year, 10), (date.month ? window.CiteUtils.monthIndex(date.month) + 1 : undefined), (date.day ? parseInt(date.day, 10) : undefined)].filter(Boolean)] } : undefined,
      publisher: d.publisher || d.siteName || "",
      DOI: d.doi || undefined,
      URL: d.url
    };
    return JSON.stringify(obj, null, 2);
  }

  // Batch mode
  function renderBatch() {
    if (!batch.length) { batchListEl.textContent = "(empty)"; return; }
    batchListEl.textContent = batch.map((item, i) => `${i + 1}. ${item.title} — ${item.url}`).join("\n");
  }
  renderBatch();

  async function collectFromTab(tabId) {
    const payload = await fetchData(tabId);
    batch.push(payload);
    await chrome.storage.local.set({ batch });
    renderBatch();
    statusEl.textContent = "Added.";
    setTimeout(() => (statusEl.textContent = ""), 1000);
  }

  collectCurrentBtn.addEventListener("click", async () => {
    const t = await getTab();
    await collectFromTab(t.id);
  });

  collectAllTabsBtn.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const t of tabs) {
      try { await collectFromTab(t.id); } catch {}
    }
    statusEl.textContent = "Collected all tabs.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  });

  clearBatchBtn.addEventListener("click", async () => {
    batch = [];
    await chrome.storage.local.set({ batch });
    renderBatch();
  });

  exportBatchBtn.addEventListener("click", async () => {
    const style = batchStyleSel.value;
    const list = batch.map((d) => formatByStyle(d, style)).join("\n\n");
    await navigator.clipboard.writeText(list);
    statusEl.textContent = "Batch exported to clipboard.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  });

  // Events
  styleSel.addEventListener("change", refreshCitation);
  includeAccessed.addEventListener("change", refreshCitation);
  sentenceCaseOpt.addEventListener("change", refreshCitation);
  useCorporateAuthor.addEventListener("change", refreshCitation);
  pdfSuffix.addEventListener("change", refreshCitation);
  applyBtn.addEventListener("click", applyEdits);

  saveOverrideBtn.addEventListener("click", async () => {
    const key = (new URL(data.url || "https://example.com")).hostname;
    const saved = await chrome.storage.local.get(["overrides"]);
    const overrides = saved.overrides || {};
    overrides[key] = {
      title: data.title, authors: data.authors, date: data.date, publisher: data.publisher, doi: data.doi
    };
    await chrome.storage.local.set({ overrides });
    statusEl.textContent = "Override saved.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  });

  rescanBtn.addEventListener("click", async () => {
    const t = await getTab();
    data = await fetchData(t.id);
    const key = (new URL(data.url || "https://example.com")).hostname;
    const saved = await chrome.storage.local.get(["overrides"]);
    const overrides = saved.overrides || {};
    if (overrides[key]) data = { ...data, ...overrides[key] };
    hydrateFields(data);
    refreshCitation();
    statusEl.textContent = "Rescanned.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  });

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(output.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy citation"), 1200);
  });

  copyBibBtn.addEventListener("click", async () => {
    const bib = bibtex(data);
    await navigator.clipboard.writeText(bib);
    copyBibBtn.textContent = "Copied!";
    setTimeout(() => (copyBibBtn.textContent = "Copy BibTeX"), 1200);
  });

  copyRISBtn.addEventListener("click", async () => {
    const r = ris(data);
    await navigator.clipboard.writeText(r);
    copyRISBtn.textContent = "Copied!";
    setTimeout(() => (copyRISBtn.textContent = "Copy RIS"), 1200);
  });

  copyCSLBtn.addEventListener("click", async () => {
    const j = csl(data);
    await navigator.clipboard.writeText(j);
    copyCSLBtn.textContent = "Copied!";
    setTimeout(() => (copyCSLBtn.textContent = "Copy CSL-JSON"), 1200);
  });

  darkBtn.addEventListener("click", async () => {
    document.body.classList.toggle("dark");
    uiPrefs.dark = document.body.classList.contains("dark");
    await chrome.storage.local.set({ ui: uiPrefs });
  });

  langSel.addEventListener("change", async () => {
    uiPrefs.lang = langSel.value;
    await chrome.storage.local.set({ ui: uiPrefs });
    applyI18N(langSel.value);
  });
})();

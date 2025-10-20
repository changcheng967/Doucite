// popup.js — Doucite formatting (APA/MLA/Chicago), modern UI, manual edits, overrides, APA punctuation fix, accessibility

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
      const res2 = await chrome.tabs.sendMessage(tab.id, { type: "GET_CITATION_DATA" });
      return res2 || {};
    }
  }

  const styleSel = document.getElementById("style");
  const output = document.getElementById("output");
  const copyBtn = document.getElementById("copy");
  const copyBibBtn = document.getElementById("copyBib");
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

  const tab = await getTab();
  let data = await fetchData(tab.id);

  const siteKey = (new URL(data.url || "https://example.com")).hostname;
  const stored = await chrome.storage.local.get(["overrides"]);
  const overrides = stored.overrides || {};
  if (overrides[siteKey]) {
    data = { ...data, ...overrides[siteKey] };
  }

  function hydrateFields(d) {
    titleEl.value = d.title || "";
    authorsEl.value = (d.authors || []).join(", ");
    dateEl.value = d.date || "";
    publisherEl.value = d.publisher || d.siteName || "";
    urlEl.value = d.url || "";
    doiEl.value = d.doi || "";
  }

  function corporateAuthor(d) {
    return d.publisher || d.siteName || "";
  }

  function formatAPAAuthors(authors, d, useCorp) {
    if (authors.length === 0) return useCorp ? corporateAuthor(d) : "";
    const formatted = authors.map((a) => {
      const { last, initials } = window.CiteUtils.splitName(a);
      const cleanInitials = initials.replace(/\s+/g, " ").trim().replace(/\.\.+/g, ".");
      const base = last ? `${last}, ${cleanInitials}` : a;
      return base.replace(/\.\s*$/, "") + "."; // Ensure single terminal period
    });
    return window.CiteUtils.joinAPA(formatted);
  }

  function formatMLAAuthors(authors) {
    if (authors.length === 0) return "";
    if (authors.length === 1) {
      const s = window.CiteUtils.splitName(authors[0]);
      return s.last ? `${s.last}, ${s.firstMiddle}` : authors[0];
    }
    const first = window.CiteUtils.splitName(authors[0]);
    return `${first.last}, ${first.firstMiddle}, et al.`;
  }

  function formatChicagoAuthors(authors, d, useCorp) {
    if (authors.length === 0) return useCorp ? corporateAuthor(d) : "";
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

  function normalizeTitle(d, style) {
    let t = d.title || "";
    if (style === "apa" && sentenceCaseOpt.checked) t = window.CiteUtils.sentenceCase(t);
    if (pdfSuffix.checked && d.isPDF) t = `${t} [PDF]`;
    return t;
  }

  function apa(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const authors = d.authors || [];
    const authorStr = formatAPAAuthors(authors, d, useCorporateAuthor.checked);
    const dateStr = date.year
      ? `(${date.year}${date.month ? `, ${date.month}` : ""}${date.day ? ` ${date.day}` : ""}).`
      : "(n.d.).";
    const title = normalizeTitle(d, "apa");
    const site = d.publisher || d.siteName;
    const doiPart = d.doi ? ` https://doi.org/${d.doi}` : "";
    const retrieved = includeAccessed.checked
      ? ` Retrieved ${window.CiteUtils.today()}, from ${d.url}`
      : ` ${d.url}`;

    if (!authorStr) return `${title}. ${dateStr} ${site}.${doiPart}${retrieved}`;
    return `${authorStr} ${dateStr} ${title}. ${site}.${doiPart}${retrieved}`;
  }

  function mla(d) {
    const authors = d.authors || [];
    const authorStr = formatMLAAuthors(authors);
    const site = d.publisher || d.siteName;
    const date = window.CiteUtils.normalizeDate(d.date);
    const dateStr = window.CiteUtils.formatDateMLA(date);
    const titleQuoted = `“${normalizeTitle(d, "mla")}.”`;
    const doiPart = d.doi ? ` DOI: ${d.doi}.` : "";
    const accessed = includeAccessed.checked ? ` Accessed ${window.CiteUtils.todayMLA()}.` : "";

    if (!authorStr) return `${titleQuoted} ${site}, ${dateStr}, ${d.url}.${doiPart}${accessed}`;
    return `${authorStr}. ${titleQuoted} ${site}, ${dateStr}, ${d.url}.${doiPart}${accessed}`;
  }

  function chicago(d) {
    const authors = d.authors || [];
    const authorStr = formatChicagoAuthors(authors, d, useCorporateAuthor.checked);
    const site = d.publisher || d.siteName;
    const date = window.CiteUtils.normalizeDate(d.date);
    const dateStr = window.CiteUtils.formatDateChicago(date);
    const titleQuoted = `“${normalizeTitle(d, "chicago")}.”`;
    const doiPart = d.doi ? ` https://doi.org/${d.doi}` : "";
    const accessed = includeAccessed.checked ? ` Accessed ${window.CiteUtils.todayChicago()}.` : "";

    if (!authorStr) return `${titleQuoted} ${site}, ${dateStr}. ${d.url}.${doiPart}${accessed}`;
    return `${authorStr}. ${titleQuoted} ${site}, ${dateStr}. ${d.url}.${doiPart}${accessed}`;
  }

  function bibtex(d) {
    const date = window.CiteUtils.normalizeDate(d.date);
    const key = window.CiteUtils.slug(
      (d.authors?.[0] || d.publisher || d.siteName || "unknown") +
        "-" +
        (date.year || "n.d.") +
        "-" +
        window.CiteUtils.slug(d.title).slice(0, 12)
    );
    const fields = {
      author: (d.authors || []).join(" and "),
      title: normalizeTitle(d, "apa"),
      year: date.year || "",
      url: d.url,
      doi: d.doi || "",
      publisher: d.publisher || d.siteName || "",
      note: d.isPDF ? "PDF" : ""
    };
    let bib = `@misc{${key},\n`;
    Object.entries(fields).forEach(([k, v]) => {
      if (v) bib += `  ${k} = {${v}},\n`;
    });
    bib += "}";
    return bib;
  }

  function refreshCitation() {
    let str = "";
    switch (styleSel.value) {
      case "apa": str = apa(data); break;
      case "mla": str = mla(data); break;
      case "chicago": str = chicago(data); break;
    }
    output.value = str;
  }

  function applyEdits() {
    data.title = titleEl.value.trim();
    data.authors = authorsEl.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    data.date = dateEl.value.trim();
    data.publisher = publisherEl.value.trim();
    data.url = urlEl.value.trim();
    data.doi = doiEl.value.trim();
    refreshCitation();
    statusEl.textContent = "Applied.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  }

  function hydrateAndRefresh() {
    hydrateFields(data);
    refreshCitation();
  }

  hydrateAndRefresh();

  styleSel.addEventListener("change", refreshCitation);
  includeAccessed.addEventListener("change", refreshCitation);
  sentenceCaseOpt.addEventListener("change", refreshCitation);
  useCorporateAuthor.addEventListener("change", refreshCitation);
  pdfSuffix.addEventListener("change", refreshCitation);
  applyBtn.addEventListener("click", applyEdits);

  saveOverrideBtn.addEventListener("click", async () => {
    const key = (new URL(data.url || "https://example.com")).hostname;
    const stored = await chrome.storage.local.get(["overrides"]);
    const overrides = stored.overrides || {};
    overrides[key] = {
      title: data.title,
      authors: data.authors,
      date: data.date,
      publisher: data.publisher,
      doi: data.doi
    };
    await chrome.storage.local.set({ overrides });
    statusEl.textContent = "Override saved for site.";
    setTimeout(() => (statusEl.textContent = ""), 1500);
  });

  rescanBtn.addEventListener("click", async () => {
    const tab = await getTab();
    data = await fetchData(tab.id);
    const key = (new URL(data.url || "https://example.com")).hostname;
    const stored = await chrome.storage.local.get(["overrides"]);
    const overrides = stored.overrides || {};
    if (overrides[key]) data = { ...data, ...overrides[key] };
    hydrateAndRefresh();
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

  darkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });
})();

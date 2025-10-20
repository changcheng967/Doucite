// content.js — Doucite v3.3.0
// Extraction layer: title, authors, publisher, canonical url, doi, isPDF,
// published vs modified detection (exposed separately).
(function () {
  const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const attr = (el, name) => (el ? el.getAttribute(name) || "" : "");
  function safeJSONLD() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { out.push(JSON.parse(s.textContent)); } catch {}
    });
    return out;
  }
  function canonicalURL() {
    try {
      const c = document.querySelector('link[rel="canonical"]');
      const href = c ? attr(c, "href") : location.href;
      const u = new URL(href, location.href);
      u.hash = "";
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach((p) => u.searchParams.delete(p));
      return u.href;
    } catch { return location.href; }
  }
  function guessIsPDF() {
    try {
      const href = location.href.toLowerCase();
      if (href.includes(".pdf")) return true;
      if (document.querySelector('embed[type="application/pdf"], iframe[src*=".pdf"], object[data*=".pdf"]')) return true;
    } catch {}
    return false;
  }
  function cleanTitle(s) {
    if (!s) return "";
    const parts = s.split(/\s*\|\s*|\s+—\s+|\s+-\s+|\s+·\s+/);
    return (parts[0] || s).trim().replace(/\s+/g, " ");
  }

  function getTitle() {
    const metaTitle = document.querySelector('meta[name="citation_title"], meta[property="DC.title"], meta[property="dc.title"]');
    if (metaTitle && metaTitle.content) return cleanTitle(metaTitle.content);
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return cleanTitle(og.content);
    const ld = safeJSONLD();
    for (const node of ld) {
      if (node && (node.headline || node.name || node.alternativeHeadline)) return cleanTitle(node.headline || node.name || node.alternativeHeadline);
    }
    const h1 = document.querySelector("h1");
    if (h1 && text(h1)) return cleanTitle(text(h1));
    if (guessIsPDF()) {
      try {
        const u = new URL(canonicalURL());
        const name = u.pathname.split("/").pop() || "";
        return cleanTitle(decodeURIComponent(name).replace(/\.pdf$/i, ""));
      } catch {}
    }
    return cleanTitle(document.title || "");
  }

  function getAuthors() {
    const authors = new Set();
    document.querySelectorAll('meta[name="citation_author"], meta[property="DC.creator"], meta[name="author"]').forEach((m) => {
      if (m.content) authors.add(m.content.trim());
    });
    const ld = safeJSONLD();
    for (const node of ld) {
      if (!node) continue;
      const a = node.author || node.creator || node.contributor;
      if (!a) continue;
      if (Array.isArray(a)) a.forEach((x) => { if (typeof x === "string") authors.add(x.trim()); else if (x && x.name) authors.add(x.name.trim()); });
      else if (typeof a === "string") authors.add(a.trim());
      else if (a && a.name) authors.add(a.name.trim());
    }
    const selectors = ['.byline', '.article-author', '.author', '.author-name', '[itemprop="author"]', '.pub-info', '.submitted-by'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && text(el)) {
        const raw = text(el).replace(/^by\s+/i, "");
        raw.split(/[;,\/]| and /).map((s) => s.trim()).filter(Boolean).forEach((s) => authors.add(s));
      }
    }
    return Array.from(authors).slice(0, 20);
  }

  function getPublisher() {
    const metaPub = document.querySelector('meta[name="publisher"], meta[property="og:site_name"]');
    if (metaPub && metaPub.content) return metaPub.content.trim();
    const ld = safeJSONLD();
    for (const node of ld) {
      if (node && node.publisher) {
        if (typeof node.publisher === "string") return node.publisher;
        if (node.publisher.name) return node.publisher.name;
      }
    }
    return document.location.hostname.replace(/^www\./, "");
  }

  function getDates() {
    // return object { published: "...", modified: "..." } where available (strings)
    const res = { published: "", modified: "" };
    try {
      // visible time elements first
      const timeEls = Array.from(document.querySelectorAll("time[datetime], time"));
      for (const t of timeEls) {
        const dt = t.getAttribute && (t.getAttribute("datetime") || t.textContent);
        if (dt && dt.trim()) {
          if (!res.published) res.published = dt.trim();
          else if (!res.modified) res.modified = dt.trim();
        }
      }
      // meta tags
      const metaPub = document.querySelector('meta[property="article:published_time"], meta[property="DC.date.created"], meta[property="DC.date.created"]');
      if (metaPub && metaPub.content) res.published = res.published || metaPub.content.trim();
      const metaMod = document.querySelector('meta[property="article:modified_time"], meta[property="og:updated_time"], meta[property="DC.date.modified"]');
      if (metaMod && metaMod.content) res.modified = res.modified || metaMod.content.trim();
      // JSON-LD
      const ld = safeJSONLD();
      for (const node of ld) {
        if (!node) continue;
        if (node.datePublished && !res.published) res.published = node.datePublished;
        if (node.dateCreated && !res.published) res.published = node.dateCreated;
        if (node.dateModified && !res.modified) res.modified = node.dateModified;
        if (node.uploadDate && !res.published) res.published = node.uploadDate;
      }
    } catch {}
    return res;
  }

  function getDOI() {
    try {
      const meta = document.querySelector('meta[name="citation_doi"], meta[property="DC.identifier"]');
      if (meta && meta.content) {
        const m = (meta.content || "").match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        if (m) return m[0];
      }
      const body = document.body ? document.body.innerText : "";
      const m = body.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      return m ? m[0] : "";
    } catch { return ""; }
  }

  function normalizePublisherName(name) {
    if (!name) return "";
    const s = name.trim();
    if (/^US\s*EPA$/i.test(s) || /^EPA$/i.test(s) || /United States Environmental Protection Agency/i.test(s)) {
      return "U.S. Environmental Protection Agency";
    }
    return s;
  }

  const dates = getDates();
  const payload = {
    title: getTitle(),
    authors: getAuthors(),
    published: dates.published || "",
    modified: dates.modified || "",
    chosenDate: "", // left empty — popup will offer choice (published/modified/n.d.)
    url: canonicalURL(),
    siteName: getPublisher(),
    publisher: normalizePublisherName(getPublisher()),
    doi: getDOI(),
    isPDF: guessIsPDF()
  };

  window.__DOUCITE__ = payload;

  chrome.runtime.onMessage?.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "GET_CITATION_DATA") {
      sendResponse({ ok: true, data: window.__DOUCITE__ });
    }
  });
})();

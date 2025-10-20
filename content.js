// content.js — Doucite v3.4.0 extractor (robust, mutation-observer, metadata precedence)
// Exposes window.__DOUCITE__ and answers GET_CITATION_DATA message.

(function () {
  const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const attr = (el, n) => (el ? el.getAttribute(n) || "" : "");
  const MAX_WAIT = 1400; // ms to wait for late-inserted metadata

  function safeJSONLD() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { const j = JSON.parse(s.textContent); out.push(j); } catch {}
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
      return !!document.querySelector('embed[type="application/pdf"], iframe[src*=".pdf"], object[data*=".pdf"]');
    } catch { return false; }
  }

  function cleanTitle(s) {
    if (!s) return "";
    return String(s).split(/\s*\|\s*|\s+—\s+|\s+-\s+|\s+·\s+/)[0].trim().replace(/\s+/g, " ");
  }

  function extract() {
    const ldNodes = safeJSONLD();

    // Title
    let title = "";
    const metaTitle = document.querySelector('meta[name="citation_title"], meta[property="og:title"], meta[name="title"], meta[property="DC.title"], meta[property="dc.title"]');
    if (metaTitle && metaTitle.content) title = cleanTitle(metaTitle.content);
    if (!title) {
      for (const node of ldNodes) {
        if (!node) continue;
        if (node.headline) { title = cleanTitle(node.headline); break; }
        if (node.name && typeof node.name === "string") { title = cleanTitle(node.name); break; }
      }
    }
    if (!title) {
      const h1 = document.querySelector("h1");
      if (h1 && text(h1)) title = cleanTitle(text(h1));
    }
    if (!title && document.title) title = cleanTitle(document.title);

    // Authors
    const authorsSet = new Set();
    document.querySelectorAll('meta[name="citation_author"], meta[name="author"], meta[property="DC.creator"]').forEach((m) => {
      if (m.content) authorsSet.add(m.content.trim());
    });
    for (const node of ldNodes) {
      if (!node) continue;
      const a = node.author || node.creator || node.contributor;
      if (!a) continue;
      if (Array.isArray(a)) a.forEach((x) => { if (typeof x === "string") authorsSet.add(x.trim()); else if (x && x.name) authorsSet.add(x.name.trim()); });
      else if (typeof a === "string") authorsSet.add(a.trim());
      else if (a && a.name) authorsSet.add(a.name.trim());
    }
    const bylineSelectors = ['.byline', '.article-author', '.author', '.author-name', '[itemprop="author"]', '.credit', '.by'];
    for (const sel of bylineSelectors) {
      const el = document.querySelector(sel);
      if (el && text(el)) {
        const raw = text(el).replace(/^by\s+/i, "");
        raw.split(/[;,\/]| and /).map(s => s.trim()).filter(Boolean).forEach(s => authorsSet.add(s));
      }
    }
    const authors = Array.from(authorsSet).slice(0, 30);

    // Dates: published & modified
    let published = "";
    let modified = "";
    // visible time elements
    const times = Array.from(document.querySelectorAll("time[datetime], time"));
    for (const t of times) {
      const dt = (t && t.getAttribute) ? (t.getAttribute("datetime") || t.textContent) : (t.textContent || "");
      const v = dt && dt.trim();
      if (!v) continue;
      if (!published) published = v.trim();
      else if (!modified) modified = v.trim();
    }
    // meta fallbacks
    const metaPub = document.querySelector('meta[property="article:published_time"], meta[name="date"], meta[name="dc.date"], meta[property="DC.date.created"], meta[name="datePublished"], meta[name="citation_publication_date"]');
    if (metaPub && metaPub.content) published = published || metaPub.content.trim();
    const metaMod = document.querySelector('meta[property="article:modified_time"], meta[property="og:updated_time"], meta[name="lastmod"], meta[property="DC.date.modified"]');
    if (metaMod && metaMod.content) modified = modified || metaMod.content.trim();
    for (const node of ldNodes) {
      if (!node) continue;
      if (!published && (node.datePublished || node.dateCreated || node.uploadDate)) published = node.datePublished || node.dateCreated || node.uploadDate || published;
      if (!modified && node.dateModified) modified = node.dateModified || modified;
    }

    // Publisher / siteName
    let publisher = "";
    const metaPubName = document.querySelector('meta[name="publisher"], meta[property="og:site_name"]');
    if (metaPubName && metaPubName.content) publisher = metaPubName.content.trim();
    if (!publisher) {
      const ldPub = ldNodes.find(n => n && n.publisher);
      if (ldPub && ldPub.publisher) {
        if (typeof ldPub.publisher === "string") publisher = ldPub.publisher;
        else if (ldPub.publisher.name) publisher = ldPub.publisher.name;
      }
    }
    if (!publisher) publisher = document.location.hostname.replace(/^www\./, "");

    // DOI
    let doi = "";
    const doiMeta = document.querySelector('meta[name="citation_doi"], meta[property="DC.identifier"]');
    if (doiMeta && doiMeta.content) {
      const m = (doiMeta.content || "").match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      if (m) doi = m[0];
    }
    if (!doi) {
      const body = document.body ? document.body.innerText : "";
      const m = body.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      if (m) doi = m[0];
    }

    return {
      title: title || "",
      authors: authors,
      published: published || "",
      modified: modified || "",
      url: canonicalURL(),
      siteName: publisher,
      publisher: (function (s) {
        if (!s) return "";
        if (/^US\s*EPA$/i.test(s) || /^EPA$/i.test(s) || /United States Environmental Protection Agency/i.test(s)) return "U.S. Environmental Protection Agency";
        return s;
      })(publisher),
      doi: doi || "",
      isPDF: guessIsPDF()
    };
  }

  // Wait and observe for late metadata insertion, then expose
  function observeAndExpose(waitMs = MAX_WAIT) {
    const first = extract();
    const has = first.title || first.published || first.modified || (first.authors && first.authors.length);
    if (has) {
      window.__DOUCITE__ = first;
      return;
    }
    let exposed = false;
    const start = Date.now();
    const observer = new MutationObserver(() => {
      const now = Date.now();
      const cur = extract();
      const ok = cur.title || cur.published || cur.modified || (cur.authors && cur.authors.length);
      if (ok) {
        window.__DOUCITE__ = cur; exposed = true; observer.disconnect();
      } else if (now - start > waitMs) {
        window.__DOUCITE__ = cur; exposed = true; observer.disconnect();
      }
    });
    observer.observe(document.documentElement || document.body || document, { childList: true, subtree: true, attributes: true, characterData: true });
    // safety timeout
    setTimeout(() => {
      if (!exposed) {
        const final = extract();
        window.__DOUCITE__ = final;
        observer.disconnect();
      }
    }, waitMs + 80);
  }

  try { observeAndExpose(); } catch (e) { window.__DOUCITE__ = extract(); }

  chrome.runtime.onMessage?.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "GET_CITATION_DATA") {
      sendResponse({ ok: true, data: window.__DOUCITE__ || extract() });
    }
  });
})();

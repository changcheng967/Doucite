// content.js — Doucite v3.7.2
// Highest-accuracy byline extraction: strips provenance, splits correctly, dedupes, exposes window.__DOUCITE__.

(function () {
  const text = el => (el && el.textContent ? el.textContent.trim() : "");
  const attr = (el,n) => (el ? el.getAttribute(n) || "" : "");
  const WAIT_MS = 1200;

  function safeJSONLD() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try { out.push(JSON.parse(s.textContent)); } catch {}
    });
    return out;
  }

  function canonicalURL() {
    try {
      const c = document.querySelector('link[rel="canonical"]');
      const href = c ? attr(c,"href") : location.href;
      const u = new URL(href, location.href);
      u.hash = "";
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(p => u.searchParams.delete(p));
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
    return String(s).split(/\s*\|\s*|\s+—\s+|\s+-\s+|\s+·\s+/)[0].trim().replace(/\s+/g," ");
  }

  // Provenance tokens that must never become authors
  const PROVENANCE = [
    "npr","wbur","nsidc","national snow and ice data center","all things considered","heard on",
    "noaa","ap","reuters","pbs","from","staff","editorial"
  ];

  function looksLikeProvenance(s) {
    if (!s) return false;
    const low = s.toLowerCase().replace(/[^a-z0-9\s]/g," ").trim();
    if (!low) return false;
    for (const p of PROVENANCE) if (low === p || low.includes(p)) return true;
    if (/^[A-Z]{2,6}$/.test(s) && s.length <= 6) return true;
    return false;
  }

  // Carefully split byline into candidate fragments
  function splitBylineRaw(raw) {
    if (!raw) return [];
    let r = String(raw).replace(/\u200B/g,"").trim();
    // remove leading "By" or "BY" and common prefixes
    r = r.replace(/^[\s\r\n]*By[:\s]+/i, "");
    // normalize separators
    const parts = r.split(/\s*\/\s*|\s*\|\s*|\s*;\s*|\r?\n|\s+\&\s+|\s+ and \s+/i).map(p=>p.trim()).filter(Boolean);
    // handle concatenated patterns like "Barbara Moran / WBURTwila Moon" by inserting separator between capitalized runs
    const expanded = [];
    parts.forEach(p => {
      // break where lowercase/uppercase boundary suggests two names without separator
      const toks = p.split(/(?<=[a-z])(?=[A-Z][a-z]+\b)/).map(x=>x.trim()).filter(Boolean);
      toks.forEach(t => expanded.push(t));
    });
    return expanded;
  }

  // Remove provenance tokens, stray parentheses, trailing source words
  function normalizeAuthorFragment(frag) {
    if (!frag) return "";
    let s = String(frag).trim();
    // remove common parenthetical provenance like " (WBUR)" or "(NSIDC)"
    s = s.replace(/\(\s*(WBUR|NPR|NSIDC|National Snow and Ice Data Center|All Things Considered|NOAA|From)\s*\)/gi, "").trim();
    // remove appended provenance after comma/dash
    s = s.replace(/[,\-–]\s*(WBUR|NPR|NSIDC|National Snow and Ice Data Center|All Things Considered|NOAA|From)$/i, "").trim();
    // remove leading "By"
    s = s.replace(/^[\s,;:-]*By\s+/i,"").trim();
    // strip stray punctuation
    s = s.replace(/^[\W_]+|[\W_]+$/g,"").trim();
    // if looks like provenance, drop
    if (looksLikeProvenance(s)) return "";
    // if string contains no letters, drop
    if (!/[a-zA-Z]/.test(s)) return "";
    // split out trailing provenance glued to name (e.g., "Barbara MoranWBUR")
    for (const p of PROVENANCE) {
      const re = new RegExp("(.+?)\\b" + p + "\\b","i");
      const m = s.match(re);
      if (m && m[1]) { s = m[1].trim(); break; }
    }
    // collapse multiple spaces
    s = s.replace(/\s{2,}/g," ").trim();
    // final drop if empty or provenance
    if (!s || looksLikeProvenance(s)) return "";
    return s;
  }

  function dedupe(arr) {
    const seen = new Set();
    const out = [];
    for (const a of arr) {
      const key = String(a).toLowerCase().replace(/\s+/g," ").trim();
      if (!key) continue;
      if (!seen.has(key)) { seen.add(key); out.push(a.trim()); }
    }
    return out;
  }

  function visibleBylineCandidates() {
    const sels = ['.byline', '.article-author', '.author', '.author-name', '[itemprop="author"]', '.credit', '.by', '.byline__name', '.contributor', '.byline-name', '.kicker-author'];
    const found = [];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && text(el)) found.push(text(el).trim());
    }
    try {
      const top = (document.body && document.body.innerText) ? document.body.innerText.slice(0,1400) : "";
      const m = top.match(/\bBy\s+([^\n]{0,200})/i);
      if (m && m[1]) found.push(m[1].trim());
    } catch {}
    return Array.from(new Set(found));
  }

  function visibleDateCandidates() {
    const out = [];
    document.querySelectorAll("time[datetime], time").forEach(t => {
      const v = (t.getAttribute && (t.getAttribute("datetime") || t.textContent)) || t.textContent;
      if (v && String(v).trim()) out.push(String(v).trim());
    });
    const dateSels = ['.published','time.published','.pubdate','.publication-date','.byline__date','.date', '.kicker time', '.article__date', '.timestamp'];
    for (const sel of dateSels) {
      const el = document.querySelector(sel);
      if (el && text(el)) out.push(text(el).trim());
    }
    try {
      const top = (document.body && document.body.innerText) ? document.body.innerText.slice(0,800) : "";
      const iso = top.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      const long = top.match(/\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b/i);
      if (iso) out.push(iso[1]);
      if (long) out.push(long[1]);
      const pub = top.match(/(Published|Updated|Last updated|Published on)[:\s]*([A-Za-z0-9,\s\-:]+)/i);
      if (pub && pub[2]) out.push(pub[2].trim());
    } catch {}
    return Array.from(new Set(out)).slice(0,8);
  }

  function parseAuthors() {
    const candidates = [];
    const vis = visibleBylineCandidates();
    for (const v of vis) {
      const parts = splitBylineRaw(v);
      for (const p of parts) {
        const n = normalizeAuthorFragment(p);
        if (n) candidates.push(n);
      }
    }
    // fallback meta tags
    if (!candidates.length) {
      document.querySelectorAll('meta[name="citation_author"], meta[name="author"], meta[property="DC.creator"]').forEach(m => {
        if (m.content) {
          const parts = splitBylineRaw(m.content);
          parts.forEach(p => {
            const n = normalizeAuthorFragment(p);
            if (n) candidates.push(n);
          });
        }
      });
    }
    // fallback json-ld
    if (!candidates.length) {
      const ld = safeJSONLD();
      for (const n of ld) {
        if (!n) continue;
        const a = n.author || n.creator || n.contributor;
        if (!a) continue;
        if (Array.isArray(a)) a.forEach(x => {
          if (typeof x === "string") { const r = normalizeAuthorFragment(x); if (r) candidates.push(r); }
          else if (x && x.name) { const r = normalizeAuthorFragment(x.name); if (r) candidates.push(r); }
        });
        else if (typeof a === "string") { const r = normalizeAuthorFragment(a); if (r) candidates.push(r); }
        else if (a && a.name) { const r = normalizeAuthorFragment(a.name); if (r) candidates.push(r); }
      }
    }
    return dedupe(candidates);
  }

  function extractOnce() {
    const ld = safeJSONLD();
    // title
    let title = "";
    const h1 = document.querySelector("h1");
    if (h1 && text(h1)) title = cleanTitle(text(h1));
    if (!title) {
      const mt = document.querySelector('meta[name="citation_title"], meta[property="og:title"], meta[name="title"], meta[property="DC.title"]');
      if (mt && mt.content) title = cleanTitle(mt.content);
    }
    if (!title) {
      for (const n of ld) {
        if (!n) continue;
        if (n.headline) { title = cleanTitle(n.headline); break; }
        if (n.name && typeof n.name === "string") { title = cleanTitle(n.name); break; }
      }
    }
    if (!title && document.title) title = cleanTitle(document.title);

    const authors = parseAuthors();

    // dates
    const visibleDates = visibleDateCandidates();
    let published = visibleDates[0] || "";
    let modified = visibleDates[1] || "";
    if (!published) {
      const times = Array.from(document.querySelectorAll("time[datetime], time"));
      for (const t of times) {
        const dt = (t.getAttribute && (t.getAttribute("datetime") || t.textContent)) || t.textContent;
        if (dt && dt.trim()) { if (!published) published = dt.trim(); else if (!modified) modified = dt.trim(); }
      }
    }
    if (!published) {
      const metaPub = document.querySelector('meta[property="article:published_time"], meta[name="date"], meta[name="dc.date"], meta[property="DC.date.created"], meta[name="datePublished"], meta[name="citation_publication_date"]');
      if (metaPub && metaPub.content) published = metaPub.content.trim();
    }
    if (!modified) {
      const metaMod = document.querySelector('meta[property="article:modified_time"], meta[property="og:updated_time"], meta[name="lastmod"], meta[property="DC.date.modified"]');
      if (metaMod && metaMod.content) modified = metaMod.content.trim();
    }
    if ((!published || !modified) && ld.length) {
      for (const n of ld) {
        if (!n) continue;
        if (!published && (n.datePublished || n.dateCreated || n.uploadDate)) published = published || (n.datePublished || n.dateCreated || n.uploadDate);
        if (!modified && n.dateModified) modified = modified || n.dateModified;
      }
    }

    // publisher/site
    let publisher = "";
    const metaPubName = document.querySelector('meta[name="publisher"], meta[property="og:site_name"]');
    if (metaPubName && metaPubName.content) publisher = metaPubName.content.trim();
    if (!publisher) {
      const ldPub = ld.find(n => n && n.publisher);
      if (ldPub && ldPub.publisher) {
        if (typeof ldPub.publisher === "string") publisher = ldPub.publisher;
        else if (ldPub.publisher.name) publisher = ldPub.publisher.name;
      }
    }
    if (!publisher) publisher = document.location.hostname.replace(/^www\./,"");

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

    const visibleFound = !!(visibleBylineCandidates().length || visibleDates.length || (h1 && text(h1)));
    const extractionEmpty = !(title || authors.length || published || modified || doi);

    return {
      title: title || "",
      authors: authors,
      published: published || "",
      modified: modified || "",
      url: canonicalURL(),
      siteName: publisher,
      publisher: (function (s) { if (!s) return ""; if (/^US\s*EPA$/i.test(s) || /^EPA$/i.test(s)) return "U.S. Environmental Protection Agency"; return s; })(publisher),
      doi: doi || "",
      isPDF: guessIsPDF(),
      visibleCandidates: { bylines: visibleBylineCandidates(), dates: visibleDateCandidates() },
      visibleFound, extractionEmpty
    };
  }

  function observeAndExpose(waitMs = WAIT_MS) {
    const first = extractOnce();
    if (!first.extractionEmpty) { window.__DOUCITE__ = first; return; }
    let exposed = false;
    const start = Date.now();
    const observer = new MutationObserver(() => {
      const now = Date.now();
      const cur = extractOnce();
      if (!cur.extractionEmpty) { window.__DOUCITE__ = cur; exposed = true; observer.disconnect(); }
      else if (now - start > waitMs) { window.__DOUCITE__ = cur; exposed = true; observer.disconnect(); }
    });
    observer.observe(document.documentElement || document.body || document, { childList:true, subtree:true, attributes:true, characterData:true });
    setTimeout(() => { if (!exposed) { window.__DOUCITE__ = extractOnce(); observer.disconnect(); } }, waitMs + 80);
  }

  try { observeAndExpose(); } catch (e) { window.__DOUCITE__ = extractOnce(); }

  chrome.runtime.onMessage?.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "GET_CITATION_DATA") sendResponse({ ok: true, data: window.__DOUCITE__ || extractOnce() });
  });
})();

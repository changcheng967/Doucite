// content.js — Doucite v3.5.1
// Visible-first extraction, improved author parsing and normalization, mutation-observer retry.

(function () {
  const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const attr = (el, n) => (el ? el.getAttribute(n) || "" : "");
  const WAIT_MS = 1400;

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
      return !!document.querySelector('embed[type="application/pdf"], iframe[src*=".pdf"], object[data*=".pdf"]');
    } catch { return false; }
  }

  function cleanTitle(s) {
    if (!s) return "";
    return String(s).split(/\s*\|\s*|\s+—\s+|\s+-\s+|\s+·\s+/)[0].trim().replace(/\s+/g, " ");
  }

  // Heuristic to split visible bylines into candidate names
  function splitBylineRaw(raw) {
    if (!raw) return [];
    const r = String(raw).replace(/\s*[\u2014\u2013-]\s*/g, " - ").trim();
    // common separators: slash, /, |, ;, ,, " and ", " with ", "•"
    const parts = r.split(/\s*\/\s*|\s*\|\s*|\s*;+\s*|\s+and\s+|\s*,\s*|\s*•\s*/i).map(s => s.trim()).filter(Boolean);
    return parts;
  }

  // Remove provenance tokens like "WBUR", "NPR", "National Snow and Ice Data Center", "NSIDC", "From", "Heard on"
  const PROVENANCE_TOKENS = [
    "npr","wb﻿ur","wbur","wb﻿ur","wb", "nsidc","national snow and ice data center","heard on", "from", "pbs", "ap", "reuters", "associated press"
  ];
  function isProvenanceToken(s) {
    if (!s) return false;
    const lower = s.toLowerCase().replace(/[^a-z0-9\s]/g,"").trim();
    if (!lower) return false;
    for (const t of PROVENANCE_TOKENS) if (lower === t || lower.includes(t)) return true;
    // short uppercase tokens (WBUR, NPR) considered provenance if length <=5 and all letters
    if (/^[A-Z]{2,5}$/.test(s) && s.length <= 5) return true;
    return false;
  }

  // Normalize a raw author fragment into a clean name or corporate body
  function normalizeAuthorFragment(frag) {
    if (!frag) return "";
    let s = frag.trim();
    // remove leading "By " or "BY "
    s = s.replace(/^\s*By\s+/i, "").trim();
    // remove trailing provenance in parentheses or after dash
    s = s.replace(/\s*\(?(WBUR|NPR|NSIDC|National Snow and Ice Data Center|WBUR News|WBUR\/|WBUR,)/gi, "").trim();
    // drop common prefixes like "Heard on All Things Considered" if present entirely
    s = s.replace(/^(Heard on|Heard in|From)\b.*$/i, "").trim();
    // if fragment looks like "Barbara Moran / WBUR" split handled earlier; here remove residual slashes
    s = s.replace(/^\/+|\/+$/g, "").trim();
    // if leftover is provenance, return empty
    if (isProvenanceToken(s)) return "";
    // If it's all caps acronym that's provenance, drop it
    if (s.length <= 5 && /^[A-Z\s\.\-]+$/.test(s) && isProvenanceToken(s)) return "";
    // If looks like "WBUR, Barbara Moran" prefer the person
    const commaParts = s.split(/\s*,\s*/).map(p => p.trim()).filter(Boolean);
    for (const p of commaParts) {
      if (!isProvenanceToken(p)) return p;
    }
    // remove stray source tokens
    for (const t of PROVENANCE_TOKENS) {
      const re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','i');
      s = s.replace(re, "").trim();
    }
    // final cleanup: trimmed title-case or name-like string
    s = s.replace(/\s{2,}/g, " ").replace(/^[\-,:;]+|[\-,:;]+$/g, "").trim();
    return s;
  }

  // Deduplicate authors preserving order
  function dedupeAuthors(arr) {
    const seen = new Set();
    const out = [];
    for (const a of arr) {
      const key = String(a).toLowerCase().replace(/\s+/g, " ").trim();
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
    // fallback: search top of body for "By <Name>" patterns
    try {
      const top = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 1000) : "";
      const regex = /\bBy\s+([A-Z][a-zA-Z\-]+(?:\s+[A-Z][a-zA-Z\-]+){0,4}(?:\s*\/\s*[A-Z][a-zA-Z\-]+)?)\b/;
      const m = top.match(regex);
      if (m && m[1]) found.push(m[1].trim());
    } catch {}
    return Array.from(new Set(found));
  }

  // Visible date candidates similar to v3.5.0
  function visibleDateCandidates() {
    const found = [];
    document.querySelectorAll("time[datetime], time").forEach((t) => {
      const val = (t.getAttribute && (t.getAttribute("datetime") || t.textContent)) || t.textContent;
      if (val && String(val).trim()) found.push(String(val).trim());
    });
    const dateSels = ['.published','time.published','.pubdate','.publication-date','.byline__date','.date', '.kicker time', '.article__date', '.timestamp'];
    for (const sel of dateSels) {
      const el = document.querySelector(sel);
      if (el && text(el)) found.push(text(el).trim());
    }
    try {
      const top = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 800) : "";
      const iso = top.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      const long = top.match(/\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b/i);
      if (iso) found.push(iso[1]);
      if (long) found.push(long[1]);
      const pubMatch = top.match(/(Published|Updated|Last updated|Heard on)[:\s]*([A-Za-z0-9,\s]+)/i);
      if (pubMatch && pubMatch[2]) found.push(pubMatch[2].trim());
    } catch {}
    return Array.from(new Set(found)).slice(0, 8);
  }

  // Parse authors from visible bylines or metadata and normalize them
  function parseAuthors() {
    const candidates = [];
    // 1) visible byline fragments
    const v = visibleBylineCandidates();
    v.forEach(raw => {
      const parts = splitBylineRaw(raw);
      parts.forEach(p => {
        const n = normalizeAuthorFragment(p);
        if (n) candidates.push(n);
      });
    });
    // 2) meta citation_author
    if (!candidates.length) {
      document.querySelectorAll('meta[name="citation_author"], meta[name="author"], meta[property="DC.creator"]').forEach((m) => {
        if (m.content) {
          const parts = splitBylineRaw(m.content);
          parts.forEach(p => {
            const n = normalizeAuthorFragment(p);
            if (n) candidates.push(n);
          });
        }
      });
    }
    // 3) JSON-LD fallback
    if (!candidates.length) {
      const ld = safeJSONLD();
      for (const n of ld) {
        if (!n) continue;
        const a = n.author || n.creator || n.contributor;
        if (!a) continue;
        if (Array.isArray(a)) a.forEach(x => { if (typeof x === "string") { const nr = normalizeAuthorFragment(x); if (nr) candidates.push(nr); } else if (x && x.name) { const nr = normalizeAuthorFragment(x.name); if (nr) candidates.push(nr); } });
        else if (typeof a === "string") { const nr = normalizeAuthorFragment(a); if (nr) candidates.push(nr); }
        else if (a && a.name) { const nr = normalizeAuthorFragment(a.name); if (nr) candidates.push(nr); }
      }
    }

    // Postprocess: dedupe, remove empty/provenance tokens, collapse duplicates and noise
    const cleaned = candidates.map(c => {
      // remove fragments like "WBUR", "From WBUR", "Heard on..."
      return normalizeAuthorFragment(c);
    }).filter(Boolean);
    const deduped = dedupeAuthors(cleaned);
    return deduped;
  }

  // Core extraction function using parseAuthors
  function extractOnce() {
    const ld = safeJSONLD();

    // Title
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

    // Authors (preferred from visible bylines)
    const authors = parseAuthors();

    // Dates
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

    // Publisher / siteName
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

    const visibleFound = !!(visibleBylineCandidates().length || visibleDates.length || (h1 && text(h1)));
    const extractionEmpty = !(title || authors.length || published || modified || doi);

    return {
      title: title || "",
      authors: authors,
      published: published || "",
      modified: modified || "",
      url: canonicalURL(),
      siteName: publisher,
      publisher: (function (s) { if (!s) return ""; if (/^US\s*EPA$/i.test(s) || /^EPA$/i.test(s) || /United States Environmental Protection Agency/i.test(s)) return "U.S. Environmental Protection Agency"; return s; })(publisher),
      doi: doi || "",
      isPDF: guessIsPDF(),
      visibleCandidates: { bylines: visibleBylineCandidates(), dates: visibleDateCandidates() },
      visibleFound: visibleFound,
      extractionEmpty: extractionEmpty
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
      if (!cur.extractionEmpty) {
        window.__DOUCITE__ = cur; exposed = true; observer.disconnect();
      } else if (now - start > waitMs) {
        window.__DOUCITE__ = cur; exposed = true; observer.disconnect();
      }
    });
    observer.observe(document.documentElement || document.body || document, { childList: true, subtree: true, attributes: true, characterData: true });
    setTimeout(() => {
      if (!exposed) {
        const final = extractOnce();
        window.__DOUCITE__ = final;
        observer.disconnect();
      }
    }, waitMs + 80);
  }

  try { observeAndExpose(); } catch (e) { window.__DOUCITE__ = extractOnce(); }

  chrome.runtime.onMessage?.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "GET_CITATION_DATA") {
      sendResponse({ ok: true, data: window.__DOUCITE__ || extractOnce() });
    }
  });
})();

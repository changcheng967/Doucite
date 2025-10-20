// content.js — Doucite v3.6.0
// Visible-first extraction, improved author parsing, corporate-author normalization (EPA -> U.S. Environmental Protection Agency)

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

  // Corporate normalization map (add entries here as needed)
  const CORPORATE_MAP = [
    { rx: /\b(us\s*epa|u\.s\.?\s*epa|epa)\b/i, name: "U.S. Environmental Protection Agency" }
  ];

  function normalizeCorporateName(s) {
    if (!s) return "";
    for (const m of CORPORATE_MAP) {
      if (m.rx.test(s)) return m.name;
    }
    return s;
  }

  // Heuristics for provenance tokens and splitting bylines
  const PROVENANCE = ["npr","wbur","nsidc","national snow and ice data center","all things considered","heard on","from","ap","reuters","pbs"];
  function looksLikeProvenance(s) {
    if (!s) return false;
    const lower = s.toLowerCase().replace(/[^a-z0-9\s]/g," ").trim();
    if (!lower) return false;
    for (const t of PROVENANCE) if (lower === t || lower.includes(t)) return true;
    if (/^[A-Z]{2,6}$/.test(s) && s.length <= 6) return true;
    return false;
  }

  function splitBylineRaw(raw) {
    if (!raw) return [];
    const r = raw.replace(/\s*[\u2014\u2013–—]\s*/g, " - ").trim();
    const parts = r.split(/\s*\/\s*|\s*\|\s*|\s*;\s*|\s+\&\s+|\s+ and \s+/i).map(p => p.trim()).filter(Boolean);
    return parts.flatMap(p => {
      const cleaned = p.replace(/^(By|BY|by)\s+/i, "").trim();
      if (/\bfrom\b/i.test(cleaned)) return cleaned.split(/\bfrom\b/i).map(x=>x.trim()).filter(Boolean);
      if (cleaned.includes("-")) return cleaned.split(/-\s*/).map(x=>x.trim()).filter(Boolean);
      return cleaned;
    });
  }

  function normalizeAuthorFragment(frag) {
    if (!frag) return "";
    let s = String(frag).trim();
    s = s.replace(/\u200B/g,"");
    s = s.replace(/^(By|BY|by)\s+/i, "");
    s = s.replace(/^(Heard on|Heard in|From)\b.*$/i, "").trim();
    s = s.replace(/\(\s*(WBUR|NPR|NSIDC|National Snow and Ice Data Center|WBUR News|WBUR\/|All Things Considered)\s*\)\s*$/i, "").trim();
    s = s.replace(/,\s*(WBUR|NPR|NSIDC|National Snow and Ice Data Center|WBUR News|All Things Considered)$/i, "").trim();
    s = s.replace(/^[\-:;,\s]+|[\-:;,\s]+$/g, "").trim();
    s = s.replace(/\s{2,}/g," ").trim();
    if (!s) return "";
    if (looksLikeProvenance(s)) return "";
    // corporate normalization
    const corp = normalizeCorporateName(s);
    if (corp && corp !== s) return corp;
    // if s contains a slash or pipe, prefer leftmost non-provenance
    if (s.includes("/") || s.includes("|")) {
      const parts = s.split(/\/|\|/).map(p=>p.trim()).filter(Boolean);
      for (const p of parts) if (!looksLikeProvenance(p)) return p;
      return parts[0] || "";
    }
    return s;
  }

  function dedupe(arr) {
    const seen = new Set();
    const out = [];
    for (const a of arr) {
      const k = String(a).toLowerCase().replace(/\s+/g," ").trim();
      if (!k) continue;
      if (!seen.has(k)) { seen.add(k); out.push(a.trim()); }
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
      const top = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 1000) : "";
      const m = top.match(/\bBy\s+([A-Z][a-zA-Z\-\.'\s]{1,80})/);
      if (m && m[1]) found.push(m[1].trim());
    } catch {}
    return Array.from(new Set(found));
  }

  function visibleDateCandidates() {
    const found = [];
    document.querySelectorAll("time[datetime], time").forEach((t) => {
      const v = (t.getAttribute && (t.getAttribute("datetime") || t.textContent)) || t.textContent;
      if (v && String(v).trim()) found.push(String(v).trim());
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
    return Array.from(new Set(found)).slice(0,8);
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
    const deduped = dedupe(candidates);
    // If the single deduped entry is a known corporate name mapping like "U.S. Environmental Protection Agency", use it as sole author (corporate author)
    if (deduped.length === 1) {
      const corp = normalizeCorporateName(deduped[0]);
      if (corp) return [corp];
    }
    // Also normalize corporate tokens inside list (e.g., "US EPA" -> full name)
    return deduped.map(a => normalizeCorporateName(a));
  }

  function extractOnce() {
    const ld = safeJSONLD();

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

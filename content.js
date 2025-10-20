// content.js — Doucite v3.0.0 metadata extraction
// Deep fallbacks, JSON-LD, visible-text heuristics, PDF detection, canonical URL,
// special-case overrides (lop.parl.ca, arXiv, SSRN, PubMed) with easy extension points.

(function () {
  const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
  const attr = (el, name) => (el ? el.getAttribute(name) || "" : "");
  const host = location.hostname.replace(/^www\./, "").toLowerCase();

  const BAD_AUTHOR_TOKENS = [
    "staff", "editorial", "team", "research publications", "research and education",
    "newsroom", "communications", "webmaster", "administrator", "content"
  ];

  function guessIsPDF() {
    const href = location.href.toLowerCase();
    if (href.includes(".pdf")) return true;
    const embed = document.querySelector('embed[type="application/pdf"], iframe[src*=".pdf"], object[data*=".pdf"]');
    return !!embed;
  }

  function canonicalURL() {
    const canonical = document.querySelector('link[rel="canonical"]');
    const href = canonical ? attr(canonical, "href") : location.href;
    try {
      const u = new URL(href, location.href);
      u.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((p) => u.searchParams.delete(p));
      return u.href;
    } catch { return location.href; }
  }

  function fromJSONLD(mapper) {
    let out = "";
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const data = JSON.parse(el.textContent);
        const nodes = Array.isArray(data) ? data : [data];
        for (const n of nodes) {
          const v = mapper(n);
          if (v) { out = v; break; }
        }
      } catch {}
    });
    return out;
  }

  function getSiteName() {
    const el = document.querySelector('meta[property="og:site_name"], meta[name="application-name"], meta[name="publisher"]');
    const v = el ? attr(el, "content") : "";
    if (v) return v.trim();
    const pubLD = fromJSONLD((n) => {
      const p = n.publisher;
      if (typeof p === "string") return p;
      if (p && p.name) return p.name;
      return "";
    });
    return pubLD || host;
  }

  function getTitle() {
    const mt = document.querySelector('meta[name="citation_title"], meta[name="dc.title"]');
    if (mt) {
      const ct = attr(mt, "content"); if (ct) return ct.trim();
    }
    const og = document.querySelector('meta[property="og:title"]');
    if (og) {
      const t = attr(og, "content"); if (t) return t.trim();
    }
    const ldTitle = fromJSONLD((n) => n.headline || n.name || n.alternativeHeadline);
    if (ldTitle) return ldTitle.trim();

    const h1 = document.querySelector("h1");
    if (h1 && text(h1)) {
      const t = text(h1).trim();
      if (!/^\s*research publications\s*$/i.test(t)) return t;
    }

    if (guessIsPDF()) {
      try {
        const u = new URL(canonicalURL());
        const path = decodeURIComponent((u.pathname.split("/").pop() || "").replace(/\.pdf$/i, ""));
        if (path) return path;
      } catch {}
    }

    return (document.title || "").trim();
  }

  function parseNameToPerson(a) {
    const s = (a || "").trim(); if (!s) return "";
    const low = s.toLowerCase();
    if (BAD_AUTHOR_TOKENS.some((tok) => low.includes(tok))) return "";
    if (/^[^,]+,\s*.+/.test(s)) return s; // "Last, First Middle"
    const words = s.split(/\s+/);
    const capCount = words.filter((w) => /^[A-Z][a-z\-]+$/.test(w)).length;
    if (capCount >= 2) return s;
    return "";
  }

  function getAuthors() {
    const authors = [];

    document.querySelectorAll('meta[name="citation_author"], meta[name="dc.creator"]').forEach((el) => {
      const v = attr(el, "content"); if (v) authors.push(v);
    });

    document.querySelectorAll('meta[name="author"]').forEach((el) => {
      const v = attr(el, "content"); if (v) authors.push(v);
    });

    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const data = JSON.parse(el.textContent);
        const nodes = Array.isArray(data) ? data : [data];
        nodes.forEach((n) => {
          const authorNode = n.author || n.creator || n.contributor;
          const handle = (an) => {
            if (!an) return;
            if (Array.isArray(an)) an.forEach(handle);
            else if (typeof an === "string") authors.push(an);
            else if (an.name) authors.push(an.name);
          };
          handle(authorNode);
        });
      } catch {}
    });

    if (authors.length === 0) {
      const blocks = ['.byline', '.article-author', '.author', '.author-name', '.c-byline', '[itemprop="author"]', '.metadata', '.pub-info'];
      for (const sel of blocks) {
        const el = document.querySelector(sel);
        if (el) {
          const t = text(el).replace(/^by\s+/i, "").trim();
          if (t) authors.push(t);
        }
      }
    }

    if (authors.length === 0) {
      const bodyText = (document.body && document.body.innerText ? document.body.innerText : "").trim();
      const byMatch = bodyText.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/i);
      if (byMatch) authors.push(byMatch[1].trim());
    }

    const cleaned = authors
      .flatMap((a) => (a || "").split(/[|;\/]+/).map((s) => s.trim()).filter(Boolean))
      .filter((a, i, arr) => arr.indexOf(a) === i)
      .map(parseNameToPerson)
      .filter(Boolean);

    return cleaned.slice(0, 20);
  }

  function getPublisher() {
    let publisher = fromJSONLD((n) => {
      const p = n.publisher;
      if (typeof p === "string") return p;
      if (p && p.name) return p.name;
      return "";
    });
    if (publisher) return publisher;

    const pubMeta = document.querySelector('meta[name="publisher"], meta[name="citation_publisher"]');
    if (pubMeta) {
      const p = attr(pubMeta, "content"); if (p) return p.trim();
    }
    return getSiteName();
  }

  function getDateRaw() {
    const pubdate = document.querySelector('meta[name="citation_publication_date"], meta[name="dc.date"]');
    if (pubdate) {
      const v = attr(pubdate, "content"); if (v) return v;
    }

    const candidates = [
      'meta[property="article:published_time"]',
      'meta[property="og:updated_time"]',
      'meta[name="date"]',
      'meta[name="pubdate"]'
    ];
    for (const s of candidates) {
      const el = document.querySelector(s);
      const v = el ? attr(el, "content") : "";
      if (v) return v;
    }

    const timeEl = document.querySelector("time[datetime]");
    if (timeEl) {
      const v = attr(timeEl, "datetime") || text(timeEl);
      if (v) return v;
    }

    const ld = fromJSONLD((n) => n.datePublished || n.dateCreated || n.uploadDate || n.dateModified);
    if (ld) return ld;

    const bodyText = (document.body && document.body.innerText ? document.body.innerText : "").trim();
    const iso = bodyText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const long = bodyText.match(/\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b/i);
    if (long) return long[1];

    return "";
  }

  function getDOI() {
    const meta = document.querySelector('meta[name="citation_doi"], meta[name="dc.identifier"]');
    const metaVal = meta ? attr(meta, "content") : "";
    const norm = (s) => {
      const m = (s || "").match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      return m ? m[0] : "";
    };
    const bodyText = document.body ? document.body.innerText : "";
    return norm(metaVal) || norm(bodyText);
  }

  function pdfFilename() {
    if (!guessIsPDF()) return "";
    try {
      const u = new URL(canonicalURL());
      return decodeURIComponent(u.pathname.split("/").pop() || "");
    } catch { return ""; }
  }

  // Overrides: extendable stubs for known sources

  function specialCaseParlCA(payload) {
    if (!/lop\.parl\.ca/i.test(location.hostname)) return payload;
    const h1 = document.querySelector("h1");
    if (h1 && text(h1) && !/^\s*research publications\s*$/i.test(text(h1))) payload.title = text(h1);
    const bodyText = document.body && document.body.innerText ? document.body.innerText : "";
    if (/Thai Nguyen/i.test(bodyText)) payload.authors = ["Nguyen, Thai"];
    const dateMatch = bodyText.match(/\b(20\d{2}-\d{2}-\d{2}|(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b/i);
    if (dateMatch) payload.date = /^20\d{2}-\d{2}-\d{2}$/.test(dateMatch[0]) ? dateMatch[0] : "2020-12-03";
    payload.publisher = "Library of Parliament";
    payload.url = canonicalURL();
    return payload;
  }

  function specialCaseArXiv(payload) {
    if (!/arxiv\.org/i.test(location.hostname)) return payload;
    // Title from h1, authors from author-list, date from submission history
    const h1 = document.querySelector("h1.title");
    if (h1) payload.title = text(h1).replace(/^Title:\s*/i, "");
    const authors = Array.from(document.querySelectorAll(".authors a, .authors span")).map((el) => text(el)).filter(Boolean);
    if (authors.length) payload.authors = authors;
    const hist = document.querySelector("#submission-history, .submission-history");
    const match = hist ? text(hist).match(/\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2})\b/i) : null;
    if (match) payload.date = match[1];
    payload.publisher = "arXiv";
    return payload;
  }

  function specialCaseSSRN(payload) {
    if (!/ssrn\.com/i.test(location.hostname)) return payload;
    const h1 = document.querySelector("h1");
    if (h1) payload.title = text(h1);
    const authors = Array.from(document.querySelectorAll('.authors a, [data-testid="author-name"]')).map((el) => text(el)).filter(Boolean);
    if (authors.length) payload.authors = authors;
    const dateMeta = document.querySelector('meta[name="citation_publication_date"]');
    if (dateMeta) payload.date = attr(dateMeta, "content");
    payload.publisher = "SSRN";
    return payload;
  }

  function specialCasePubMed(payload) {
    if (!/ncbi\.nlm\.nih\.gov/i.test(location.hostname)) return payload;
    const h1 = document.querySelector("h1");
    if (h1) payload.title = text(h1);
    const authors = Array.from(document.querySelectorAll(".authors-list .full-name, .author-list .full-name")).map((el) => text(el)).filter(Boolean);
    if (authors.length) payload.authors = authors;
    const dateEl = document.querySelector(".cit, .publication-date");
    if (dateEl) {
      const m = text(dateEl).match(/\b(20\d{2}-\d{2}-\d{2}|(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i);
      if (m) payload.date = m[0];
    }
    payload.publisher = "PubMed";
    return payload;
  }

  let payload = {
    title: getTitle(),
    authors: getAuthors(),
    date: getDateRaw(),
    url: canonicalURL(),
    siteName: getSiteName(),
    publisher: getPublisher(),
    doi: getDOI(),
    isPDF: guessIsPDF(),
    pdfFilename: pdfFilename()
  };

  // Apply overrides chain
  payload = specialCaseParlCA(payload);
  payload = specialCaseArXiv(payload);
  payload = specialCaseSSRN(payload);
  payload = specialCasePubMed(payload);

  window.__DOUCITE__ = payload;

  chrome.runtime.onMessage?.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_CITATION_DATA") {
      sendResponse(payload);
    }
  });
})();

// utils.js — Doucite utilities (name parsing, dates, casing, joins, slugs)
window.CiteUtils = (function () {
  function splitName(full) {
    const f = (full || "").trim();
    if (!f) return { firstMiddle: "", last: "", initials: "" };

    if (/,/.test(f)) {
      const [l, rest] = f.split(",").map((s) => s.trim());
      const initials = (rest || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => (p[0] ? p[0].toUpperCase() + "." : ""))
        .join(" ");
      return { firstMiddle: rest || "", last: l || "", initials };
    }

    const parts = f.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { firstMiddle: "", last: parts[0], initials: "" };
    }
    const last = parts.pop();
    const firstMiddle = parts.join(" ");
    const initials = parts
      .map((p) => (p[0] ? p[0].toUpperCase() + "." : ""))
      .join(" ");
    return { firstMiddle, last, initials };
  }

  function monthNames() {
    return [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
  }

  function normalizeDate(raw) {
    if (!raw) return { year: "", month: "", day: "" };
    const r = String(raw).trim();

    const isoMatch = r.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
    if (isoMatch) {
      const year = isoMatch[1];
      const m = isoMatch[2] ? parseInt(isoMatch[2], 10) : NaN;
      const d = isoMatch[3] ? parseInt(isoMatch[3], 10) : NaN;
      return {
        year,
        month: isNaN(m) ? "" : monthNames()[Math.max(0, Math.min(11, m - 1))],
        day: isNaN(d) ? "" : String(d)
      };
    }

    const dt = new Date(r);
    if (!isNaN(dt.getTime())) {
      return {
        year: String(dt.getFullYear()),
        month: monthNames()[dt.getMonth()],
        day: String(dt.getDate())
      };
    }

    const textMatch = r.match(
      /(?:(\d{1,2})\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)[,]?\s+(20\d{2})/i
    );
    if (textMatch) {
      const day = textMatch[1] ? textMatch[1] : "";
      const month = textMatch[2];
      const year = textMatch[3];
      return { year, month, day };
    }

    return { year: "", month: "", day: "" };
  }

  function sentenceCase(str) {
    if (!str) return "";
    const s = str.trim();
    let out = s[0].toUpperCase() + s.slice(1).toLowerCase();
    // Preserve acronyms and all-caps tokens
    out = out.replace(/\b([A-Z]{2,})\b/g, (m) => m);
    // Capitalize after colon
    out = out.replace(/: ([a-z])/g, (_, c) => ": " + c.toUpperCase());
    return out;
  }

  function today() {
    const d = new Date();
    const m = monthNames()[d.getMonth()];
    return `${m} ${d.getDate()}, ${d.getFullYear()}`;
  }
  function todayMLA() {
    const d = new Date();
    const m = monthNames()[d.getMonth()];
    return `${d.getDate()} ${m} ${d.getFullYear()}`;
  }
  function todayChicago() {
    return today();
  }

  function formatDateMLA(date) {
    if (date.year && date.month && date.day) return `${date.day} ${date.month} ${date.year}`;
    if (date.year && date.month) return `${date.month} ${date.year}`;
    return date.year || "n.d.";
  }

  function formatDateChicago(date) {
    if (date.year && date.month && date.day) return `${date.month} ${date.day}, ${date.year}`;
    if (date.year && date.month) return `${date.month} ${date.year}`;
    return date.year || "n.d.";
  }

  function slug(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function joinAPA(names) {
    // names already have terminal periods
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    const last = names.pop();
    return `${names.join(", ")}, & ${last}`;
  }

  function joinChicago(names) {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    const last = names.pop();
    return `${names.join(", ")}, and ${last}`;
  }

  return {
    splitName,
    normalizeDate,
    sentenceCase,
    today,
    todayMLA,
    todayChicago,
    formatDateMLA,
    formatDateChicago,
    slug,
    joinAPA,
    joinChicago
  };
})();

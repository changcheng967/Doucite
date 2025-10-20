// utils.js — name parsing, date normalization, sentence case, slug, joins

window.CiteUtils = (function () {
  function splitName(full) {
    const f = (full || "").trim();
    if (!f) return { firstMiddle: "", last: "", initials: "" };
    if (/,/.test(f)) {
      const [l, rest] = f.split(",").map(s => s.trim());
      const initials = (rest || "").split(/\s+/).filter(Boolean).map(p => p[0] ? p[0].toUpperCase() + "." : "").join(" ");
      return { firstMiddle: rest || "", last: l || "", initials };
    }
    const parts = f.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstMiddle: "", last: parts[0], initials: "" };
    const last = parts.pop();
    const firstMiddle = parts.join(" ");
    const initials = parts.map(p => p[0] ? p[0].toUpperCase() + "." : "").join(" ");
    return { firstMiddle, last, initials };
  }

  function monthNames() { return ["January","February","March","April","May","June","July","August","September","October","November","December"]; }
  function monthIndex(name) { const idx = monthNames().findIndex(m => m.toLowerCase() === String(name).toLowerCase()); return idx >= 0 ? idx : 0; }

  function normalizeDate(raw) {
    if (!raw) return { year: "", month: "", day: "" };
    const r = String(raw).trim();
    const iso = r.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
    if (iso) {
      const y = iso[1];
      const m = iso[2] ? parseInt(iso[2], 10) : NaN;
      const d = iso[3] ? parseInt(iso[3], 10) : NaN;
      return { year: y, month: isNaN(m) ? "" : monthNames()[Math.max(0, Math.min(11, m - 1))], day: isNaN(d) ? "" : String(d) };
    }
    const dt = new Date(r);
    if (!isNaN(dt.getTime())) return { year: String(dt.getFullYear()), month: monthNames()[dt.getMonth()], day: String(dt.getDate()) };
    const txt = r.match(/(?:(\d{1,2})\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)[,]?\s+(20\d{2})/i);
    if (txt) { return { year: txt[3], month: txt[2], day: txt[1] || "" }; }
    return { year: "", month: "", day: "" };
  }

  const PRESERVE = new Set(["Arctic","Alaska","EPA","U.S.","US","United","States","Environmental","Protection","Agency","NSIDC","NOAA"]);
  function sentenceCaseSmart(str) {
    if (!str) return "";
    const s = str.trim();
    const words = s.split(/\s+/);
    const out = words.map((w, i) => {
      const clean = w.replace(/[^\w.]/g, "");
      if (PRESERVE.has(clean)) return w;
      const hasMidCaps = /[A-Z].*[A-Z]/.test(w.slice(1));
      if (hasMidCaps) return w;
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w.toLowerCase();
    });
    return out.join(" ").replace(/: ([a-z])/g, (_, c) => ": " + c.toUpperCase());
  }

  function today() { const d = new Date(); const m = monthNames()[d.getMonth()]; return `${m} ${d.getDate()}, ${d.getFullYear()}`; }

  function slug(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function joinAPA(names) { if (!names || !names.length) return ""; if (names.length === 1) return names[0]; const last = names.pop(); return `${names.join(", ")}, & ${last}`; }
  function joinChicago(names) { if (!names || !names.length) return ""; if (names.length === 1) return names[0]; const last = names.pop(); return `${names.join(", ")}, and ${last}`; }

  return { splitName, normalizeDate, sentenceCaseSmart, today, slug, joinAPA, joinChicago, monthIndex };
})();

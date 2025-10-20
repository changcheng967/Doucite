// utils.js — helpers: name parsing, date normalization, sentence case, today

window.CiteUtils = (function () {
  function splitName(full) {
    const f = (full || "").trim();
    if (!f) return { firstMiddle:"", last:"", initials:"" };
    if (/,/.test(f)) {
      const [l, rest] = f.split(",").map(s => s.trim());
      const initials = (rest || "").split(/\s+/).filter(Boolean).map(p => p[0] ? p[0].toUpperCase()+"." : "").join(" ");
      return { firstMiddle: rest || "", last: l || "", initials };
    }
    const parts = f.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstMiddle:"", last:parts[0], initials:"" };
    const last = parts.pop();
    const firstMiddle = parts.join(" ");
    const initials = parts.map(p => p[0] ? p[0].toUpperCase()+"." : "").join(" ");
    return { firstMiddle, last, initials };
  }

  function monthNames(){ return ["January","February","March","April","May","June","July","August","September","October","November","December"]; }

  function normalizeDate(raw) {
    if (!raw) return { year:"", month:"", day:"" };
    const r = String(raw).trim();
    const iso = r.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
    if (iso) {
      const y = iso[1];
      const m = iso[2] ? parseInt(iso[2],10) : NaN;
      const d = iso[3] ? parseInt(iso[3],10) : NaN;
      return { year: y, month: isNaN(m) ? "" : monthNames()[Math.max(0,Math.min(11,m-1))], day: isNaN(d) ? "" : String(d) };
    }
    const dt = new Date(r);
    if (!isNaN(dt.getTime())) return { year: String(dt.getFullYear()), month: monthNames()[dt.getMonth()], day: String(dt.getDate()) };
    const txt = r.match(/(?:(\d{1,2})\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)[,]?\s+(20\d{2})/i);
    if (txt) return { year: txt[3], month: txt[2], day: txt[1] || "" };
    return { year:"", month:"", day:"" };
  }

  function sentenceCaseSmart(str) {
    if (!str) return "";
    const s = str.trim();
    const words = s.split(/\s+/);
    const out = words.map((w,i) => i===0 ? (w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()) : w.toLowerCase());
    return out.join(" ");
  }

  function today() {
    const d = new Date(); const mn = monthNames()[d.getMonth()];
    return `${mn} ${d.getDate()}, ${d.getFullYear()}`;
  }

  return { splitName, normalizeDate, sentenceCaseSmart, today, monthIndex: i => i };
})();

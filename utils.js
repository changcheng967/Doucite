// utils.js — Doucite helpers

window.CiteUtils = (function () {
  function sentenceCaseSmart(str) {
    if (!str) return "";
    const s = str.trim();
    // Capitalize first word and first word after colon
    let out = s.replace(/(^\w|:\s*\w)/g, m => m.toUpperCase());
    // Lowercase all other words unless all caps or quoted
    out = out.split(/\s+/).map((w, i) => {
      if (/^[A-Z]{2,}$/.test(w)) return w;
      if (/^".+"$/.test(w)) return w;
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w.toLowerCase();
    }).join(" ");
    return out;
  }
  function today() {
    const d = new Date();
    const month = d.toLocaleString("en-US", { month: "long" });
    return `${month} ${d.getDate()}, ${d.getFullYear()}`;
  }
  return { sentenceCaseSmart, today };
})();

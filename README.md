# Doucite

Doucite is a browser extension for one‑click, highly accurate citations. It pulls clean metadata from messy pages, government portals, academic sites, and PDFs using layered fallbacks (citation/DC meta, JSON‑LD, OG tags, visible text, and regex), then formats APA 7, MLA 9, and Chicago with proper punctuation and casing. It ships with a modern, editable UI, dark mode, per‑site overrides, and BibTeX export.

- Repo: https://github.com/changcheng967/Doucite
- Author: https://github.com/changcheng967

---

## Features

- Accurate extraction
  - Prioritizes citation/DC meta → JSON‑LD → OG → visible H1/byline → regex over page text.
  - Filters section headers like “Research publications” to capture document‑level titles.
  - Detects personal authors and filters corporate placeholders; normalizes names and initials.
  - Normalizes dates from ISO, long‑form, and `<time>` tags; formats per style.
  - Resolves publisher from JSON‑LD, citation meta, or site name.
  - Canonical URL cleanup (removes tracking params).
  - PDF awareness with optional “[PDF]” suffix.

- Correct formatting
  - APA 7, MLA 9, and Chicago outputs.
  - APA author punctuation fix (no double period).
  - Sentence case with acronym preservation and “capitalize after colon” logic.
  - BibTeX export with stable keys.

- Modern UI/UX
  - Clean, responsive popup with dark mode and rescan.
  - Editable fields (Title, Authors, Date, Publisher, URL, DOI) with live preview.
  - Per‑site overrides via local storage (remember corrected metadata).
  - Accessibility‑friendly labels and contrast.

- Targeted overrides
  - Special handling for lop.parl.ca (Library of Parliament) to ensure author/title/date/publisher are correct.

---

## Installation

- Chrome/Edge (Developer mode):
  1. Clone or download this repository.
  2. Open the browser’s Extensions page.
  3. Enable Developer mode.
  4. Click “Load unpacked” and select the project folder.
  5. Pin Doucite and click it on any page to generate a citation.

---

## Usage

- Choose a style: Select APA 7, MLA 9, or Chicago in the top toolbar.
- Rescan: Click ↻ to refresh extraction after navigation or dynamic changes.
- Dark mode: Toggle ☾ for a dark UI.
- Edit metadata: Adjust Title, Author(s), Date, Publisher, URL, DOI, then click “Apply changes.”
- Save site override: Persist corrected fields per domain for future visits.
- Copy outputs: Use “Copy citation” or “Copy BibTeX.”

---

## Options

- Include “Retrieved” date
- Sentence case title (APA)
- Use publisher/site when author missing (corporate author fallback)
- Append “[PDF]” when detected

---

## Example outputs

- APA 7:
  Nguyen, T. (2020, December 3). The Arctic: Environmental issues. Library of Parliament. Retrieved October 20, 2025, from https://lop.parl.ca/sites/PublicWebsite/default/en_CA/ResearchPublications/202092E/

- MLA 9:
  Nguyen, Thai. The Arctic: Environmental Issues. Library of Parliament, 3 Dec. 2020, https://lop.parl.ca/sites/PublicWebsite/default/en_CA/ResearchPublications/202092E/. Accessed 20 Oct. 2025.

- Chicago:
  Thai Nguyen. The Arctic: Environmental Issues. Ottawa: Library of Parliament, December 3, 2020. https://lop.parl.ca/sites/PublicWebsite/default/en_CA/ResearchPublications/202092E/.

---

## Accuracy notes

- Layered fallbacks make Doucite resilient when sites lack good metadata.
- Heuristics are used cautiously and filtered to avoid common noise.
- Targeted overrides cover known tricky domains.
- Manual edits and per‑site overrides let you finalize any edge case.

No tool can guarantee 100% accuracy across the entire web, but Doucite is hardened for government/academic pages and PDFs beyond typical generators.

---

## Roadmap

- Additional styles: IEEE, Harvard, Vancouver
- More site overrides: arXiv, SSRN, PubMed, institutional repositories
- Batch mode: multi‑tab or list export
- Export formats: RIS, CSL‑JSON
- Internationalization: UI translations

---

## Contributing

- Issues: Use GitHub Issues for bugs and feature requests.
- Pull Requests: Welcome—include clear descriptions, minimal diffs, and (if UI changes) screenshots.
- Code style: Keep it readable and dependency‑light.

---

## License

- MIT License (see LICENSE).
- Built by changcheng967 with help from Doulet Media.
- Links: Repo https://github.com/changcheng967/Doucite • Author https://github.com/changcheng967
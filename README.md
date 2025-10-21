# Doucite

Doucite is a browser extension for one‑click, highly accurate citations. It extracts clean metadata from messy pages, government portals, academic sites, and PDFs using layered fallbacks, making it effective for academic and government resources.

## Key Features
- **Accurate Extraction:** Uses multiple strategies for metadata, including citation/DC meta, JSON‑LD, OG tags, visible H1/byline, and regex. Special handling for PDFs and government sites (e.g., lop.parl.ca).
- **Correct Formatting:** Outputs for APA 7, MLA 9, and Chicago styles, BibTeX export, and sentence case logic with acronym and colon awareness.
- **Modern UI/UX:** Responsive popup interface in `popup.html`/`popup.js`/`popup.css`, dark mode, editable fields, per-site overrides (local storage), and accessibility features.
- **Options:** Toggle retrieved date, sentence case (APA), publisher fallback, PDF suffix.
- **Roadmap:** More citation styles (IEEE, Harvard, Vancouver), batch export, more formats (RIS, CSL-JSON), more site overrides, internationalization.

## Main Files
- `content.js`: Extraction logic
- `manifest.json`: Extension configuration
- `popup.html`, `popup.js`, `popup.css`: Popup UI
- `utils.js`: Utility functions
- `.gitattributes`, `LICENSE`, `README.md`: Project meta

## Installation
1. Clone or download this repository.
2. Open Chrome/Edge Extensions page.
3. Enable Developer mode.
4. Click "Load unpacked" and select this folder.
5. Pin Doucite and click on any page to generate a citation.

## Usage
- Choose citation style APA7(only APA7 is avaliable right now) in the toolbar.
- Click ↻ to rescan if page changes.
- Toggle ☾ for dark mode.
- Edit Title, Authors, Date, Publisher, URL, DOI; click "Apply changes".
- Save site override for future visits.
- Copy citation or BibTeX output.

## Example Outputs
- **APA 7:** Nguyen, T. (2020, December 3). The Arctic: Environmental issues. Library of Parliament. Retrieved October 20, 2025, from [URL]
- **MLA 9:** Nguyen, Thai. The Arctic: Environmental Issues. Library of Parliament, 3 Dec. 2020, [URL]. Accessed 20 Oct. 2025.
- **Chicago:** Thai Nguyen. The Arctic: Environmental Issues. Ottawa: Library of Parliament, December 3, 2020. [URL]

## Accuracy Notes
- Layered fallbacks for robust extraction
- Heuristics with noise filtering
- Manual edits and per-site overrides available

## Roadmap
- More citation styles and sites
- Batch export and new formats
- UI translations

## Contributing
- Issues and Pull Requests welcome
- Code should be readable and dependency-light

## License
- MIT License (see LICENSE)
- Built by changcheng967 with help from Doulet Media.
- Links: Repo https://github.com/changcheng967/Doucite • Author https://github.com/changcheng967

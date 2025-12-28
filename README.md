# Sumplexity ARR Demo

A single-page React experience that walks prospects through the proposed ARR → Compliance Audit workflow. Everything is front-end only with curated data, canned ARR commentary, and a bundled PDF that represents the 2022 ARR document.

## Getting started

```bash
npm install
npm run dev
```

The dev server will start on http://localhost:5173. No environment variables are required.

## Production build

```bash
npm run build
npm run preview   # optional smoke test of the static build
```

## Highlights

- Sumplexity design system tokens lifted from the existing workspace so the demo looks consistent with production tooling.
- Each ARR/Audit step is interactive with simulated progress bars, selectable cards, and mock findings.
- Step 3 embeds the supplied `CLC_ARR_2022.pdf` and keeps the commentary list in sync with bounding boxes drawn on top of the viewer.
- Findings dashboard (Step 6) lets users filter by severity, jump between document tabs, and deep-link from findings to the corresponding file.
- Export step shows the final PDF hand-off with download/email CTAs; all data lives in `src/data/mockData.js` for easy tweaking.

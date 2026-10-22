# MalGuard Research

Official research-notes website: https://research.malguard.site/

## Publications

Six original technical notes on game-mod security, file identity, archive inspection, malware-related trust boundaries, supply-chain provenance and defensive evidence reporting.

Each publication is available in three formats:
- Accessible HTML at `/papers/<slug>.html`
- Static, paginated book reader at `/reader.html?paper=<slug>`
- Downloadable PDF at `/pdfs/<slug>.pdf` (generated during GitHub Pages deployment)

## Publication status

These are project-authored conceptual research notes, **not independently peer-reviewed papers**, not experimental malware benchmarks, and not product safety certifications. Illustrative examples are hypothetical. Each note cites external primary guidance where relevant and states its limitations.

## Deployment

GitHub Pages is deployed using `.github/workflows/pages.yml`. The workflow installs pinned ReportLab, executes `python tools/build-pdfs.py`, then uploads the site including generated PDFs. The published PDFs are build outputs, not files committed to the source tree.

The site is intentionally lightweight: no animation; interactive page changes and publication search use small local JavaScript files.

## Corrections

Please open an issue in this repository with a clear explanation and source references.

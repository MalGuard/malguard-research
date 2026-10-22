# MalGuard Research

Official research-notes website: https://research.malguard.site/

## Publications

Seven original technical notes on game-mod security, file identity, archive inspection, malware-related trust boundaries, supply-chain provenance and defensive evidence reporting.

Each publication is available in three formats:
- Accessible HTML at `/papers/<slug>.html`
- Hard-cover, paginated 3D book edition with touch page turning at `/reader.html?paper=<slug>`
- Downloadable PDF at `/pdfs/<slug>.pdf` (generated during GitHub Pages deployment)

## GTA VI security advisory

The seventh publication, [GTA VI Fake Downloads and the Trust Problem](https://research.malguard.site/papers/gta6-fake-downloads-trust.html), summarizes official launch status and attributes documented scam incidents to third-party investigators. It has an exactly 15-page PDF built from the canonical HTML during publication, and a separate hardcover reader. No GTA VI-specific MalGuard detection or protection claims are made.

## Publication status

These are project-authored conceptual research notes, **not independently peer-reviewed papers**, not experimental malware benchmarks, and not product safety certifications. Illustrative examples are hypothetical. Each note cites external primary guidance where relevant and states its limitations.

## Deployment

GitHub Pages is deployed using `.github/workflows/pages.yml`. The workflow installs pinned ReportLab, executes `python tools/build-pdfs.py`, then uploads the site including generated PDFs. The published PDFs are build outputs, not files committed to the source tree.

Three mod-security papers now include expanded evidence-to-claim guidance, explicit reporting templates and additional limitations. This is an editorial improvement, not a new empirical study.\n\n## Publication quality gate\n\nAfter generating PDFs and the local page-flip bundle, GitHub Actions runs `python tools/check-publications.py`. The check covers local links, book slugs, canonical URLs, research disclosures, reference links and expected build artifacts. It is structural QA, **not** a scientific peer review or a browser performance benchmark.\n\nThe site is intentionally lightweight. The book edition has a hard front/back cover and fixed-size, typeset paper leaves rather than scrolling article panels. It uses [StPageFlip 2.0.7](https://github.com/Nodlik/StPageFlip) (MIT license), copied locally during the GitHub Pages build; it supports page-corner dragging, touch gestures, keyboard arrows, navigation buttons and reduced-motion preferences. Other pages have no continuous animations; publication search uses local JavaScript.

## Release verification

Production releases run the GitHub Pages workflow on the `main` branch. Confirm the workflow succeeds and test the book reader, paper links, and generated PDF files at the live custom domain before marking the release verified.

## Corrections

Please open an issue in this repository with a clear explanation and source references.

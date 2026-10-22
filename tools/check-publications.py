#!/usr/bin/env python3
"""Offline publication checks for the deployed GitHub Pages artifact.

This is a structural QA gate, not a scientific peer review or a live browser test.
Run after the PDF and page-flip assets have been generated.
"""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import sys

ROOT = Path(__file__).resolve().parent.parent
PAPERS = (
    "hash-identity-vs-trust",
    "zip-structure-vs-filename",
    "evidence-ladder-for-scanners",
    "game-mod-threat-model",
    "malicious-mod-distribution",
    "static-vs-behavioral-analysis",
)
ERRORS = []


class Inspect(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.ids = set()
        self.sections = 0
        self.canonical = []
        self.external_sources = 0
        self.in_references = False
        self.ref_depth = 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if d.get("id"):
            self.ids.add(d["id"])
        if tag == "section":
            self.sections += 1
            if "references" in d.get("class", "").split():
                self.in_references = True
                self.ref_depth = 1
            elif self.in_references:
                self.ref_depth += 1
        if tag == "a" and self.in_references and d.get("href", "").startswith("https://"):
            self.external_sources += 1
        if tag == "link" and d.get("rel") == "canonical":
            self.canonical.append(d.get("href", ""))
        for key in ("href", "src"):
            if key in d:
                self.refs.append(d[key])

    def handle_endtag(self, tag):
        if tag == "section" and self.in_references:
            self.ref_depth -= 1
            if self.ref_depth == 0:
                self.in_references = False


def check(condition, message):
    if not condition:
        ERRORS.append(message)


def inspect_file(path: Path):
    parsed = Inspect()
    parsed.feed(path.read_text(encoding="utf-8"))
    return parsed


def verify_internal_link(source: Path, value: str, parsed: Inspect):
    if not value or value.startswith(("https://", "http://", "mailto:", "tel:", "data:", "javascript:")):
        return
    u = urlsplit(value)
    if not u.path and u.fragment:
        check(u.fragment in parsed.ids, f"{source.relative_to(ROOT)}: missing #{u.fragment}")
        return
    if u.path.startswith("/"):
        target = ROOT / u.path.lstrip("/")
    else:
        target = source.parent / u.path
    if not u.path or u.path.endswith("/"):
        target = target / "index.html"
    check(target.is_file(), f"{source.relative_to(ROOT)}: broken local link {value}")
    if target.is_file() and u.fragment and target.suffix == ".html":
        dest = inspect_file(target)
        check(u.fragment in dest.ids, f"{source.relative_to(ROOT)}: missing target {value}")
    if u.path == "/reader.html":
        requested = parse_qs(u.query).get("paper", [])
        check(len(requested) == 1 and requested[0] in PAPERS,
              f"{source.relative_to(ROOT)}: invalid book slug {value}")


def main():
    check((ROOT / "assets/vendor/page-flip.browser.js").is_file(),
          "Missing locally vendored page-flip engine (build step must run first)")
    files = [ROOT / "index.html", ROOT / "methodology.html", ROOT / "reader.html"]
    files += [ROOT / "papers" / f"{slug}.html" for slug in PAPERS]
    for file in files:
        check(file.is_file(), f"Missing page: {file}")
        if not file.is_file():
            continue
        parsed = inspect_file(file)
        for ref in parsed.refs:
            verify_internal_link(file, ref, parsed)
        if file.parent.name == "papers":
            slug = file.stem
            html = file.read_text(encoding="utf-8")
            check(parsed.canonical == [f"https://research.malguard.site/papers/{slug}.html"],
                  f"{slug}: incorrect canonical URL")
            check(parsed.sections >= 5, f"{slug}: fewer than five sections")
            check(parsed.external_sources >= 2, f"{slug}: fewer than two linked primary references")
            check("not independently peer-reviewed" in html.lower(),
                  f"{slug}: publication disclosure missing")
            check((ROOT / "pdfs" / f"{slug}.pdf").is_file(), f"{slug}: PDF not generated")
    check((ROOT / "sitemap.xml").is_file(), "Sitemap missing")
    if ERRORS:
        for error in ERRORS:
            print("FAIL:", error, file=sys.stderr)
        print(f"{len(ERRORS)} publication checks failed.", file=sys.stderr)
        return 1
    print(f"PASS: {len(files)} HTML pages, {len(PAPERS)} papers, local links, references, PDFs, and book engine.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

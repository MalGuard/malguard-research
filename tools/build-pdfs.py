#!/usr/bin/env python3
"""Generate accessible, print-friendly PDF editions of published HTML research notes.
Runs during GitHub Pages build; does not execute any sample or download external content.
"""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
from xml.sax.saxutils import escape
from datetime import date
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, KeepTogether

ROOT = Path(__file__).resolve().parent.parent
SLUGS = [
    "hash-identity-vs-trust",
    "zip-structure-vs-filename",
    "evidence-ladder-for-scanners",
    "game-mod-threat-model",
    "malicious-mod-distribution",
    "static-vs-behavioral-analysis",
]

class Extract(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_article = False
        self.current_tag = None
        self.parts = []
        self.blocks = []
        self.link = None
        self.in_header = False
        self.skip = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "article" and "detail-card" in attrs.get("class", ""):
            self.in_article = True
        if not self.in_article:
            return
        if tag in ("h2", "h3", "p", "li") and self.current_tag is None:
            self.current_tag = tag
            self.parts = []
        elif tag == "a" and self.current_tag:
            self.link = attrs.get("href", "")
        elif tag == "br" and self.current_tag:
            self.parts.append(" ")

    def handle_data(self, data):
        if self.in_article and self.current_tag:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if self.in_article and self.current_tag == tag:
            value = " ".join("".join(self.parts).split())
            if value:
                self.blocks.append((tag, value))
            self.current_tag = None
            self.parts = []
            self.link = None
        if tag == "article" and self.in_article:
            self.in_article = False

def build(slug):
    html = (ROOT / "papers" / (slug + ".html")).read_text(encoding="utf-8")
    import re
    title = re.search(r'<h1 class="detail-title">([^<]+)</h1>', html)
    lead = re.search(r'<p class="detail-lead">([^<]+)</p>', html)
    if not title or not lead:
        raise ValueError(f"Missing paper title or abstract: {slug}")
    parser = Extract()
    parser.feed(html)
    out = ROOT / "pdfs" / (slug + ".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)
    ink = colors.HexColor("#142035")
    blue = colors.HexColor("#2f6bff")
    styles = {
        "brand": ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=10, leading=15, textColor=blue, spaceAfter=19),
        "title": ParagraphStyle("title", fontName="Times-Bold", fontSize=27, leading=32, textColor=ink, spaceAfter=19),
        "lead": ParagraphStyle("lead", fontName="Times-Roman", fontSize=13, leading=20, textColor=colors.HexColor("#425066"), spaceAfter=22),
        "meta": ParagraphStyle("meta", fontName="Helvetica", fontSize=8, leading=13, textColor=colors.HexColor("#586579"), spaceAfter=24),
        "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=19, textColor=ink, spaceBefore=20, spaceAfter=10, keepWithNext=True),
        "h3": ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=11, leading=16, textColor=ink, spaceBefore=12, spaceAfter=7, keepWithNext=True),
        "p": ParagraphStyle("p", fontName="Times-Roman", fontSize=11, leading=17, textColor=ink, spaceAfter=11),
        "li": ParagraphStyle("li", fontName="Times-Roman", fontSize=11, leading=17, textColor=ink, leftIndent=15, firstLineIndent=-9, spaceAfter=8),
    }
    def foot(canvas, doc):
        canvas.setStrokeColor(colors.HexColor("#d4dbe4"))
        canvas.line(21*mm, 19*mm, 189*mm, 19*mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#667489"))
        canvas.drawString(21*mm, 14*mm, "MalGuard Research | Original technical note | Not independently peer-reviewed")
        canvas.drawRightString(189*mm, 14*mm, str(doc.page))
    story = [
        Paragraph("MALGUARD / RESEARCH", styles["brand"]),
        Paragraph(escape(title.group(1)), styles["title"]),
        Paragraph(escape(lead.group(1)), styles["lead"]),
        Paragraph("Publication: October 2026 | Technical analysis, not an experimental benchmark | "
                  "Read online: research.malguard.site/papers/" + slug + ".html", styles["meta"]),
        HRFlowable(width="100%", thickness=1, color=blue, spaceAfter=17),
    ]
    for tag, content in parser.blocks:
        if tag in styles:
            safe = escape(content)
            if tag == "li":
                safe = "&#8226; " + safe
            story.append(Paragraph(safe, styles[tag]))
    doc = SimpleDocTemplate(str(out), pagesize=A4, rightMargin=22*mm,
                            leftMargin=22*mm, topMargin=24*mm, bottomMargin=26*mm,
                            title=title.group(1), author="MalGuard Research",
                            subject="Original technical security research note; not independently peer-reviewed")
    doc.build(story, onFirstPage=foot, onLaterPages=foot)
    print(f"Built {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")

if __name__ == "__main__":
    for slug in SLUGS:
        build(slug)

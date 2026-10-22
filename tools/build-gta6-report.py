#!/usr/bin/env python3
"""Build the expanded GTA VI research PDF from the published HTML.

Each source article section starts on a new page, but flows across pages at
normal readable type size. No arbitrary shrinking or fixed page-count claim.
The output is text-only, does not fetch any URL, and executes no malware.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from xml.sax.saxutils import escape
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, PageBreak, Spacer, HRFlowable,
    KeepTogether, CondPageBreak
)
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
SLUG = "gta6-fake-downloads-trust"
TARGET = ROOT / "pdfs" / f"{SLUG}.pdf"
NAVY = colors.HexColor("#182a43")
BLUE = colors.HexColor("#2e69b0")
MUTED = colors.HexColor("#52677f")

class Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = False
        self.section = None
        self.block = None
        self.acc = []
        self.sections = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "article" and "detail-card" in attrs.get("class", "").split():
            self.active = True
        if not self.active:
            return
        if tag == "section" and self.section is None:
            self.section = {"heading": "", "parts": [],
                            "references": "references" in attrs.get("class", "").split()}
        if self.section is not None and self.block is None and tag in ("h2", "h3", "p", "li"):
            self.block = tag
            self.acc = []

    def handle_data(self, data):
        if self.block is not None:
            self.acc.append(data)

    def handle_endtag(self, tag):
        if tag == self.block:
            content = " ".join("".join(self.acc).split())
            if self.section is not None and content:
                if tag == "h2":
                    self.section["heading"] = content
                else:
                    self.section["parts"].append((tag, content))
            self.acc = []
            self.block = None
        if tag == "section" and self.section is not None:
            self.sections.append(self.section)
            self.section = None
        if tag == "article":
            self.active = False


def make_styles():
    return {
        "brand": ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=10, leading=16, textColor=BLUE, spaceAfter=15),
        "title": ParagraphStyle("title", fontName="Times-Bold", fontSize=34, leading=42, textColor=NAVY, spaceAfter=19),
        "lead": ParagraphStyle("lead", fontName="Times-Roman", fontSize=16, leading=25, textColor=MUTED, spaceAfter=30),
        "meta": ParagraphStyle("meta", fontName="Helvetica", fontSize=9, leading=15, textColor=MUTED, spaceAfter=13),
        "overline": ParagraphStyle("overline", fontName="Helvetica-Bold", fontSize=9, leading=15, textColor=BLUE, spaceAfter=9),
        "h2": ParagraphStyle("h2", fontName="Times-Bold", fontSize=22, leading=28, textColor=NAVY, spaceAfter=15, keepWithNext=True),
        "p": ParagraphStyle("p", fontName="Times-Roman", fontSize=10.6, leading=16.8, textColor=NAVY, spaceAfter=12, splitLongWords=1),
        "li": ParagraphStyle("li", fontName="Times-Roman", fontSize=10.6, leading=16.8, textColor=NAVY, leftIndent=12, firstLineIndent=-10, spaceAfter=10),
        "source": ParagraphStyle("source", fontName="Helvetica", fontSize=8.2, leading=13.3, textColor=NAVY, spaceAfter=10, splitLongWords=1),
    }


def build():
    html = (ROOT / "papers" / (SLUG + ".html")).read_text(encoding="utf-8")
    parser = Extract()
    parser.feed(html)
    if len(parser.sections) < 20 or not parser.sections[-1]["references"]:
        raise ValueError(f"Expected extended report with references, found {len(parser.sections)} sections")
    if not all(s["heading"] and s["parts"] for s in parser.sections):
        raise ValueError("All report sections must have headings and source paragraphs")
    styles = make_styles()
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    story = [
        Spacer(1, 31 * mm),
        Paragraph("MALGUARD  /  RESEARCH  /  TECHNICAL DOSSIER 01", styles["brand"]),
        Paragraph("GTA VI Threat Dossier:<br/>The Evidence Behind<br/>Fake Downloads", styles["title"]),
        Paragraph("Real published malware hashes, three independently investigated campaigns, and an auditable method for future game-security tools.", styles["lead"]),
        HRFlowable(width="100%", thickness=1.7, color=BLUE, spaceAfter=22),
        Paragraph("Evidence current to: 22 October 2026. Official scheduled launch: 19 November 2026. Dates and platform announcements can change.", styles["meta"]),
        Paragraph("Investigations and hashes cited are credited to Malwarebytes and Huntress. MalGuard has NOT independently discovered or analyzed those specimens. No audited scan-volume or malware-detection statistics are asserted.", styles["meta"]),
        Paragraph("Original research synthesis. Not independently peer-reviewed.", styles["meta"]),
        Paragraph("Canonical edition: research.malguard.site/papers/" + SLUG + ".html", styles["meta"]),
        PageBreak(),
        Paragraph("Research contents", styles["h2"]),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#d0dbea"), spaceAfter=12),
    ]
    for i, s in enumerate(parser.sections, 1):
        story.append(Paragraph(f"{i:02d}. " + escape(s["heading"]), styles["meta"]))
    story.append(PageBreak())
    for i, s in enumerate(parser.sections, 1):
        story.append(Paragraph("REFERENCES & LIMITATIONS" if s["references"] else f"TECHNICAL ANALYSIS / SECTION {i:02d}", styles["overline"]))
        story.append(Paragraph(escape(s["heading"]), styles["h2"]))
        story.append(HRFlowable(width="100%", thickness=0.65, color=colors.HexColor("#d0dbea"), spaceAfter=17))
        for tag, block in s["parts"]:
            style = styles["source"] if s["references"] else styles["li"] if tag == "li" else styles["p"]
            story.append(Paragraph(("&#8226; " if tag == "li" else "") + escape(block), style))
        if i != len(parser.sections):
            story.append(PageBreak())

    def print_frame(canvas, doc):
        canvas.saveState()
        width, height = A4
        if doc.page == 1:
            canvas.setFillColor(colors.HexColor("#e7f0fc"))
            canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
        else:
            canvas.setFont("Helvetica-Bold", 8)
            canvas.setFillColor(BLUE)
            canvas.drawString(21 * mm, height - 18 * mm, "MALGUARD  /  RESEARCH")
            canvas.setStrokeColor(colors.HexColor("#cad8e9"))
            canvas.line(21 * mm, height - 20 * mm, 189 * mm, height - 20 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(21 * mm, 14 * mm, "GTA VI / EVIDENCE DOSSIER / 22 OCTOBER 2026")
        canvas.drawRightString(189 * mm, 14 * mm, "PAGE " + str(doc.page).zfill(2))
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(TARGET), pagesize=A4,
        leftMargin=21*mm, rightMargin=21*mm,
        topMargin=29*mm, bottomMargin=25*mm,
        title="GTA VI Threat Dossier: The Evidence Behind Fake Downloads",
        author="MalGuard Research",
        subject="Attributed external malware indicators; original defensive research synthesis",
    )
    doc.build(story, onFirstPage=print_frame, onLaterPages=print_frame)
    reader = PdfReader(str(TARGET))
    pages = len(reader.pages)
    if pages < 20:
        raise ValueError(f"Extended dossier unexpectedly only {pages} PDF pages")
    print(f"Built {TARGET.relative_to(ROOT)} ({pages} pages, {TARGET.stat().st_size} bytes)")


if __name__ == "__main__":
    build()

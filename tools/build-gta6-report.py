#!/usr/bin/env python3
"""Make a precisely 15-page print edition of the GTA VI advisory.

The canonical content is the HTML article. Exactly fourteen article sections
become fourteen physical PDF pages, preceded by one cover page. Nothing is
downloaded from third-party websites and no suspicious files are executed.
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
    SimpleDocTemplate, Paragraph, PageBreak, Spacer,
    HRFlowable, KeepInFrame
)

ROOT = Path(__file__).resolve().parent.parent
SLUG = "gta6-fake-downloads-trust"
DEST = ROOT / "pdfs" / (SLUG + ".pdf")
NAVY = colors.HexColor("#142846")
BLUE = colors.HexColor("#2366b8")
GRAY = colors.HexColor("#495a70")


class ArticleSections(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.article = False
        self.section = None
        self.active_tag = None
        self.text_parts = []
        self.sections = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "article" and "detail-card" in attrs.get("class", "").split():
            self.article = True
        if not self.article:
            return
        if tag == "section" and self.section is None:
            self.section = {"title": "", "paragraphs": [], "references": "references" in attrs.get("class", "").split()}
        if self.section is not None and tag in ("h2", "p", "li") and self.active_tag is None:
            self.active_tag = tag
            self.text_parts = []

    def handle_data(self, data):
        if self.active_tag is not None:
            self.text_parts.append(data)

    def handle_endtag(self, tag):
        if self.active_tag == tag:
            text = " ".join("".join(self.text_parts).split())
            if text and self.section is not None:
                if tag == "h2":
                    self.section["title"] = text
                else:
                    self.section["paragraphs"].append((tag, text))
            self.active_tag = None
            self.text_parts = []
        if tag == "section" and self.section is not None:
            self.sections.append(self.section)
            self.section = None
        if tag == "article":
            self.article = False


def main():
    html = (ROOT / "papers" / (SLUG + ".html")).read_text(encoding="utf-8")
    parser = ArticleSections()
    parser.feed(html)
    if len(parser.sections) != 14 or not parser.sections[-1]["references"]:
        raise RuntimeError(f"Expected 13 analysis sections + references, found {len(parser.sections)}")
    DEST.parent.mkdir(parents=True, exist_ok=True)

    styles = {
        "brand": ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=10, leading=14,
                                textColor=BLUE, spaceAfter=20),
        "coverTitle": ParagraphStyle("coverTitle", fontName="Times-Bold", fontSize=39, leading=45,
                                     textColor=NAVY, spaceAfter=22),
        "coverSub": ParagraphStyle("coverSub", fontName="Times-Roman", fontSize=16, leading=24,
                                   textColor=GRAY, spaceAfter=34),
        "coverSmall": ParagraphStyle("coverSmall", fontName="Helvetica", fontSize=9, leading=17,
                                     textColor=GRAY, spaceAfter=10),
        "overline": ParagraphStyle("overline", fontName="Helvetica-Bold", fontSize=9.2, leading=13,
                                   textColor=BLUE, spaceAfter=10),
        "heading": ParagraphStyle("heading", fontName="Times-Bold", fontSize=25, leading=30,
                                  textColor=NAVY, spaceAfter=17),
        "p": ParagraphStyle("p", fontName="Times-Roman", fontSize=10.5, leading=16,
                            textColor=NAVY, spaceAfter=11, splitLongWords=1),
        "source": ParagraphStyle("source", fontName="Helvetica", fontSize=8.2, leading=13.8,
                                 textColor=NAVY, spaceAfter=11, splitLongWords=1),
    }
    last_page = [0]

    def page_frame(canv, doc):
        canv.saveState()
        width, height = A4
        if doc.page == 1:
            canv.setFillColor(colors.HexColor("#ecf3fc"))
            canv.rect(0, height - 13 * mm, width, 13 * mm, stroke=0, fill=1)
            canv.setStrokeColor(BLUE)
            canv.setLineWidth(2)
            canv.line(21 * mm, 40 * mm, 189 * mm, 40 * mm)
        else:
            canv.setFillColor(BLUE)
            canv.setFont("Helvetica-Bold", 8)
            canv.drawString(21 * mm, height - 18 * mm, "MALGUARD / RESEARCH")
            canv.setStrokeColor(colors.HexColor("#c8d8ed"))
            canv.line(21 * mm, height - 20 * mm, 189 * mm, height - 20 * mm)
        canv.setFont("Helvetica", 8)
        canv.setFillColor(colors.HexColor("#65748b"))
        canv.drawString(21 * mm, 13 * mm, "GTA VI / SECURITY ADVISORY 01 · OCTOBER 2026")
        canv.drawRightString(189 * mm, 13 * mm, f"{doc.page:02d} / 15")
        canv.restoreState()
        last_page[0] = max(last_page[0], doc.page)

    doc = SimpleDocTemplate(
        str(DEST), pagesize=A4,
        leftMargin=21 * mm, rightMargin=21 * mm,
        topMargin=30 * mm, bottomMargin=24 * mm,
        title="GTA VI Fake Downloads and the Trust Problem",
        author="MalGuard Research",
        subject="Original educational security analysis. Not independently peer-reviewed.",
        pageCompression=1,
    )

    story = [
        Spacer(1, 38 * mm),
        Paragraph("MALGUARD RESEARCH / SECURITY ADVISORY 01", styles["brand"]),
        Paragraph("GTA VI Fake Downloads<br/>and the Trust Problem", styles["coverTitle"]),
        Paragraph("An evidence-led investigation of impersonation, early-access deception, fake installers, wallet scams and security reporting.", styles["coverSub"]),
        HRFlowable(width="100%", thickness=2, color=BLUE, spaceAfter=25),
        Paragraph("Official release snapshot: 22 October 2026. Rockstar's currently scheduled date: 19 November 2026, PlayStation 5 / Xbox Series X|S.", styles["coverSmall"]),
        Paragraph("Publication status: original educational synthesis, not independently peer-reviewed. Reported campaigns are attributed to Malwarebytes; no GTA VI-specific malware testing by MalGuard is claimed.", styles["coverSmall"]),
        Paragraph("Canonical online edition: research.malguard.site/papers/" + SLUG + ".html", styles["coverSmall"]),
        PageBreak(),
    ]

    for i, section in enumerate(parser.sections):
        items = [
            Paragraph(f"SECTION {i + 1:02d} / 14" if not section["references"] else "SOURCES / LIMITATIONS", styles["overline"]),
            Paragraph(escape(section["title"]), styles["heading"]),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor("#d6e2f1"), spaceAfter=19),
        ]
        for tag, value in section["paragraphs"]:
            label = "&#8226; " if tag == "li" else ""
            value = re.sub(r"(?<=\\w)\\s+", " ", value)
            items.append(Paragraph(label + escape(value), styles["source"] if section["references"] else styles["p"]))
        # Keep the section together and reduce typography only if needed.
        story.append(KeepInFrame(168 * mm, 231 * mm, items, mode="shrink", hAlign="LEFT", vAlign="TOP"))
        if i < len(parser.sections) - 1:
            story.append(PageBreak())

    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    if last_page[0] != 15:
        raise RuntimeError(f"Expected exactly 15 pages, got {last_page[0]}")
    print(f"Built {DEST.relative_to(ROOT)}: 15 A4 pages, {DEST.stat().st_size} bytes")


if __name__ == "__main__":
    main()

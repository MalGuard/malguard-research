"use strict";

/**
 * MalGuard Research printed-book reader.
 * Source content is converted into numbered physical-looking book pages.
 * The cover and back cover are hard. Pages never navigate to article HTML
 * when turned. Page-turn physics are provided by StPageFlip when available.
 */
(() => {
  const allowed = new Set([
    "hash-identity-vs-trust",
    "zip-structure-vs-filename",
    "evidence-ladder-for-scanners",
    "game-mod-threat-model",
    "malicious-mod-distribution",
    "static-vs-behavioral-analysis"
  ]);
  const slug = new URLSearchParams(location.search).get("paper");
  const stage = document.getElementById("reader-spread");
  const prev = document.getElementById("previous-page");
  const next = document.getElementById("next-page");
  const status = document.getElementById("page-status");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const logo = "/assets/malguard-logo.svg";
  let flip = null;
  let current = 0;
  let pageCount = 0;
  let fallbackPages = [];
  let fallbackMode = false;

  if (!allowed.has(slug)) {
    stage.textContent = "Choose a research book from the library.";
    status.textContent = "No book selected";
    return;
  }

  const sourceUrl = "/papers/" + slug + ".html";
  document.getElementById("pdf-link").href = "/pdfs/" + slug + ".pdf";

  function el(tag, className, textContent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textContent !== undefined) node.textContent = textContent;
    return node;
  }

  function decorate(page, title, subTitle, index, type = "interior") {
    page.className = "book-page book-page-" + type;
    if (type === "cover" || type === "back") {
      page.dataset.density = "hard";
      const surface = el("div", "hard-cover-surface");
      const emblem = el("div", "cover-emblem");
      const image = document.createElement("img");
      image.src = logo;
      image.alt = "";
      image.width = 58;
      image.height = 58;
      emblem.append(image, el("span", "", "MALGUARD RESEARCH"));
      surface.append(emblem, el("div", "cover-rule"));
      surface.append(el("div", "cover-type", type === "cover" ? "RESEARCH MONOGRAPH" : "MALGUARD / RESEARCH"));
      surface.append(el("h2", "cover-title", title));
      surface.append(el("div", "cover-subtitle", subTitle));
      surface.append(el("div", "cover-graphic"));
      surface.append(el("div", "cover-bottom", type === "cover"
        ? "ORIGINAL TECHNICAL NOTES   /   2026"
        : "Not independently peer-reviewed · research.malguard.site"));
      page.append(surface);
    } else {
      page.append(el("div", "printed-header", "MALGUARD  /  RESEARCH"));
      page.append(el("div", "printed-chapter", subTitle));
      page.append(el("h3", "printed-heading", title));
      const content = el("div", "printed-content");
      page.append(content);
      const foot = el("div", "printed-footer");
      foot.append(el("span", "", "ORIGINAL TECHNICAL NOTE · 2026"));
      foot.append(el("span", "", String(index).padStart(2, "0")));
      page.append(foot);
    }
    return page;
  }

  function splitBlock(text, limit) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    if (normalized.length <= limit) return [normalized];
    // Never cut words through the middle. Preserve text in full.
    const words = normalized.split(" ");
    const chunks = [];
    let chunk = "";
    for (const word of words) {
      if (chunk.length + word.length + 1 > limit && chunk) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += (chunk ? " " : "") + word;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  }

  function extractChapters(htmlDocument) {
    const article = htmlDocument.querySelector("article.detail-card");
    if (!article) throw new Error("Publication content unavailable");
    const chapters = [];
    for (const section of article.querySelectorAll(":scope > section")) {
      const header = section.querySelector("h2");
      if (!header) continue;
      const blocks = [];
      for (const node of section.querySelectorAll("p, li")) {
        // Keep original content as text, not web-article link/button elements.
        // These lines stay printed on book pages while turning.
        const t = node.textContent.replace(/\s+/g, " ").trim();
        for (const chunk of splitBlock(t, 220)) {
          blocks.push({kind:node.tagName.toLowerCase(), text:chunk});
        }
      }
      chapters.push({title: header.textContent.trim(), blocks});
    }
    return chapters;
  }

  function buildPages(title, subtitle, chapters) {
    const sheets = [];
    sheets.push(decorate(el("div"), title, subtitle, 0, "cover"));
    const titlePage = decorate(el("div"), "About this research", "PREFACE", 1);
    titlePage.querySelector(".printed-content").append(
      el("p", "printed-dropcap", subtitle),
      el("p", "", "Published by MalGuard Research, October 2026."),
      el("p", "", "These notes are original technical analyses, not independently peer-reviewed research or malware-detection certifications."),
      el("p", "", "Turn the page to continue reading. All sections are printed inside this book.")
    );
    sheets.push(titlePage);

    // Each chapter is flowed over multiple physical pages, never scrollable
    // web-article cards. Short chapters have generous editorial white space.
    let number = 2;
    for (const chapter of chapters) {
      let indexInChapter = 0;
      while (indexInChapter < chapter.blocks.length || indexInChapter === 0) {
        const continuation = indexInChapter > 0;
        const leaf = decorate(el("div"),
          continuation ? chapter.title + " (continued)" : chapter.title,
          continuation ? "RESEARCH NOTES / CONTINUED" : "CHAPTER " + String(number - 1).padStart(2, "0"),
          number++);
        const contents = leaf.querySelector(".printed-content");
        let length = 0;
        let blocksOnPage = 0;
        const charLimit = 315;
        while (indexInChapter < chapter.blocks.length) {
          const block = chapter.blocks[indexInChapter];
          const cost = block.text.length + 80;
          if (blocksOnPage > 0 && length + cost > charLimit) break;
          contents.append(el(block.kind === "li" ? "p" : "p",
            block.kind === "li" ? "printed-bullet" : "", block.text));
          length += cost;
          indexInChapter++;
          blocksOnPage++;
        }
        sheets.push(leaf);
        if (indexInChapter >= chapter.blocks.length) break;
      }
    }

    sheets.push(decorate(el("div"), "Research with clear limits",
      "Original, documented analyses on game modifications and digital security. " +
      "Read the full collection at research.malguard.site.",
      0, "back"));
    return sheets;
  }

  function updateControls() {
    prev.disabled = current <= 0;
    next.disabled = current >= pageCount - 1;
    const label = current === 0 ? "Front cover"
      : current === pageCount - 1 ? "Back cover"
      : "Leaf " + current + " of " + (pageCount - 2);
    status.textContent = label;
  }

  function showFallback() {
    fallbackMode = true;
    const pageHost = el("div", "fallback-book");
    stage.replaceChildren(pageHost);
    for (const p of fallbackPages) pageHost.append(p);
    pageCount = fallbackPages.length;
    current = 0;
    function render() {
      for (let i = 0; i < fallbackPages.length; i++) {
        fallbackPages[i].hidden = i !== current;
      }
      updateControls();
    }
    prev.addEventListener("click", () => { current = Math.max(0,current - 1); render(); });
    next.addEventListener("click", () => { current = Math.min(pageCount - 1,current + 1); render(); });
    let x = null, y = null;
    pageHost.addEventListener("pointerdown", event => {
      if (event.target.closest("a,button")) return;
      x = event.clientX; y = event.clientY;
    });
    pageHost.addEventListener("pointerup", event => {
      if (x == null) return;
      const dx = event.clientX - x;
      const dy = event.clientY - y;
      x = y = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        current = Math.max(0,Math.min(pageCount-1,current + (dx < 0 ? 1 : -1)));
        render();
      }
    });
    render();
    const hint = document.getElementById("reader-engine-note");
    if (hint) hint.textContent = "Lightweight reading mode · All pages remain inside the book.";
  }

  function startFlip(pages) {
    fallbackPages = pages;
    const Constructor = window.St && window.St.PageFlip;
    if (!Constructor || reduceMotion.matches) {
      showFallback();
      return;
    }
    try {
      const host = el("div", "physical-book");
      stage.replaceChildren(host);
      for (const page of pages) host.append(page);
      flip = new Constructor(host, {
        width: 420,
        height: 600,
        size: "stretch",
        minWidth: 265,
        maxWidth: 420,
        minHeight: 378,
        maxHeight: 600,
        showCover: true,
        drawShadow: true,
        maxShadowOpacity: .38,
        flippingTime: 950,
        usePortrait: true,
        autoSize: true,
        mobileScrollSupport: true,
        swipeDistance: 28,
        disableFlipByClick: true,
        clickEventForward: false
      });
      flip.on("flip", event => {
        current = event.data;
        updateControls();
      });
      flip.loadFromHTML(pages);
      pageCount = flip.getPageCount();
      current = flip.getCurrentPageIndex();
      updateControls();
      prev.addEventListener("click", () => flip.flipPrev("bottom"));
      next.addEventListener("click", () => flip.flipNext("bottom"));
      const hint = document.getElementById("reader-engine-note");
      if (hint) hint.textContent = "Realistic paper folding · Hard cover · Drag a corner to turn a page.";
    } catch (error) {
      console.warn("Book rendering not available", error);
      showFallback();
    }
  }

  document.addEventListener("keydown", event => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.target.closest("a,button,input,textarea,select")) return;
    if (!pageCount) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (fallbackMode) {
      current = Math.max(0, Math.min(pageCount - 1, current + direction));
      for (let i = 0; i < fallbackPages.length; i++) fallbackPages[i].hidden = i !== current;
      updateControls();
    } else if (flip) {
      direction > 0 ? flip.flipNext("bottom") : flip.flipPrev("bottom");
    }
  });

  fetch(sourceUrl).then(response => {
    if (!response.ok) throw new Error("Paper unavailable");
    return response.text();
  }).then(markup => {
    const doc = new DOMParser().parseFromString(markup, "text/html");
    const title = doc.querySelector("h1.detail-title")?.textContent.trim();
    const subtitle = doc.querySelector(".detail-lead")?.textContent.trim() || "";
    if (!title) throw new Error("Missing title");
    document.getElementById("book-heading").textContent = title;
    document.title = title + " | MalGuard Research Book";
    const chapters = extractChapters(doc);
    if (!chapters.length) throw new Error("No chapters");
    startFlip(buildPages(title, subtitle, chapters));
  }).catch(error => {
    console.error("Could not open research book", error);
    stage.textContent = "Could not load this book. Return to the research library to choose another edition.";
    status.textContent = "Book unavailable";
  });
})();

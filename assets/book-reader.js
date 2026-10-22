"use strict";

/* MalGuard Research book: HTML pages remain paper, never article panels.
   StPageFlip 2.0.7 (MIT) is bundled locally during the Pages build.
   Each paper is typeset into fixed-size book leaves with a hard cover. */
(() => {
  const allowed = new Set([
    "hash-identity-vs-trust", "zip-structure-vs-filename",
    "evidence-ladder-for-scanners", "game-mod-threat-model",
    "malicious-mod-distribution", "static-vs-behavioral-analysis"
  ]);
  const slug = new URLSearchParams(location.search).get("paper");
  const spread = document.getElementById("reader-spread");
  const previous = document.getElementById("previous-page");
  const next = document.getElementById("next-page");
  const status = document.getElementById("page-status");
  if (!allowed.has(slug)) {
    spread.textContent = "Choose a book from the research library.";
    status.textContent = "No publication selected";
    return;
  }
  const articleUrl = "/papers/" + slug + ".html";
  document.getElementById("article-link").href = articleUrl;
  document.getElementById("pdf-link").href = "/pdfs/" + slug + ".pdf";

  function textNode(tag, text, cls) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }

  function makeLeaf(kind = "paper") {
    const leaf = document.createElement("div");
    leaf.className = "folio-leaf folio-" + kind;
    if (kind === "front" || kind === "back") leaf.dataset.density = "hard";
    const inside = document.createElement("div");
    inside.className = "folio-content";
    leaf.append(inside);
    return {leaf, inside};
  }

  function makePaper() {
    const {leaf, inside} = makeLeaf();
    inside.append(textNode("div", "MALGUARD  /  RESEARCH", "folio-running-head"));
    const body = document.createElement("div");
    body.className = "folio-body";
    inside.append(body);
    inside.append(textNode("div", "MALGUARD RESEARCH  •  OCTOBER 2026", "folio-running-foot"));
    return {leaf, body};
  }

  // Use the same typography and dimensions for measurement and real pages.
  // Split paragraphs into book pages instead of rendering a scrolling article.
  function typeset(blocks) {
    const stage = document.createElement("div");
    stage.className = "folio-measure";
    stage.setAttribute("aria-hidden", "true");
    document.body.append(stage);
    const result = [];
    let paper = null;
    let body = null;
    const begin = () => {
      paper = makePaper();
      body = paper.body;
      stage.replaceChildren(paper.leaf);
      result.push(paper.leaf);
    };
    const overflow = () => body.scrollHeight > body.clientHeight + 2;
    begin();

    function addBlock(original) {
      const block = original.cloneNode(true);
      body.append(block);
      if (!overflow()) return;
      block.remove();
      if (body.childElementCount > 0) {
        begin();
        body.append(block);
        if (!overflow()) return;
        block.remove();
      }
      // Long standalone paragraphs are split at word boundaries.
      const words = (original.textContent || "").trim().split(/\s+/);
      if (words.length < 2) {
        body.append(block);
        return;
      }
      let chunk = [];
      let part = document.createElement(original.tagName.toLowerCase());
      part.className = original.className;
      body.append(part);
      for (const word of words) {
        chunk.push(word);
        part.textContent = chunk.join(" ");
        if (overflow() && chunk.length > 1) {
          chunk.pop();
          part.textContent = chunk.join(" ");
          begin();
          part = document.createElement(original.tagName.toLowerCase());
          part.className = original.className;
          body.append(part);
          chunk = [word];
          part.textContent = word;
        }
      }
    }

    for (const block of blocks) addBlock(block);
    stage.remove();
    return result;
  }

  function cover(title, type, isBack = false) {
    const {leaf, inside} = makeLeaf(isBack ? "back" : "front");
    const art = document.createElement("div");
    art.className = "folio-cover-art";
    art.append(textNode("div", "M  /  R", "folio-cover-monogram"));
    art.append(textNode("div", "MALGUARD  RESEARCH", "folio-cover-imprint"));
    if (!isBack) {
      art.append(textNode("div", type, "folio-cover-type"));
      art.append(textNode("h2", title, "folio-cover-title"));
      art.append(textNode("div", "ORIGINAL SECURITY RESEARCH  /  2026", "folio-cover-date"));
    } else {
      art.append(textNode("div", "Research with evidence.\nSecurity without assumptions.", "folio-cover-quote"));
      art.append(textNode("div", "research.malguard.site", "folio-cover-date"));
    }
    inside.append(art);
    return leaf;
  }

  function titleLeaf(title, lead) {
    const {leaf, inside} = makeLeaf();
    inside.classList.add("folio-title-inside");
    inside.append(textNode("div", "MALGUARD RESEARCH / PUBLICATION SERIES", "folio-running-head"));
    inside.append(textNode("div", "TECHNICAL RESEARCH NOTE", "folio-intro-eyebrow"));
    inside.append(textNode("h2", title, "folio-intro-title"));
    inside.append(textNode("p", lead, "folio-intro-lead"));
    inside.append(textNode("p",
      "Original technical analysis. Not independently peer-reviewed. " +
      "Illustrative examples are not empirical malware tests.",
      "folio-intro-disclosure"));
    inside.append(textNode("div", "OCTOBER 2026  /  MALGUARD", "folio-running-foot"));
    return leaf;
  }

  function extractBlocks(doc) {
    const blocks = [];
    const article = doc.querySelector("article.detail-card");
    if (!article) throw new Error("Publication content missing");
    for (const section of article.querySelectorAll(":scope > section")) {
      const heading = section.querySelector("h2");
      if (heading) blocks.push(textNode("h3", heading.textContent.trim(), "folio-section-heading"));
      for (const child of section.children) {
        if (child === heading) continue;
        if (child.matches("p")) {
          const p = document.createElement("p");
          p.className = "folio-paragraph";
          p.textContent = child.textContent.trim();
          blocks.push(p);
        } else if (child.matches("ol,ul")) {
          for (const li of child.querySelectorAll(":scope > li")) {
            const p = document.createElement("p");
            p.className = "folio-reference";
            p.textContent = "• " + li.textContent.trim();
            blocks.push(p);
          }
        }
      }
    }
    return blocks;
  }

  fetch(articleUrl).then(r => {
    if (!r.ok) throw new Error("Publication not found");
    return r.text();
  }).then(html => {
    if (!window.St || !window.St.PageFlip) throw new Error("Book engine unavailable");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.querySelector("h1.detail-title")?.textContent?.trim();
    const lead = doc.querySelector(".detail-lead")?.textContent?.trim();
    if (!title || !lead) throw new Error("Invalid publication");

    document.getElementById("book-heading").textContent = title;
    document.title = title + " | Book Reader | MalGuard Research";
    const blocks = extractBlocks(doc);
    const leaves = [
      cover(title, "SECURITY / GAME MODS / MALWARE"),
      titleLeaf(title, lead),
      ...typeset(blocks)
    ];
    const {leaf: colophon, inside} = makeLeaf();
    inside.classList.add("folio-colophon");
    inside.append(textNode("div", "MALGUARD / RESEARCH", "folio-running-head"));
    inside.append(textNode("h2", "End of publication", "folio-intro-title"));
    inside.append(textNode("p", "This original research note is not independently peer-reviewed. " +
      "Read the full HTML edition for source links and methodology.", "folio-intro-lead"));
    inside.append(textNode("p", "research.malguard.site", "folio-colophon-url"));
    leaves.push(colophon, cover(title, "", true));

    spread.replaceChildren();
    const root = document.createElement("div");
    root.className = "folio-book";
    spread.append(root);
    root.append(...leaves);

    const flip = new window.St.PageFlip(root, {
      width: 420, height: 580, size: "stretch",
      minWidth: 260, maxWidth: 460, minHeight: 360, maxHeight: 635,
      showCover: true, drawShadow: true,
      maxShadowOpacity: .48,
      flippingTime: matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 900,
      usePortrait: true, mobileScrollSupport: true,
      swipeDistance: 30, disableFlipByClick: true, autoSize: true
    });

    const update = () => {
      const index = flip.getCurrentPageIndex();
      status.textContent = "Leaf " + (index + 1) + " of " + flip.getPageCount();
      previous.disabled = index === 0;
      next.disabled = index >= flip.getPageCount() - 1;
    };
    flip.on("flip", update);
    flip.on("init", update);
    flip.on("changeOrientation", update);
    flip.loadFromHTML(leaves);
    previous.addEventListener("click", () => flip.flipPrev("bottom"));
    next.addEventListener("click", () => flip.flipNext("bottom"));
    document.addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest("input,textarea,select,button,a")) return;
      if (event.key === "ArrowRight") flip.flipNext("bottom");
      if (event.key === "ArrowLeft") flip.flipPrev("bottom");
    });
    update();
  }).catch(error => {
    spread.textContent = "The book is temporarily unavailable. You can still read the HTML paper.";
    status.textContent = "Reader unavailable";
    console.error("MalGuard book reader:", error);
  });
})();

"use strict";

/* MalGuard Research: responsive, draggable 3D folio.
   It renders text from our own published HTML pages. No external libraries.
   Motion is optional and disabled when the user prefers reduced motion. */
(() => {
  const publications = new Set([
    "hash-identity-vs-trust", "zip-structure-vs-filename",
    "evidence-ladder-for-scanners", "game-mod-threat-model",
    "malicious-mod-distribution", "static-vs-behavioral-analysis"
  ]);
  const slug = new URLSearchParams(location.search).get("paper");
  const spread = document.getElementById("reader-spread");
  const previous = document.getElementById("previous-page");
  const next = document.getElementById("next-page");
  const status = document.getElementById("page-status");
  const mobileQuery = matchMedia("(max-width: 760px)");
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let pages = [];
  let current = 0;
  let turning = false;
  let candidate = null;
  let drag = null;
  let frame, left, right, sheet, front, back;

  if (!publications.has(slug)) {
    spread.textContent = "Choose one of the published research papers.";
    status.textContent = "No paper selected";
    return;
  }

  const articleUrl = "/papers/" + slug + ".html";
  document.getElementById("article-link").href = articleUrl;
  document.getElementById("pdf-link").href = "/pdfs/" + slug + ".pdf";

  const isMobile = () => mobileQuery.matches;
  const step = () => isMobile() ? 1 : 2;
  const canAdvance = direction => direction > 0
    ? current + step() < pages.length
    : current > 0;
  const bounded = value => Math.min(1, Math.max(0, value));

  function createPage(label, title, nodes, isCover = false) {
    const page = document.createElement("section");
    page.className = isCover ? "reader-page reader-cover" : "reader-page";
    const kicker = document.createElement("div");
    kicker.className = "reader-page-label";
    kicker.textContent = label;
    page.append(kicker);
    const heading = document.createElement(isCover ? "h2" : "h3");
    heading.textContent = title;
    page.append(heading);
    for (const node of nodes) page.append(node.cloneNode(true));
    const footer = document.createElement("div");
    footer.className = "reader-page-footer";
    footer.textContent = "MALGUARD RESEARCH  /  2026";
    page.append(footer);
    return page;
  }

  function pageAt(index) {
    if (index >= 0 && index < pages.length) return pages[index].cloneNode(true);
    const blank = document.createElement("div");
    blank.className = "reader-page reader-page-blank";
    blank.setAttribute("aria-hidden", "true");
    blank.textContent = "MALGUARD / RESEARCH";
    return blank;
  }

  function put(target, index) {
    target.replaceChildren(pageAt(index));
  }

  function updateControls() {
    previous.disabled = turning || !canAdvance(-1);
    next.disabled = turning || !canAdvance(1);
    const visible = isMobile() ? Math.min(current + 1, pages.length)
      : Math.min(current + 2, pages.length);
    status.textContent = "Pages " + (current + 1) +
      (visible > current + 1 ? "–" + visible : "") + " of " + pages.length;
  }

  function show() {
    if (isMobile()) {
      left.replaceChildren();
      put(right, current);
    } else {
      put(left, current);
      put(right, current + 1);
    }
    sheet.hidden = true;
    sheet.style.transition = "none";
    sheet.style.transform = "";
    frame.classList.remove("book-turning", "book-dragging", "book-turn-back", "book-mobile");
    frame.classList.toggle("book-mobile", isMobile());
    turning = false;
    updateControls();
  }

  function prepare(direction) {
    if (turning || !canAdvance(direction)) return null;
    turning = true;
    updateControls();
    const targetIndex = current + direction * step();
    frame.classList.add("book-turning");
    frame.classList.toggle("book-turn-back", direction < 0);
    sheet.hidden = false;
    sheet.style.transition = "none";

    if (isMobile()) {
      // On a phone, a physical sheet turns away, revealing the following page.
      put(right, targetIndex);
      put(front, current);
      back.replaceChildren(pageAt(targetIndex));
      sheet.style.transform = "rotateY(0deg)";
      return {direction, targetIndex, from:0, to:direction > 0 ? -180 : 180};
    }
    if (direction > 0) {
      put(left, current);
      put(right, targetIndex + 1);
      put(front, current + 1);
      put(back, targetIndex);
      sheet.style.transform = "rotateY(0deg)";
      return {direction, targetIndex, from:0, to:-180};
    }
    put(left, targetIndex);
    put(right, current + 1);
    put(front, targetIndex + 1);
    put(back, current);
    sheet.style.transform = "rotateY(-180deg)";
    return {direction, targetIndex, from:-180, to:0};
  }

  function settle(flip, completed) {
    if (completed) current = flip.targetIndex;
    show();
    drag = null;
  }

  function animateTo(flip, finished) {
    // Always complete a drag or a button turn; reduced-motion is instantaneous.
    if (motionQuery.matches) {
      settle(flip, finished);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sheet.removeEventListener("transitionend", onEnd);
      settle(flip, finished);
    };
    const onEnd = event => {
      if (event.target === sheet && event.propertyName === "transform") finish();
    };
    sheet.addEventListener("transitionend", onEnd);
    const duration = 640;
    const apply = () => {
      sheet.style.transition = "transform " + duration + "ms cubic-bezier(.22,.62,.18,1)";
      sheet.style.transform = "rotateY(" + (finished ? flip.to : flip.from) + "deg)";
    };
    // Two frames ensure a browser registers the initial 3D position.
    requestAnimationFrame(() => requestAnimationFrame(apply));
    setTimeout(finish, duration + 140);
  }

  function turn(direction) {
    if (turning) return;
    if (motionQuery.matches) {
      if (canAdvance(direction)) {
        current += direction * step();
        show();
      }
      return;
    }
    const flip = prepare(direction);
    if (flip) animateTo(flip, true);
  }

  function pointerDown(event) {
    if (turning || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target.closest("a,button,input,textarea,select")) return;
    candidate = {id:event.pointerId, x:event.clientX, y:event.clientY};
  }

  function pointerMove(event) {
    if (!candidate || event.pointerId !== candidate.id) return;
    const dx = event.clientX - candidate.x;
    const dy = event.clientY - candidate.y;
    if (!drag) {
      if (Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx)) {
        candidate = null; // Preserve normal vertical reading/scrolling.
        return;
      }
      if (Math.abs(dx) < 14 || Math.abs(dx) < 1.35 * Math.abs(dy)) return;
      const direction = dx < 0 ? 1 : -1;
      const flip = prepare(direction);
      if (!flip) {
        candidate = null;
        return;
      }
      drag = {flip, fraction:0};
      frame.classList.add("book-dragging");
      try {frame.setPointerCapture(event.pointerId);} catch (_) {}
    }
    const dragAmount = (drag.flip.direction > 0 ? -dx : dx);
    const travel = frame.clientWidth * (isMobile() ? .64 : .43);
    drag.fraction = bounded(dragAmount / Math.max(travel, 90));
    const degrees = drag.flip.from +
      (drag.flip.to - drag.flip.from) * drag.fraction;
    sheet.style.transition = "none";
    sheet.style.transform = "rotateY(" + degrees + "deg)";
  }

  function pointerFinish(event) {
    if (!candidate || event.pointerId !== candidate.id) return;
    if (drag) {
      const dx = event.clientX - candidate.x;
      const complete = drag.fraction > .25 || Math.abs(dx) > 85;
      frame.classList.remove("book-dragging");
      const flip = drag.flip;
      candidate = null;
      drag = null;
      animateTo(flip, complete);
    } else {
      candidate = null;
    }
  }

  fetch(articleUrl, {cache:"default"}).then(response => {
    if (!response.ok) throw new Error("Article unavailable");
    return response.text();
  }).then(html => {
    const documentCopy = new DOMParser().parseFromString(html, "text/html");
    const title = documentCopy.querySelector("h1.detail-title")?.textContent?.trim();
    const abstract = documentCopy.querySelector(".detail-lead");
    const article = documentCopy.querySelector("article.detail-card");
    if (!title || !article) throw new Error("Invalid publication");

    document.getElementById("book-heading").textContent = title;
    document.title = title + " | Book Reader | MalGuard Research";
    pages = [createPage("TECHNICAL RESEARCH / MALGUARD", title, abstract ? [abstract] : [], true)];
    article.querySelectorAll(":scope > section").forEach(section => {
      const heading = section.querySelector("h2");
      if (!heading) return;
      const contents = Array.from(section.children).filter(node => node !== heading);
      pages.push(createPage("MALGUARD RESEARCH · TECHNICAL NOTE", heading.textContent, contents));
    });
    if (pages.length < 2) throw new Error("The publication has no sections");

    spread.replaceChildren();
    frame = document.createElement("div");
    frame.className = "reader-book";
    frame.setAttribute("aria-label", "Interactive research book; swipe horizontally to turn pages");
    frame.innerHTML =
      '<div class="reader-book-gutter" aria-hidden="true"></div>' +
      '<div class="book-leaf book-leaf-left"></div>' +
      '<div class="book-leaf book-leaf-right"></div>' +
      '<div class="turning-sheet" hidden aria-hidden="true">' +
      '<div class="sheet-face sheet-face-front"></div>' +
      '<div class="sheet-face sheet-face-back"></div></div>';
    left = frame.querySelector(".book-leaf-left");
    right = frame.querySelector(".book-leaf-right");
    sheet = frame.querySelector(".turning-sheet");
    front = frame.querySelector(".sheet-face-front");
    back = frame.querySelector(".sheet-face-back");
    spread.append(frame);

    previous.addEventListener("click", () => turn(-1));
    next.addEventListener("click", () => turn(1));
    frame.addEventListener("pointerdown", pointerDown);
    frame.addEventListener("pointermove", pointerMove);
    frame.addEventListener("pointerup", pointerFinish);
    frame.addEventListener("pointercancel", event => {
      if (drag && candidate && candidate.id === event.pointerId) {
        const flip = drag.flip;
        candidate = null;
        drag = null;
        animateTo(flip, false);
      } else {
        candidate = null;
      }
    });
    document.addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest("input,textarea,select,button,a")) return;
      if (event.key === "ArrowRight") turn(1);
      if (event.key === "ArrowLeft") turn(-1);
    });
    mobileQuery.addEventListener("change", () => {
      if (turning) return; // A turn finishes before the layout changes.
      if (!isMobile()) current -= current % 2;
      show();
    });
    show();
  }).catch(() => {
    spread.textContent = "The book could not be loaded. Open the full article instead.";
    status.textContent = "Book unavailable";
  });
})();

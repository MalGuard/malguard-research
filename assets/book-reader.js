"use strict";

/**
 * MalGuard Research / Paper folio
 * A physically curved, strip-mesh page with front/back printed surfaces.
 * No third-party runtime or continuous animation.
 */
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
  const mobileQuery = matchMedia("(max-width: 760px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = n => Math.min(1, Math.max(0, n));

  let pages = [], current = 0, busy = false, gesture = null;
  let book, left, right, mesh, shade;
  let strips = [], sheetWidth = 0, pageHeight = 0, raf = 0;
  let activeFlip = null, revealed = false;

  if (!allowed.has(slug)) {
    spread.textContent = "Select a published paper from the research index.";
    status.textContent = "No paper selected";
    return;
  }

  const articleUrl = "/papers/" + slug + ".html";
  document.getElementById("article-link").href = articleUrl;
  document.getElementById("pdf-link").href = "/pdfs/" + slug + ".pdf";

  const mobile = () => mobileQuery.matches;
  const step = () => mobile() ? 1 : 2;
  const available = dir => dir > 0 ? current + step() < pages.length : current > 0;

  function page(label, heading, contents, cover = false) {
    const node = document.createElement("section");
    node.className = cover ? "reader-page reader-cover" : "reader-page";
    const kicker = document.createElement("div");
    kicker.className = "reader-page-label";
    kicker.textContent = label;
    const title = document.createElement(cover ? "h2" : "h3");
    title.textContent = heading;
    node.append(kicker, title);
    contents.forEach(el => node.append(el.cloneNode(true)));
    const foot = document.createElement("div");
    foot.className = "reader-page-footer";
    foot.textContent = "MALGUARD RESEARCH  /  2026";
    node.append(foot);
    return node;
  }

  function pageAt(index) {
    if (index >= 0 && index < pages.length) return pages[index].cloneNode(true);
    const blank = document.createElement("div");
    blank.className = "reader-page reader-page-blank";
    blank.textContent = "MALGUARD / RESEARCH";
    blank.setAttribute("aria-hidden", "true");
    return blank;
  }

  function put(el, index) { el.replaceChildren(pageAt(index)); }

  function updateControls() {
    previous.disabled = busy || !available(-1);
    next.disabled = busy || !available(1);
    const end = Math.min(current + step(), pages.length);
    status.textContent = "Page" + (end > current + 1 ? "s " : " ") +
      (current + 1) + (end > current + 1 ? "–" + end : "") + " of " + pages.length;
  }

  function reset() {
    cancelAnimationFrame(raf);
    busy = false;
    gesture = null;
    mesh.replaceChildren();
    mesh.hidden = true;
    mesh.style.opacity = "1";
    shade.style.opacity = "0";
    activeFlip = null;
    revealed = false;
    book.classList.remove("is-turning", "is-dragging");
    if (mobile()) {
      left.replaceChildren();
      put(right, current);
    } else {
      put(left, current);
      put(right, current + 1);
    }
    updateControls();
  }

  // Each paper strip has a real 3D position and a printed front/back.
  // Neighboring strips follow a smooth curved profile rather than a rigid hinge.
  function buildMesh(frontIndex, backIndex) {
    mesh.replaceChildren();
    strips = [];
    sheetWidth = book.clientWidth * (mobile() ? 1 : .5);
    pageHeight = book.clientHeight;
    const count = mobile() ? 12 : 16;
    const stripWidth = sheetWidth / count;
    const frontPage = pageAt(frontIndex);
    const backPage = pageAt(backIndex);
    for (let i = 0; i < count; i++) {
      const segment = document.createElement("div");
      segment.className = "curl-strip";
      segment.style.width = (stripWidth + .35) + "px";
      segment.style.height = pageHeight + "px";
      const frontFace = document.createElement("div");
      frontFace.className = "curl-face curl-front";
      const backFace = document.createElement("div");
      backFace.className = "curl-face curl-back";
      for (const [face, source, offset] of [
        [frontFace, frontPage, i * stripWidth],
        [backFace, backPage, sheetWidth - i * stripWidth]
      ]) {
        const content = document.createElement("div");
        content.className = "curl-content";
        content.style.width = sheetWidth + "px";
        content.style.height = pageHeight + "px";
        content.style.transform = "translateX(" + (-offset) + "px)";
        content.append(source.cloneNode(true));
        face.append(content);
        const light = document.createElement("div");
        light.className = "curl-light";
        face.append(light);
      }
      segment.append(frontFace, backFace);
      mesh.append(segment);
      strips.push(segment);
    }
    mesh.hidden = false;
  }

  function draw(progress) {
    const p = clamp(progress);
    // The paper flexes most strongly in the middle of the turn.
    // The local angle changes across its width, giving a true curved sheet.
    const curvature = 26 * Math.sin(Math.PI * p);
    const width = sheetWidth / strips.length;
    let x = 0, z = 0;
    for (let i = 0; i < strips.length; i++) {
      const u = (i + .5) / strips.length;
      const angle = -180 * p + curvature * (2 * u - 1);
      const radians = angle * Math.PI / 180;
      const strip = strips[i];
      strip.style.transform = "translate3d(" + x.toFixed(2) + "px,0," +
        z.toFixed(2) + "px) rotateY(" + angle.toFixed(3) + "deg)";
      // Diffuse illumination plus darkening near the fold.
      strip.style.setProperty("--curl-dark", (0.12 + .26 * Math.abs(Math.sin(radians))).toFixed(3));
      strip.style.setProperty("--curl-glow", (0.08 + .13 * Math.max(0, Math.cos(radians))).toFixed(3));
      x += Math.cos(radians) * width;
      z -= Math.sin(radians) * width;
    }
    // Hand off to the resting page while the turning leaf still covers it.
    // Crossfade during the last 8% to avoid a visible snap on reset.
    if (activeFlip) {
      const forward = activeFlip.direction > 0;
      const completion = forward ? p : 1 - p;
      const shouldReveal = completion >= .92;
      if (!mobile() && shouldReveal !== revealed) {
        const stationary = forward ? left : right;
        const oldIndex = forward ? activeFlip.target - step() : activeFlip.target + step() + 1;
        const newIndex = forward ? activeFlip.target : activeFlip.target + 1;
        put(stationary, shouldReveal ? newIndex : oldIndex);
        revealed = shouldReveal;
      }
      mesh.style.opacity = completion > .92
        ? String(1 - clamp((completion - .92) / .08))
        : "1";
    }
    shade.style.opacity = (Math.sin(Math.PI * p) * .45).toFixed(3);
    shade.style.transform = "translateX(" + ((.5 - p) * sheetWidth * .55).toFixed(2) + "px)";
  }

  function begin(direction) {
    if (busy || !available(direction)) return null;
    busy = true;
    updateControls();
    const target = current + direction * step();
    const forward = direction > 0;
    let faceA, faceB;
    if (mobile()) {
      // A single page moves aside to reveal the new page underneath.
      put(right, target);
      faceA = forward ? current : target;
      faceB = forward ? target : current;
    } else if (forward) {
      put(left, current);
      put(right, target + 1);
      faceA = current + 1;
      faceB = target;
    } else {
      put(left, target);
      put(right, current + 1);
      faceA = target + 1;
      faceB = current;
    }
    buildMesh(faceA, faceB);
    activeFlip = {target, direction};
    revealed = false;
    mesh.style.opacity = "1";
    book.classList.add("is-turning");
    draw(forward ? 0 : 1);
    return {target, direction, from:forward ? 0 : 1, to:forward ? 1 : 0};
  }

  function finish(flip, success) {
    if (success) current = flip.target;
    reset();
  }

  function animate(flip, from, to, success) {
    cancelAnimationFrame(raf);
    if (reducedMotion.matches) {
      finish(flip, success);
      return;
    }
    const duration = 720 * Math.abs(to - from) + 160;
    const started = performance.now();
    function tick(now) {
      const t = clamp((now - started) / duration);
      const eased = t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
      draw(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else finish(flip, success);
    }
    raf = requestAnimationFrame(tick);
  }

  function turn(direction) {
    if (busy || !available(direction)) return;
    if (reducedMotion.matches) {
      current += direction * step();
      reset();
      return;
    }
    const flip = begin(direction);
    if (flip) animate(flip, flip.from, flip.to, true);
  }

  function down(event) {
    if (busy || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target.closest("a,button,input,textarea,select")) return;
    const rect = book.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    // On desktop, the outer edge is the natural place to pick up a sheet.
    if (event.pointerType === "mouse" && !mobile() &&
      localX > rect.width * .36 && localX < rect.width * .64) return;
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY,
      startX:localX, flip:null, progress:0, dragging:false};
  }

  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (reducedMotion.matches) return;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx)) {
        gesture = null; // Do not steal vertical scrolling.
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) < 1.3 * Math.abs(dy)) return;
      const direction = dx < 0 ? 1 : -1;
      const flip = begin(direction);
      if (!flip) { gesture = null; return; }
      gesture.flip = flip;
      gesture.dragging = true;
      book.classList.add("is-dragging");
      try {book.setPointerCapture(event.pointerId);} catch (_) {}
    }
    const flip = gesture.flip;
    const travel = Math.max(sheetWidth * .86, 110);
    const delta = (flip.direction > 0 ? -dx : dx);
    const fraction = clamp(delta / travel);
    gesture.progress = flip.from + (flip.to - flip.from) * fraction;
    cancelAnimationFrame(raf);
    draw(gesture.progress);
  }

  function up(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    if (g.dragging) {
      const ratio = Math.abs(g.progress - g.flip.from);
      const complete = ratio > .35;
      book.classList.remove("is-dragging");
      animate(g.flip, g.progress, complete ? g.flip.to : g.flip.from, complete);
    } else if (reducedMotion.matches) {
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      if (Math.abs(dx) > 65 && Math.abs(dx) > 1.3 * Math.abs(dy)) turn(dx < 0 ? 1 : -1);
    } else {
      // Clicking a paper's outer corner lifts and turns it.
      const rect = book.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (mobile()) {
        if (x > rect.width * .72) turn(1);
        else if (x < rect.width * .28) turn(-1);
      } else {
        if (x > rect.width * .88) turn(1);
        else if (x < rect.width * .12) turn(-1);
      }
    }
  }

  fetch(articleUrl).then(response => {
    if (!response.ok) throw new Error("Publication not found");
    return response.text();
  }).then(html => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.querySelector("h1.detail-title")?.textContent?.trim();
    const abstract = doc.querySelector(".detail-lead");
    const article = doc.querySelector("article.detail-card");
    if (!title || !article) throw new Error("Invalid publication");
    document.getElementById("book-heading").textContent = title;
    document.title = title + " | Book Reader | MalGuard Research";

    pages = [page("MALGUARD RESEARCH / ORIGINAL TECHNICAL NOTE", title,
      abstract ? [abstract] : [], true)];
    for (const section of article.querySelectorAll(":scope > section")) {
      const heading = section.querySelector("h2");
      if (!heading) continue;
      const children = [...section.children].filter(node => node !== heading);
      pages.push(page("MALGUARD RESEARCH / RESEARCH PAPER", heading.textContent, children));
    }
    if (pages.length < 2) throw new Error("No article sections found");

    spread.replaceChildren();
    book = document.createElement("div");
    book.className = "reader-book";
    book.setAttribute("aria-label", "Physical book with draggable, curling pages");
    book.innerHTML =
      '<div class="book-stack" aria-hidden="true"></div>' +
      '<div class="book-leaf book-leaf-left"></div>' +
      '<div class="book-leaf book-leaf-right"></div>' +
      '<div class="book-gutter" aria-hidden="true"></div>' +
      '<div class="book-cast-shadow" aria-hidden="true"></div>' +
      '<div class="curl-mesh" hidden aria-hidden="true"></div>';
    left = book.querySelector(".book-leaf-left");
    right = book.querySelector(".book-leaf-right");
    mesh = book.querySelector(".curl-mesh");
    shade = book.querySelector(".book-cast-shadow");
    spread.append(book);

    previous.addEventListener("click", () => turn(-1));
    next.addEventListener("click", () => turn(1));
    book.addEventListener("pointerdown", down);
    book.addEventListener("pointermove", move);
    book.addEventListener("pointerup", up);
    book.addEventListener("pointercancel", event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const g = gesture;
      gesture = null;
      if (g.dragging) animate(g.flip, g.progress, g.flip.from, false);
    });
    document.addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest("input,textarea,select,button,a")) return;
      if (event.key === "ArrowRight") turn(1);
      if (event.key === "ArrowLeft") turn(-1);
    });
    mobileQuery.addEventListener("change", () => {
      if (busy) return;
      if (!mobile()) current -= current % 2;
      reset();
    });
    reset();
  }).catch(() => {
    spread.textContent = "The book could not be loaded. Open the full article instead.";
    status.textContent = "Reader unavailable";
  });
})();

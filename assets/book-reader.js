"use strict";
(() => {
  const allowed = new Set(["hash-identity-vs-trust","zip-structure-vs-filename","evidence-ladder-for-scanners","game-mod-threat-model","malicious-mod-distribution","static-vs-behavioral-analysis"]);
  const slug = new URLSearchParams(location.search).get("paper");
  const spread = document.getElementById("reader-spread");
  const previous = document.getElementById("previous-page");
  const next = document.getElementById("next-page");
  const status = document.getElementById("page-status");
  if (!allowed.has(slug)) {
    spread.textContent = "Select a published paper from the research index.";
    status.textContent = "No paper selected";
    return;
  }
  const url = "/papers/" + slug + ".html";
  document.getElementById("article-link").href = url;
  document.getElementById("pdf-link").href = "/pdfs/" + slug + ".pdf";
  let pages = [];
  let current = 0;
  function showPage() {
    spread.replaceChildren();
    spread.append(pages[current].cloneNode(true));
    previous.disabled = current === 0;
    next.disabled = current === pages.length - 1;
    status.textContent = "Page " + (current + 1) + " of " + pages.length;
  }
  function makePage(label, title, nodes, cover = false) {
    const page = document.createElement("section");
    page.className = cover ? "reader-page reader-cover" : "reader-page";
    const labelEl = document.createElement("div");
    labelEl.className = "reader-page-label";
    labelEl.textContent = label;
    page.append(labelEl);
    const heading = document.createElement(cover ? "h2" : "h3");
    heading.textContent = title;
    page.append(heading);
    nodes.forEach(node => page.append(node.cloneNode(true)));
    const footer = document.createElement("div");
    footer.className = "reader-page-footer";
    footer.textContent = "MALGUARD RESEARCH  /  2026";
    page.append(footer);
    return page;
  }
  fetch(url, {cache:"no-store"}).then(response => {
    if (!response.ok) throw new Error("Paper unavailable");
    return response.text();
  }).then(markup => {
    const doc = new DOMParser().parseFromString(markup, "text/html");
    const title = doc.querySelector("h1.detail-title")?.textContent?.trim();
    const abstract = doc.querySelector(".detail-lead");
    const article = doc.querySelector("article.detail-card");
    if (!title || !article) throw new Error("Invalid publication");
    document.getElementById("book-heading").textContent = title;
    document.title = title + " | Book Reader | MalGuard Research";
    pages = [makePage("ORIGINAL TECHNICAL NOTE", title, abstract ? [abstract] : [], true)];
    article.querySelectorAll(":scope > section").forEach(section => {
      const h = section.querySelector("h2");
      if (!h) return;
      pages.push(makePage("RESEARCH PUBLICATION", h.textContent, [...section.children].filter(el => el !== h)));
    });
    if (!pages.length) throw new Error("Empty publication");
    previous.addEventListener("click", () => {if(current > 0){current--;showPage();}});
    next.addEventListener("click", () => {if(current < pages.length-1){current++;showPage();}});
    document.addEventListener("keydown", event => {
      if (event.target.closest("input,textarea,select,button")) return;
      if (event.key === "ArrowRight" && current < pages.length-1){current++;showPage();}
      if (event.key === "ArrowLeft" && current > 0){current--;showPage();}
    });
    showPage();
  }).catch(() => {
    spread.textContent = "This paper could not be loaded. Open the full article instead.";
    status.textContent = "Reader unavailable";
  });
})();
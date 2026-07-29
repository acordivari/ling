// glossary.js — the reference panel. Self-contained: nothing else in the app
// imports from here, and this imports nothing but its own data, so the
// glossary can be removed by deleting two files and one script tag.
//
// Behaviour mirrors the reference implementation it was modelled on:
// search across all text, category filter, always-visible formal definition,
// collapsible plain-language version, cross-links that scroll to their target.

import { GLOSSARY, GLOSSARY_CATEGORIES } from "./glossary-data.js";

const ALL = "All Terms";
const byId = new Map(GLOSSARY.map((e) => [e.id, e]));
const colourOf = (name) =>
  (GLOSSARY_CATEGORIES.find((c) => c.name === name) || {}).color || "#7070a8";
const iconOf = (name) =>
  (GLOSSARY_CATEGORIES.find((c) => c.name === name) || {}).icon || "◈";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const state = { category: ALL, query: "", open: new Set(), built: false };
let root = null;
let listNode = null;
let countNode = null;
let searchNode = null;
let lastFocus = null;

// ------------------------------------------------------------------ filter

function matches(entry) {
  if (state.category !== ALL && entry.category !== state.category) return false;
  const q = state.query.toLowerCase().trim();
  if (!q) return true;
  return (
    entry.term.toLowerCase().includes(q) ||
    entry.formal.toLowerCase().includes(q) ||
    entry.eli5.toLowerCase().includes(q) ||
    (entry.symbol || "").toLowerCase().includes(q) ||
    entry.category.toLowerCase().includes(q)
  );
}

// ------------------------------------------------------------------ render

function entryCard(entry) {
  const colour = colourOf(entry.category);
  const card = el("article", "g-entry");
  card.id = `glossary-entry-${entry.id}`;
  card.style.setProperty("--cat", colour);

  // -- head
  const head = el("header", "g-entry-head");
  const title = el("div", "g-title");
  title.append(el("h3", null, entry.term));
  if (entry.symbol) title.append(el("span", "g-symbol", entry.symbol));
  head.append(title);

  const tag = el("span", "g-cat");
  tag.append(el("span", "g-cat-icon", iconOf(entry.category)));
  tag.append(document.createTextNode(entry.category));
  head.append(tag);
  card.append(head);

  // -- formal, always visible
  const body = el("div", "g-body");
  body.append(el("div", "g-label", "Formal Definition"));
  body.append(el("p", "g-formal", entry.formal));

  // -- eli5, collapsed by default
  const isOpen = state.open.has(entry.id);
  const toggle = el("button", "g-toggle");
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-controls", `glossary-eli5-${entry.id}`);
  toggle.append(el("span", "g-caret", isOpen ? "▾" : "▸"));
  toggle.append(document.createTextNode("Explain Like I'm 5"));
  toggle.addEventListener("click", () => {
    if (state.open.has(entry.id)) state.open.delete(entry.id);
    else state.open.add(entry.id);
    render();
  });
  body.append(toggle);

  const eli5 = el("div", "g-eli5");
  eli5.id = `glossary-eli5-${entry.id}`;
  eli5.append(el("p", null, entry.eli5));
  if (!isOpen) eli5.hidden = true;
  body.append(eli5);

  // -- cross-links
  const links = (entry.seeAlso || []).filter((id) => byId.has(id));
  if (links.length) {
    const see = el("div", "g-see");
    see.append(el("span", "g-see-label", "See also"));
    for (const id of links) {
      const b = el("button", "g-link", byId.get(id).term);
      b.style.setProperty("--cat", colourOf(byId.get(id).category));
      b.addEventListener("click", () => jumpTo(id));
      see.append(b);
    }
    body.append(see);
  }

  card.append(body);
  return card;
}

function render() {
  const shown = GLOSSARY.filter(matches);
  countNode.textContent = `${shown.length} of ${GLOSSARY.length} terms`;

  listNode.replaceChildren();
  if (!shown.length) {
    const empty = el("div", "g-empty");
    empty.append(el("p", null, `No terms match "${state.query}"`));
    listNode.append(empty);
    return;
  }
  for (const entry of shown) listNode.append(entryCard(entry));

  for (const btn of root.querySelectorAll(".g-pill")) {
    btn.classList.toggle("active", btn.dataset.cat === state.category);
  }
}

// A cross-link target may be filtered out of view. Clear the filters first,
// then expand and scroll — otherwise the click silently does nothing.
function jumpTo(id) {
  const entry = byId.get(id);
  if (!entry) return;
  if (!matches(entry)) {
    state.category = ALL;
    state.query = "";
    searchNode.value = "";
  }
  state.open.add(id);
  render();
  // render() replaces the whole list, so the new nodes have no layout yet.
  // Scrolling in the same tick measures against the stale tree and lands at 0.
  requestAnimationFrame(() => {
    const node = document.getElementById(`glossary-entry-${id}`);
    if (!node) return;
    // Direct assignment, not scrollTo({behavior:"smooth"}): the animated form
    // silently no-ops here, and an 8000px glide is worse than a cut anyway.
    // The flash is what tells you where you landed.
    listNode.scrollTop = Math.max(0, node.offsetTop - 8);
    node.classList.add("g-flash");
    setTimeout(() => node.classList.remove("g-flash"), 900);
  });
}

// ------------------------------------------------------------------- shell

function build() {
  root = el("div", "g-overlay");
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Glossary");

  const modal = el("div", "g-modal");

  // -- header
  const head = el("header", "g-head");
  const brand = el("div", "g-brand");
  brand.append(el("div", "g-kicker", "WhAM Explorer · Reference"));
  const titleRow = el("div", "g-title-row");
  titleRow.append(el("h2", null, "Glossary"));
  countNode = el("span", "g-count");
  titleRow.append(countNode);
  brand.append(titleRow);
  head.append(brand);

  searchNode = el("input", "g-search");
  searchNode.type = "search";
  searchNode.placeholder = "Search…";
  searchNode.setAttribute("aria-label", "Search glossary");
  searchNode.addEventListener("input", () => {
    state.query = searchNode.value;
    render();
    listNode.scrollTop = 0; // otherwise results open mid-list at the old offset
  });
  head.append(searchNode);

  const close = el("button", "g-close", "×");
  close.setAttribute("aria-label", "Close glossary");
  close.addEventListener("click", hide);
  head.append(close);
  modal.append(head);

  // -- category pills
  const pills = el("div", "g-pills");
  for (const cat of GLOSSARY_CATEGORIES) {
    const n = cat.name === ALL
      ? GLOSSARY.length
      : GLOSSARY.filter((e) => e.category === cat.name).length;
    const b = el("button", "g-pill");
    b.dataset.cat = cat.name;
    b.style.setProperty("--cat", cat.color);
    b.append(el("span", "g-cat-icon", cat.icon));
    b.append(document.createTextNode(cat.name));
    b.append(el("span", "g-pill-n", String(n)));
    b.addEventListener("click", () => {
      state.category = cat.name;
      render();
      listNode.scrollTop = 0;
    });
    pills.append(b);
  }
  modal.append(pills);

  listNode = el("div", "g-list");
  modal.append(listNode);

  modal.append(el("footer", "g-foot",
    "Values quoted here were read from the shipped checkpoints and upstream source, " +
    "not from the paper. Datasets describe what WhAM was trained on, not what ships with this repo."));

  root.append(modal);
  root.addEventListener("click", (e) => { if (e.target === root) hide(); });
  document.body.append(root);
  state.built = true;
}

function show() {
  if (!state.built) build();
  lastFocus = document.activeElement;
  root.hidden = false;
  document.body.classList.add("g-lock");
  render();
  searchNode.focus();
}

function hide() {
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove("g-lock");
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && root && !root.hidden) hide();
});

const trigger = document.getElementById("glossaryBtn");
if (trigger) trigger.addEventListener("click", show);

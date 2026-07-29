// Glossary data tests. Run with:  node test/glossary.test.mjs
//
// The glossary is static data, so there is no analysis round trip to check.
// What can rot is the wiring: a `seeAlso` pointing at an id that was renamed,
// a category string that no longer matches the filter list, a duplicate id
// silently shadowing an entry. All three fail silently in the browser — a
// dead cross-link just renders as nothing — so they are asserted here.

import { GLOSSARY, GLOSSARY_CATEGORIES } from "../js/glossary-data.js";

let fails = 0;
const ok = (c, m, extra = "") => {
  console.log(`${c ? "  ok  " : " FAIL "} ${m}${extra ? "  " + extra : ""}`);
  if (!c) fails++;
};

const ids = GLOSSARY.map((e) => e.id);
const idSet = new Set(ids);
const catNames = new Set(GLOSSARY_CATEGORIES.map((c) => c.name));

// ------------------------------------------------- structure
console.log("\n== entry structure ==");
ok(GLOSSARY.length > 0, "glossary is non-empty", `${GLOSSARY.length} entries`);
ok(idSet.size === ids.length, "all ids unique",
  idSet.size === ids.length ? "" : `${ids.length - idSet.size} duplicate(s)`);

for (const field of ["id", "term", "category", "formal", "eli5"]) {
  const missing = GLOSSARY.filter((e) => !e[field] || typeof e[field] !== "string");
  ok(missing.length === 0, `every entry has a non-empty ${field}`,
    missing.length ? missing.map((e) => e.id || "<no id>").join(", ") : "");
}

{
  const bad = GLOSSARY.filter((e) => !/^[a-z0-9-]+$/.test(e.id));
  ok(bad.length === 0, "ids are kebab-case", bad.map((e) => e.id).join(", "));
}

// ------------------------------------------------- categories
console.log("\n== categories ==");
{
  const unknown = GLOSSARY.filter((e) => !catNames.has(e.category));
  ok(unknown.length === 0, "every entry category exists in GLOSSARY_CATEGORIES",
    unknown.map((e) => `${e.id}:${e.category}`).join(", "));

  const used = new Set(GLOSSARY.map((e) => e.category));
  const empty = GLOSSARY_CATEGORIES
    .filter((c) => c.name !== "All Terms" && !used.has(c.name))
    .map((c) => c.name);
  ok(empty.length === 0, "no category renders an empty filter", empty.join(", "));

  ok(GLOSSARY_CATEGORIES[0].name === "All Terms", "'All Terms' is the first pill");

  const noColour = GLOSSARY_CATEGORIES.filter((c) => !/^#[0-9a-f]{6}$/i.test(c.color));
  ok(noColour.length === 0, "every category has a hex colour", noColour.map((c) => c.name).join(", "));
}

// ------------------------------------------------- cross-links
console.log("\n== seeAlso cross-links ==");
{
  const dangling = [];
  const selfRef = [];
  for (const e of GLOSSARY) {
    for (const ref of e.seeAlso || []) {
      if (!idSet.has(ref)) dangling.push(`${e.id} -> ${ref}`);
      if (ref === e.id) selfRef.push(e.id);
    }
  }
  ok(dangling.length === 0, "no seeAlso points at a missing id", dangling.join(", "));
  ok(selfRef.length === 0, "no entry links to itself", selfRef.join(", "));

  const dupes = GLOSSARY.filter((e) => {
    const refs = e.seeAlso || [];
    return new Set(refs).size !== refs.length;
  });
  ok(dupes.length === 0, "no duplicate refs within one entry", dupes.map((e) => e.id).join(", "));

  // An entry nothing links to is reachable only by scrolling or search. Not a
  // defect, but if the count climbs the cross-link graph has stopped being useful.
  const linked = new Set(GLOSSARY.flatMap((e) => e.seeAlso || []));
  const orphans = ids.filter((id) => !linked.has(id));
  ok(orphans.length <= 3, "at most 3 entries are unreferenced",
    orphans.length ? orphans.join(", ") : "");
}

// ------------------------------------------------- prose sanity
console.log("\n== prose ==");
{
  // The two registers have to stay distinct — an eli5 that duplicates the
  // formal text means the entry was half-written.
  const same = GLOSSARY.filter((e) => e.formal.trim() === e.eli5.trim());
  ok(same.length === 0, "formal and eli5 differ", same.map((e) => e.id).join(", "));

  const thin = GLOSSARY.filter((e) => e.formal.length < 120);
  ok(thin.length === 0, "formal definitions are substantive (>=120 chars)",
    thin.map((e) => `${e.id}:${e.formal.length}`).join(", "));

  // The eli5 floor is high on purpose. These are not one-line glosses — each
  // is meant to carry an analogy AND the reason the concept bites in this
  // project. A short one is a stub that slipped through, not a concise entry.
  const thinEli5 = GLOSSARY.filter((e) => e.eli5.length < 400);
  ok(thinEli5.length === 0, "eli5 entries carry analogy + grounding (>=400 chars)",
    thinEli5.map((e) => `${e.id}:${e.eli5.length}`).join(", "));

  // eli5 should be the longer of the two registers in most entries; if the
  // formal text is routinely longer, the plain-language pass was skimped.
  const longerEli5 = GLOSSARY.filter((e) => e.eli5.length > e.formal.length).length;
  ok(longerEli5 >= GLOSSARY.length * 0.6, "eli5 is the fuller register in most entries",
    `${longerEli5}/${GLOSSARY.length}`);

  // Search matches on lowercase; a term that is only findable by its symbol
  // is fine, but an empty symbol string would render a stray empty chip.
  const emptySym = GLOSSARY.filter((e) => "symbol" in e && !String(e.symbol).trim());
  ok(emptySym.length === 0, "no entry has a blank symbol chip", emptySym.map((e) => e.id).join(", "));
}

// ------------------------------------------------- coverage
console.log("\n== coverage ==");
{
  // These are the concepts the project's own docs lean on. If one disappears,
  // the glossary has drifted from what CLAUDE.md and INSTALL.md talk about.
  const required = [
    "lora", "masked-token-modelling", "embedding", "fad", "codebook",
    "domain-adaptation", "species-finetuning", "checkpoint", "overtraining",
    "acoustic-translation", "control-condition", "null-result",
  ];
  const absent = required.filter((id) => !idSet.has(id));
  ok(absent.length === 0, "core project concepts are all present", absent.join(", "));

  const datasets = ["watkins", "birdset", "audioset-animal", "dswp", "vampnet-base-corpus"];
  const missingData = datasets.filter((id) => !idSet.has(id));
  ok(missingData.length === 0, "every training dataset is documented", missingData.join(", "));

  const dataEntries = GLOSSARY.filter((e) => e.category === "Training Data");
  ok(dataEntries.length >= 5, "Training Data category is populated", `${dataEntries.length} entries`);
}

console.log(fails === 0 ? "\nALL PASS\n" : `\n${fails} FAILURE(S)\n`);
process.exit(fails ? 1 : 0);

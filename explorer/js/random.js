// random.js — seeded pseudo-random numbers.
//
// Why this exists: the synthesis in synth.js is noise-based, so a test that
// asserts "the IPI estimator detects a 2.5 ms echo" is really asserting
// something about a particular noise realisation. With Math.random() the suite
// failed roughly 1 run in 40 on the band-edge case — not because anything was
// broken, but because that run drew unlucky noise. A suite that goes red at
// random trains you to ignore red, which is worse than having no suite.
//
// It also makes the null models reproducible: a permutation test is only
// citable if re-running it gives the same p-value.
//
// mulberry32. Small, fast, and good enough for audio noise and label shuffles —
// this is not a cryptographic generator and must not be used as one.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-level generator. Deliberately global rather than threaded through
// every synthesis signature: clickGrain is called from spermWhaleClick, which
// is called from renderCoda, and passing a generator down that chain would
// change six signatures and every call site in main.js for no gain. The cost
// is that seeding is order-dependent — tests must call setSeed() themselves
// rather than relying on a previous test's state.
let current = mulberry32(0x5eed1e55);

/** Reset the shared stream. Same seed, same sequence, always. */
export function setSeed(seed) {
  current = mulberry32(seed);
}

/** Uniform in [0,1). Drop-in replacement for Math.random. */
export function random() {
  return current();
}

/** Uniform in [-1,1). The form every call site in synth.js actually wanted. */
export function signed() {
  return current() * 2 - 1;
}

/** An independent stream, for code that must not perturb the shared one. */
export function makeRng(seed) {
  return mulberry32(seed);
}


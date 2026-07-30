#!/usr/bin/env python3
"""Validate the stdlib MIDI parser in fetch_comparanda.py against `mido`.

    python3 tools/test_midi_parser.py            # needs mido + the Groove data

The parser exists so the toolchain has no third-party dependency. That is only
worth anything if it is actually correct, so this checks it against a reference
implementation on real files rather than trusting it.

Skips cleanly when mido or the data is absent — it is a development check, not
part of the shipped test suite.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_comparanda import midi_note_on_times, GROOVE_DIR  # noqa: E402

try:
    import mido
except ImportError:
    sys.exit("skip: mido not installed (try wham/.venv/bin/python)")

if not os.path.isdir(GROOVE_DIR):
    sys.exit("skip: Groove data absent — run tools/fetch_comparanda.py first")


def reference(path):
    """Same quantity, computed by mido."""
    t, out = 0.0, []
    for msg in mido.MidiFile(path):
        t += msg.time
        if msg.type == "note_on" and msg.velocity > 0:
            out.append(t)
    return out


paths = []
for base, _, files in os.walk(GROOVE_DIR):
    for f in files:
        if f.endswith(".mid"):
            paths.append(os.path.join(base, f))
paths.sort()
if not paths:
    sys.exit("skip: no .mid files found")

TOL = 1e-6
checked = failed = 0
worst = 0.0
worst_file = ""

for p in paths[:250]:
    try:
        mine, ref = midi_note_on_times(p), reference(p)
    except Exception as e:
        print(f"FAIL  {os.path.basename(p)}: raised {type(e).__name__}: {e}")
        failed += 1
        continue
    checked += 1
    if len(mine) != len(ref):
        print(f"FAIL  {os.path.basename(p)}: {len(mine)} note-ons vs mido's {len(ref)}")
        failed += 1
        continue
    d = max((abs(a - b) for a, b in zip(mine, ref)), default=0.0)
    if d > worst:
        worst, worst_file = d, os.path.basename(p)
    if d > TOL:
        print(f"FAIL  {os.path.basename(p)}: max onset error {d:.9f}s exceeds {TOL}")
        failed += 1

print(f"\nchecked {checked} files against mido")
print(f"worst onset disagreement: {worst:.3e}s  ({worst_file})")
print(f"tolerance: {TOL}s")
print("\nALL PASS" if failed == 0 else f"\n{failed} FAILURE(S)")
sys.exit(1 if failed else 0)

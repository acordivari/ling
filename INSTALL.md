# Installing WhAM on Apple Silicon

Notes from getting the upstream [Project-CETI/wham](https://github.com/Project-CETI/wham)
Python pipeline running locally. The upstream README assumes conda and an NVIDIA
GPU; neither is required.

**Verified 2026-07-28** on macOS 26.2 (Darwin 25.2.0), Apple M5, arm64.

## Headline

WhAM does not need CUDA. A 40.5M-parameter VampNet forward pass runs on both CPU
and MPS with no unimplemented-op fallbacks:

```
cpu  OK  params=40.5M  out=(1, 1024, 1683)  fwd=0.15s
mps  OK  params=40.5M  out=(1, 1024, 1683)  fwd=1.08s
```

Those timings are single cold calls — the MPS number includes kernel
compilation. They are evidence of *execution*, not a benchmark.

The relevant code paths were already device-agnostic upstream:
`Interface.__init__` defaults to `device="cpu"` (`vampnet/vampnet/interface.py:62`),
there are no hard `.cuda()` calls anywhere in the tree, the entry points guard
with `torch.device("cuda" if torch.cuda.is_available() else "cpu")`, and
flash-attention — the one genuinely CUDA-only component — ships disabled
(`VampNet.flash_attn: false`, `vampnet/conf/vampnet.yml:32`). `cuda` appears
only in the README's example invocation.

## Before you start: the Rosetta trap

Check which interpreter you are about to build against.

```bash
python3 -c "import sys,platform; print(sys.version.split()[0], platform.machine())"
```

On this machine `/usr/local/bin/python3` is **3.9.0 x86_64** and comes first on
`PATH`. Building against it yields Rosetta wheels and no MPS, silently — nothing
errors, everything is just slow and CPU-only. `/usr/bin/python3` is **3.9.6
arm64**. Use that one, or a conda/python.org arm64 build.

## Steps

```bash
cd wham
/usr/bin/python3 -m venv .venv                    # arm64 3.9.6, NOT /usr/local/bin/python3
.venv/bin/python -m pip install --upgrade pip "setuptools<81" wheel

brew install git-lfs                              # see gotcha 1
.venv/bin/python -m pip install -e .
.venv/bin/python -m pip install -e ./vampnet      # order matters, see gotcha 2
.venv/bin/python -m pip install --no-build-isolation madmom
brew install ffmpeg                               # conda-forge in upstream README
```

Then download the [weights](https://zenodo.org/records/17633708) into
`vampnet/models/` — `coarse.pth`, `c2f.pth`, `codec.pth`, `wavebeat.pth`.

## Gotchas

### 1. `git-lfs` must be installed first

`descript-audiotools` is LFS-backed. If the filter is registered in your
gitconfig but the binary is absent, pip's clone fails at checkout with a
confusing `exit code: 128`:

```
git-lfs filter-process: git-lfs: command not found
fatal: the remote end hung up unexpectedly
warning: Clone succeeded, but checkout failed.
```

Not macOS-specific. `brew install git-lfs` and re-run.

### 2. Install order is load-bearing

`vampnet/setup.py` pins `numpy<1.24`. Installing it second claws back what the
`wham` package pulled in:

| | after `pip install -e .` | after `pip install -e ./vampnet` |
|---|---|---|
| numpy | 1.26.4 | **1.23.5** |
| torch | 2.8.0 | **2.7.1** |

Both end states are fine and MPS survives the downgrade. Installing in the other
order leaves numpy too new for madmom.

### 3. `setuptools<81`, or madmom won't import

setuptools 82 removed `pkg_resources`, which madmom imports unconditionally at
`madmom/__init__.py:21`:

```
ModuleNotFoundError: No module named 'pkg_resources'
```

This is a 2026-package-versus-2018-package problem, not a platform one. Pin
`setuptools<81`. You will still get a deprecation warning on import; it is
harmless.

### 4. madmom is *not* the hard part

Contrary to expectation, madmom compiles cleanly on arm64 — a
`madmom-0.16.1-cp39-cp39-macosx_10_9_universal2.whl`, no Cython or numpy C-API
failures. Python 3.9 plus numpy 1.23.5 is exactly the window in which 2018-era
madmom still works. The pins in `vampnet/setup.py` are keeping it alive rather
than holding it back. Do not "modernise" them.

### 5. `urllib3==2.0` versus LibreSSL — the one real macOS problem

Apple's system Python links **LibreSSL 2.8.3**. urllib3 2.x requires OpenSSL
1.1.1+, so the `urllib3==2.0` pin in `wham/setup.py` makes `fadtk` unimportable:

```
ImportError: urllib3 v2.0 only supports OpenSSL 1.1.1+, currently the 'ssl'
module is compiled with LibreSSL 2.8.3
```

`fadtk` is the whole dependency for the cross-species FAD ladder, so this
matters for that experiment and nothing else.

Two options:

- **Downgrade** — `pip install "urllib3<2"` gives urllib3 1.26.20. `fadtk`
  imports, and `gradio` still imports fine despite declaring `urllib3~=2.0`, so
  its pin appears cosmetic at import time. But two declared pins are now
  violated and `pip check` complains. This is what the current `.venv` does.
- **Use a Python not linked against LibreSSL** — miniforge, or the python.org
  universal2 3.9 build. This is the clean fix, and it is the one place where the
  upstream README's "use conda" instruction is doing real work rather than
  being habit.

## Verifying

```bash
.venv/bin/python -c "
import warnings; warnings.filterwarnings('ignore')
import torch
from vampnet.modules.transformer import VampNet
m = VampNet(flash_attn=False).to('mps').eval()
z = torch.rand(1, m.latent_dim*m.n_codebooks, 187).to('mps')
with torch.no_grad(): print('ok', tuple(m(z).shape))
"
```

Import surface confirmed working: `vampnet`, `vampnet.interface`,
`vampnet.modules.transformer`, `audiotools`, `lac`, `wavebeat`, `argbind`,
`madmom`, `gradio`, and `fadtk` (under the urllib3 downgrade).

## Known-imperfect state

- `pip check` reports `grpcio 1.80.0 is not supported on this platform`. Nothing
  exercised so far touches it; expect trouble only if `wandb` or tensorboard
  logging gets used.
- The urllib3 pin violation from gotcha 5 is live in the current `.venv`.
- `.venv/` is untracked in the upstream clone's own git. The clone is gitignored
  from this repo (`wham/`), so it does not surface here.

## Not yet verified

Everything above establishes that the environment imports and that the
architecture executes. It does **not** establish that generation is numerically
correct on MPS — that needs the weights loaded and output audited by ear. MPS
and CUDA are not bit-identical, and this model was only ever validated on CUDA
upstream. Audit generations before trusting them, and log the checkpoint.

## Licensing

The code is MIT. The **weights are CC BY-NC-ND 4.0** — a different and stricter
licence. Non-commercial is not a constraint for this project, but *NoDerivatives*
is worth knowing about before any fine-tuning work: it does not stop you
fine-tuning locally, but it complicates publishing derived checkpoints.

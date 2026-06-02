"""
Sync 2B eval data tables from the torchtitan canonical README into
`scripts/plot-2b-eval-comparison.py`.

Source:  torchtitan/experiments/ezpz/docs/evals/agpt/2b/README.md,
         section "v1 vs v2 — full sweep (canonical table)"
Target:  scripts/plot-2b-eval-comparison.py
         (the TTV2_256N_DATA and TTV2_512N_DATA Python literals)

Workflow:
    cd ~/projects/saforem2/torchtitan && git pull
    cd ~/projects/saforem2/sam.onl
    python scripts/sync-2b-eval-data.py
    uv run --with matplotlib --with pandas --with numpy \\
           --with ambivalent --with ipython --with pyarrow \\
           scripts/plot-2b-eval-comparison.py

What it does:
  - Parses the `| Run | Step | Tokens | HellaSwag | ARC-Easy | ARC-Chall
    | Winogrande |` pipe-table rows for `v2 256N` and `v2 512N`.
  - Rewrites the TTV2_256N_DATA and TTV2_512N_DATA lists in
    `scripts/plot-2b-eval-comparison.py` between the existing
    `# --- TTV2_*_DATA_START ---` / `# --- TTV2_*_DATA_END ---` markers
    (added by this commit so the rewrite is byte-precise).
  - Prints a summary diff (N rows added/removed per chain).

Doesn't touch the v1 table or the MDS_DATA / TTV1_DATA literals — v1 is
frozen (bf16-tainted, kept for the record) and MDS comes from a
different pipeline (the model card, not the torchtitan README).
"""

import re
import sys
from pathlib import Path

README = (
    Path.home()
    / 'projects/saforem2/torchtitan/torchtitan/experiments/ezpz'
    / 'docs/evals/agpt/2b/README.md'
)
PLOT_SCRIPT = Path(__file__).parent / 'plot-2b-eval-comparison.py'

ROW_RE = re.compile(
    r'^\|\s*\*?\*?(v\d+\s*\d+N)\*?\*?\s*'   # Run, e.g. "v2 256N" or "**v2 256N**"
    r'\|\s*\*?\*?([\d,]+)\*?\*?\s*'         # Step
    r'\|\s*\*?\*?[\d.]+\*?\*?\s*'           # Tokens (B) — recomputed, ignore
    r'\|\s*\*?\*?([\d.]+)\*?\*?\s*'         # HellaSwag
    r'\|\s*\*?\*?([\d.]+)\*?\*?\s*'         # ARC-Easy
    r'\|\s*\*?\*?([\d.]+)\*?\*?\s*'         # ARC-Chall
    r'\|\s*\*?\*?([\d.]+)\*?\*?\s*\|'       # Winogrande
)


def parse_readme():
    """Return {'v2 256N': [(step, hs, ae, ac, wg), ...], 'v2 512N': [...]}."""
    out: dict[str, list[tuple[int, float, float, float, float]]] = {
        'v2 256N': [],
        'v2 512N': [],
    }
    text = README.read_text()
    for line in text.splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        run = m.group(1).strip()
        if run not in out:
            continue
        step = int(m.group(2).replace(',', ''))
        hs, ae, ac, wg = map(float, m.groups()[2:6])
        out[run].append((step, hs, ae, ac, wg))
    return out


def format_block(rows):
    """Emit a sequence of `    (step, hs, ae, ac, wg),` lines."""
    lines = []
    for step, hs, ae, ac, wg in rows:
        lines.append(
            f'    ({step:_}, {hs:.4f}, {ae:.4f}, {ac:.4f}, {wg:.4f}),'
        )
    return '\n'.join(lines)


def rewrite_block(text: str, marker: str, new_block: str) -> tuple[str, int]:
    """Replace the body between `--- {marker}_START ---` / `_END ---` markers.

    Returns (new_text, old_row_count). Errors if markers aren't present —
    caller should add them manually (see comments at top of file).
    """
    start = f'    # --- {marker}_START ---'
    end = f'    # --- {marker}_END ---'
    pattern = re.compile(
        rf'({re.escape(start)}\n)(.*?)(\n\s*{re.escape(end)})',
        re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        raise SystemExit(
            f'markers {start!r} / {end!r} not found in {PLOT_SCRIPT}; '
            'add them around the existing TTV2_*_DATA list bodies.'
        )
    old_count = sum(1 for ln in m.group(2).splitlines() if ln.strip().startswith('('))
    new_text = text[: m.start()] + start + '\n' + new_block + m.group(3) + text[m.end():]
    return new_text, old_count


def main():
    if not README.exists():
        raise SystemExit(f'README not found at {README}')

    parsed = parse_readme()
    if not parsed['v2 256N'] or not parsed['v2 512N']:
        raise SystemExit(
            'parsed 0 rows for one of v2 256N / v2 512N — README format may '
            f'have changed (got {len(parsed["v2 256N"])} / {len(parsed["v2 512N"])} rows)'
        )

    text = PLOT_SCRIPT.read_text()
    text, n_256_old = rewrite_block(text, 'TTV2_256N_DATA',
                                    format_block(parsed['v2 256N']))
    text, n_512_old = rewrite_block(text, 'TTV2_512N_DATA',
                                    format_block(parsed['v2 512N']))
    PLOT_SCRIPT.write_text(text)

    n_256_new = len(parsed['v2 256N'])
    n_512_new = len(parsed['v2 512N'])
    print(f'v2 256N: {n_256_old} → {n_256_new} rows  '
          f'(last step: {parsed["v2 256N"][-1][0]:,})')
    print(f'v2 512N: {n_512_old} → {n_512_new} rows  '
          f'(last step: {parsed["v2 512N"][-1][0]:,})')
    print(f'wrote {PLOT_SCRIPT}')
    print()
    print('Next: re-render the chart with')
    print('  uv run --with matplotlib --with pandas --with numpy \\')
    print('         --with ambivalent --with ipython --with pyarrow \\')
    print(f'         {PLOT_SCRIPT.name}')


if __name__ == '__main__':
    sys.exit(main())

"""Shared matplotlib style helpers for talk figures.

Single source for:
  - Iosevka25 font registration (the site's display font)
  - The canonical rcParams (size, weight, spine policy)

So every chart in the talk renders with the same typography without
each script copy-pasting the helper.
"""

import os

from matplotlib import font_manager as _fm


def register_iosevka25() -> None:
    """Add every Iosevka25 .ttf/.otf/.ttc in /Library/Fonts/ to matplotlib.

    matplotlib's bundled font cache often doesn't see fonts installed
    outside ~/.fonts; this scans /Library/Fonts/ once per process so we
    don't depend on a manual font-cache rebuild.
    """
    if not os.path.isdir('/Library/Fonts'):
        return
    for name in os.listdir('/Library/Fonts'):
        if name.lower().startswith('iosevka25') and name.lower().endswith(
            ('.ttf', '.otf', '.ttc')
        ):
            _fm.fontManager.addfont(f'/Library/Fonts/{name}')


# Canonical rcParams for talk figures. Loss-style — single-panel
# charts. Chart scripts can override individual entries before calling
# render() if a tighter grid (eval 2x2) needs smaller text.
TALK_RCPARAMS = {
    'font.family': ['Iosevka25', 'monospace'],
    'font.size': 22,
    'font.weight': 500,
    'axes.titlesize': 24,
    'axes.titleweight': 600,
    'axes.labelsize': 22,
    'axes.labelweight': 500,
    'xtick.labelsize': 20,
    'ytick.labelsize': 20,
    'legend.fontsize': 20,
    'figure.titlesize': 26,
    'figure.titleweight': 600,
    'axes.spines.top': False,
    'axes.spines.right': False,
    # ambivalent ships with grey text (~#555) that washes out on white
    # projector backgrounds. Override to near-black so axis labels,
    # ticks, titles, legend all read clearly in a presentation hall.
    # Stays in a `dark grey rather than pure black so it doesn't
    # clobber the color palette's contrast.
    'text.color': '#222',
    'axes.labelcolor': '#222',
    'axes.titlecolor': '#222',
    'xtick.color': '#222',
    'ytick.color': '#222',
    'axes.edgecolor': '#444',
}

# Variant for the 4-panel eval comparison. The grid divides the figure
# into 4, so each panel's axis labels need to scale down to fit, but
# not so small they're unreadable from the back.
TALK_RCPARAMS_GRID = {
    **TALK_RCPARAMS,
    'font.size': 19,
    'axes.titlesize': 20,
    'axes.labelsize': 19,
    'xtick.labelsize': 17,
    'ytick.labelsize': 17,
    'legend.fontsize': 17,
    'figure.titlesize': 22,
}

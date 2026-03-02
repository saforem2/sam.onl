#!/usr/bin/env python3
"""
Generate a weekly activity report from multiple tracking tools.

Pulls data from:
  1. RescueTime    (REST API)
  2. ActivityWatch  (local REST API)
  3. WakaTime       (REST API)
  4. Timing.app     (AppleScript → JSON export)
  5. Typing Stats   (iCloud JSON file)
  6. WhatPulse      (SQLite)
  7. Qbserve        (SQLite)

Usage:
  python3 scripts/activity-report.py
  python3 scripts/activity-report.py --days 14
  python3 scripts/activity-report.py --format html --output report.html

Environment variables:
  RESCUETIME_API_KEY  – API key from https://www.rescuetime.com/anapi/manage
"""

from __future__ import annotations

import argparse
import configparser
import json
import os
import re
import sqlite3
import subprocess
import sys
import textwrap
import urllib.request
import urllib.error
from base64 import b64encode
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


# ── Helpers ──────────────────────────────────────────────────────────────

def fmt_hours(seconds: float) -> str:
    h = seconds / 3600
    if h >= 1:
        return f"{h:.1f}h"
    return f"{seconds / 60:.0f}m"


def fmt_number(n: int | float) -> str:
    return f"{int(n):,}"


def api_get(url: str, headers: dict[str, str] | None = None) -> Any:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        return {"error": str(e)}


def api_post(url: str, body: Any, headers: dict[str, str] | None = None) -> Any:
    data = json.dumps(body).encode()
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        return {"error": str(e)}


def query_sqlite(db_path: str, sql: str, params: tuple = ()) -> list[tuple]:
    db = Path(db_path).expanduser()
    if not db.exists():
        return []
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        return conn.execute(sql, params).fetchall()
    except sqlite3.Error:
        return []
    finally:
        conn.close()


# ── Data Sources ─────────────────────────────────────────────────────────

def fetch_rescuetime(start: date, end: date) -> dict:
    api_key = os.environ.get("RESCUETIME_API_KEY", "")
    if not api_key:
        return {"status": "skipped", "reason": "RESCUETIME_API_KEY not set"}

    # Daily summary (automatic last ~14 days)
    summary = api_get(
        f"https://www.rescuetime.com/anapi/daily_summary_feed?key={api_key}"
    )
    if isinstance(summary, dict) and "error" in summary:
        return {"status": "error", "reason": summary["error"]}

    # Filter to our date range
    days = []
    for day in summary:
        d = date.fromisoformat(day.get("date", "1970-01-01"))
        if start <= d <= end:
            days.append({
                "date": day["date"],
                "productive_hours": day.get("total_hours", 0),
                "productivity_pulse": day.get("productivity_pulse", 0),
                "top_category": day.get("top_category", ""),
            })

    # Per-category breakdown
    categories = api_get(
        f"https://www.rescuetime.com/anapi/data?key={api_key}"
        f"&perspective=rank&restrict_kind=category"
        f"&restrict_begin={start}&restrict_end={end}&format=json"
    )
    top_categories = []
    if isinstance(categories, dict) and "rows" in categories:
        for row in categories["rows"][:10]:
            top_categories.append({
                "category": row[3],
                "hours": round(row[1] / 3600, 2),
                "productivity": row[5],
            })

    return {
        "status": "ok",
        "daily": sorted(days, key=lambda d: d["date"]),
        "top_categories": top_categories,
    }


def fetch_activitywatch(start: date, end: date) -> dict:
    base = "http://localhost:5600/api/0"

    # Check server is up
    buckets = api_get(f"{base}/buckets/")
    if isinstance(buckets, dict) and "error" in buckets:
        return {"status": "error", "reason": buckets["error"]}

    # Find window watcher bucket for this machine
    window_bucket = None
    for name in buckets:
        if "aw-watcher-window" in name and "Sams-MacBook-Pro-2" in name:
            window_bucket = name
            break
    if not window_bucket:
        # Fall back to first window bucket
        for name in buckets:
            if "aw-watcher-window" in name:
                window_bucket = name
                break

    if not window_bucket:
        return {"status": "error", "reason": "No window watcher bucket found"}

    start_iso = f"{start}T00:00:00+00:00"
    end_iso = f"{end + timedelta(days=1)}T00:00:00+00:00"

    # Aggregate time per app
    result = api_post(f"{base}/query/", {
        "timeperiods": [f"{start_iso}/{end_iso}"],
        "query": [
            f'events = query_bucket("{window_bucket}");',
            'RETURN = sort_by_duration(merge_events_by_keys(events, ["app"]));',
        ],
    })

    top_apps = []
    if isinstance(result, list) and len(result) > 0:
        for event in result[0][:15]:
            top_apps.append({
                "app": event.get("data", {}).get("app", "unknown"),
                "hours": round(event.get("duration", 0) / 3600, 2),
            })

    return {"status": "ok", "top_apps": top_apps}


def fetch_wakatime(start: date, end: date) -> dict:
    cfg_path = Path("~/.wakatime.cfg").expanduser()
    if not cfg_path.exists():
        return {"status": "skipped", "reason": "~/.wakatime.cfg not found"}

    config = configparser.ConfigParser()
    config.read(cfg_path)
    api_key = config.get("settings", "api_key", fallback="")
    if not api_key:
        return {"status": "skipped", "reason": "No api_key in ~/.wakatime.cfg"}

    auth = b64encode(api_key.encode()).decode()
    headers = {"Authorization": f"Basic {auth}"}

    # Weekly stats
    stats = api_get(
        "https://wakatime.com/api/v1/users/current/stats/last_7_days",
        headers=headers,
    )
    if isinstance(stats, dict) and "error" in stats:
        return {"status": "error", "reason": stats["error"]}

    data = stats.get("data", {})

    languages = [
        {"name": l["name"], "hours": round(l["total_seconds"] / 3600, 2)}
        for l in (data.get("languages") or [])[:10]
    ]
    projects = [
        {"name": p["name"], "hours": round(p["total_seconds"] / 3600, 2)}
        for p in (data.get("projects") or [])[:10]
    ]
    editors = [
        {"name": e["name"], "hours": round(e["total_seconds"] / 3600, 2)}
        for e in (data.get("editors") or [])[:5]
    ]

    return {
        "status": "ok",
        "total_coding": data.get("human_readable_total", "N/A"),
        "daily_average": data.get("human_readable_daily_average", "N/A"),
        "languages": languages,
        "projects": projects,
        "editors": editors,
    }


def fetch_timing(start: date, end: date) -> dict:
    # Use AppleScript to get time summary
    script = f'''
    tell application "TimingHelper"
        set s to get time summary between date "{start.strftime("%B %d, %Y")}" and date "{(end + timedelta(days=1)).strftime("%B %d, %Y")}"
        set totalSecs to overall total of s
        set prodScore to productivity score of s
        return (totalSecs as text) & "|" & (prodScore as text)
    end tell
    '''
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return {"status": "error", "reason": result.stderr.strip()}

        parts = result.stdout.strip().split("|")
        total_secs = float(parts[0])
        prod_score = float(parts[1]) if len(parts) > 1 else None

        return {
            "status": "ok",
            "total_hours": round(total_secs / 3600, 2),
            "productivity_score": round(prod_score, 2) if prod_score is not None else None,
        }
    except FileNotFoundError:
        return {"status": "error", "reason": "osascript not found"}
    except subprocess.TimeoutExpired:
        return {"status": "error", "reason": "AppleScript timed out"}


def fetch_typing_stats(start: date, end: date) -> dict:
    path = Path(
        "~/Library/Mobile Documents/com~apple~CloudDocs/TypingStats/typing-stats.json"
    ).expanduser()
    if not path.exists():
        return {"status": "error", "reason": f"{path} not found"}

    with open(path) as f:
        data = json.load(f)

    daily: dict[str, int] = {}
    for device in data.get("devices", {}).values():
        for day_str, info in device.get("dailyCounts", {}).items():
            d = date.fromisoformat(day_str)
            if start <= d <= end:
                daily[day_str] = daily.get(day_str, 0) + info.get("count", 0)

    sorted_days = sorted(daily.items())
    total = sum(daily.values())

    return {
        "status": "ok",
        "total_keystrokes": total,
        "daily": [{"date": d, "keystrokes": c} for d, c in sorted_days],
    }


def fetch_whatpulse(start: date, end: date) -> dict:
    db = "~/Library/Application Support/WhatPulse/whatpulse.db"

    # Daily keystroke totals
    keys_by_day = query_sqlite(db,
        "SELECT day, SUM(count) FROM keypresses "
        "WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day",
        (str(start), str(end)),
    )

    # Daily click totals
    clicks_by_day = query_sqlite(db,
        "SELECT day, SUM(count) FROM mouseclicks "
        "WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day",
        (str(start), str(end)),
    )

    # Per-app breakdown
    per_app = query_sqlite(db,
        "SELECT COALESCE(a.name, i.path), SUM(i.keys), SUM(i.clicks) "
        "FROM input_per_application i "
        "LEFT JOIN applications a ON i.path = a.path "
        "WHERE i.day >= ? AND i.day <= ? "
        "GROUP BY COALESCE(a.name, i.path) "
        "ORDER BY SUM(i.keys) DESC LIMIT 15",
        (str(start), str(end)),
    )

    # Account totals from local API
    totals = api_get("http://localhost:3490/v1/account-totals")
    account = {}
    if isinstance(totals, dict) and "error" not in totals:
        account = {
            "all_time_keys": totals.get("Keys", ""),
            "all_time_clicks": totals.get("Clicks", ""),
        }

    total_keys = sum(r[1] for r in keys_by_day)
    total_clicks = sum(r[1] for r in clicks_by_day)

    return {
        "status": "ok",
        "total_keys": total_keys,
        "total_clicks": total_clicks,
        "daily": [{"date": r[0], "keys": r[1]} for r in keys_by_day],
        "top_apps": [
            {"app": r[0], "keys": r[1], "clicks": r[2]}
            for r in per_app
        ],
        "account_totals": account,
    }


def fetch_qbserve(start: date, end: date) -> dict:
    db = "~/Library/Application Support/Qbserve/UserDatabase.sqlite"

    # Figure out which monthly tables we need
    months = set()
    d = start
    while d <= end:
        months.add((d.year, d.month))
        d += timedelta(days=28)
    months.add((end.year, end.month))

    # Build UNION ALL across the relevant months
    start_ts = int(datetime.combine(start, datetime.min.time(),
                                     tzinfo=timezone.utc).timestamp())
    end_ts = int(datetime.combine(end + timedelta(days=1), datetime.min.time(),
                                   tzinfo=timezone.utc).timestamp())

    unions = []
    for y, m in sorted(months):
        table = f"z_HistoryLog_{y}_{m}"
        unions.append(
            f"SELECT activity_id, start_time, duration FROM [{table}] "
            f"WHERE start_time >= {start_ts} AND start_time < {end_ts}"
        )

    if not unions:
        return {"status": "error", "reason": "No history tables for date range"}

    history_sql = " UNION ALL ".join(unions)

    sql = f"""
        SELECT
            app.localized_name,
            c.name,
            c.productivity,
            SUM(h.duration)
        FROM ({history_sql}) h
        JOIN Activities a ON h.activity_id = a._id
        JOIN Apps app ON a.app_id = app._id
        JOIN Categories c ON a.category_id = c._id
        GROUP BY app.localized_name, c.name
        ORDER BY SUM(h.duration) DESC
        LIMIT 20
    """

    rows = query_sqlite(db, sql)
    if not rows:
        return {"status": "error", "reason": "No data in date range"}

    total_secs = sum(r[3] for r in rows)

    top_apps = []
    for name, category, productivity, secs in rows:
        top_apps.append({
            "app": name,
            "category": category,
            "productivity": productivity,
            "hours": round(secs / 3600, 2),
        })

    return {
        "status": "ok",
        "total_tracked_hours": round(total_secs / 3600, 2),
        "top_apps": top_apps,
    }


# ── Report Rendering ────────────────────────────────────────────────────

def render_table(headers: list[str], rows: list[list[str]], align: list[str] | None = None) -> str:
    """Render a Markdown table."""
    if not rows:
        return "_No data_\n"
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))

    if align is None:
        align = ["l"] * len(headers)

    def pad(s: str, w: int, a: str) -> str:
        return str(s).rjust(w) if a == "r" else str(s).ljust(w)

    sep = "|".join(
        ("---:" if a == "r" else ":---") .ljust(w + 2, "-")
        for w, a in zip(widths, align)
    )
    header_line = " | ".join(pad(h, w, a) for h, w, a in zip(headers, widths, align))
    lines = [f"| {header_line} |", f"|{sep}|"]
    for row in rows:
        cells = " | ".join(pad(c, w, a) for c, w, a in zip(row, widths, align))
        lines.append(f"| {cells} |")
    return "\n".join(lines) + "\n"


def render_markdown(data: dict, start: date, end: date) -> str:
    lines: list[str] = []

    lines.append(f"# Activity Report: {start} to {end}\n")
    lines.append(f"_Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}_\n")

    # ── WakaTime ──
    wk = data.get("wakatime", {})
    lines.append("## WakaTime (Coding Activity)\n")
    if wk.get("status") == "ok":
        lines.append(f"- **Total coding time:** {wk['total_coding']}")
        lines.append(f"- **Daily average:** {wk['daily_average']}\n")
        if wk.get("languages"):
            lines.append("**Languages:**\n")
            lines.append(render_table(
                ["Language", "Hours"],
                [[l["name"], str(l["hours"])] for l in wk["languages"]],
                align=["l", "r"],
            ))
        if wk.get("projects"):
            lines.append("**Projects:**\n")
            lines.append(render_table(
                ["Project", "Hours"],
                [[p["name"], str(p["hours"])] for p in wk["projects"]],
                align=["l", "r"],
            ))
        if wk.get("editors"):
            lines.append("**Editors:**\n")
            lines.append(render_table(
                ["Editor", "Hours"],
                [[e["name"], str(e["hours"])] for e in wk["editors"]],
                align=["l", "r"],
            ))
    else:
        lines.append(f"_Skipped: {wk.get('reason', 'unknown')}_\n")

    # ── ActivityWatch ──
    aw = data.get("activitywatch", {})
    lines.append("## ActivityWatch (App Usage)\n")
    if aw.get("status") == "ok" and aw.get("top_apps"):
        lines.append(render_table(
            ["Application", "Hours"],
            [[a["app"], str(a["hours"])] for a in aw["top_apps"]],
            align=["l", "r"],
        ))
    else:
        lines.append(f"_{aw.get('reason', 'No data')}_\n")

    # ── Qbserve ──
    qb = data.get("qbserve", {})
    lines.append("## Qbserve (Productivity Tracking)\n")
    if qb.get("status") == "ok":
        lines.append(f"- **Total tracked:** {qb['total_tracked_hours']}h\n")
        if qb.get("top_apps"):
            lines.append(render_table(
                ["Application", "Category", "Productivity", "Hours"],
                [[a["app"], a["category"], a["productivity"], str(a["hours"])]
                 for a in qb["top_apps"]],
                align=["l", "l", "l", "r"],
            ))
    else:
        lines.append(f"_{qb.get('reason', 'No data')}_\n")

    # ── RescueTime ──
    rt = data.get("rescuetime", {})
    lines.append("## RescueTime\n")
    if rt.get("status") == "ok":
        if rt.get("daily"):
            lines.append("**Daily Summary:**\n")
            lines.append(render_table(
                ["Date", "Hours", "Productivity Pulse", "Top Category"],
                [[d["date"], str(round(d["productive_hours"], 1)),
                  str(d["productivity_pulse"]), d["top_category"]]
                 for d in rt["daily"]],
                align=["l", "r", "r", "l"],
            ))
        if rt.get("top_categories"):
            lines.append("**Top Categories:**\n")
            lines.append(render_table(
                ["Category", "Hours", "Productivity"],
                [[c["category"], str(c["hours"]), str(c["productivity"])]
                 for c in rt["top_categories"]],
                align=["l", "r", "r"],
            ))
    else:
        lines.append(f"_Skipped: {rt.get('reason', 'unknown')}_\n")

    # ── Timing.app ──
    tm = data.get("timing", {})
    lines.append("## Timing.app\n")
    if tm.get("status") == "ok":
        lines.append(f"- **Total tracked:** {tm['total_hours']}h")
        if tm.get("productivity_score") is not None:
            lines.append(f"- **Productivity score:** {tm['productivity_score']}")
        lines.append("")
    else:
        lines.append(f"_{tm.get('reason', 'No data')}_\n")

    # ── Input Stats ──
    lines.append("## Input Stats\n")

    # Typing Stats
    ts = data.get("typing_stats", {})
    if ts.get("status") == "ok":
        lines.append(f"### Typing Stats\n")
        lines.append(f"- **Total keystrokes:** {fmt_number(ts['total_keystrokes'])}\n")
        if ts.get("daily"):
            lines.append(render_table(
                ["Date", "Keystrokes"],
                [[d["date"], fmt_number(d["keystrokes"])] for d in ts["daily"]],
                align=["l", "r"],
            ))

    # WhatPulse
    wp = data.get("whatpulse", {})
    if wp.get("status") == "ok":
        lines.append(f"### WhatPulse\n")
        lines.append(f"- **Week keys:** {fmt_number(wp['total_keys'])}")
        lines.append(f"- **Week clicks:** {fmt_number(wp['total_clicks'])}")
        if wp.get("account_totals"):
            at = wp["account_totals"]
            lines.append(f"- **All-time keys:** {at.get('all_time_keys', 'N/A')}")
            lines.append(f"- **All-time clicks:** {at.get('all_time_clicks', 'N/A')}")
        lines.append("")
        if wp.get("top_apps"):
            lines.append("**Input by Application:**\n")
            lines.append(render_table(
                ["Application", "Keys", "Clicks"],
                [[a["app"], fmt_number(a["keys"]), fmt_number(a["clicks"])]
                 for a in wp["top_apps"]],
                align=["l", "r", "r"],
            ))
        if wp.get("daily"):
            lines.append("**Daily Keys (WhatPulse):**\n")
            lines.append(render_table(
                ["Date", "Keystrokes"],
                [[d["date"], fmt_number(d["keys"])] for d in wp["daily"]],
                align=["l", "r"],
            ))

    return "\n".join(lines)


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate weekly activity report")
    parser.add_argument("--days", type=int, default=7, help="Number of days to look back (default: 7)")
    parser.add_argument("--output", "-o", type=str, help="Output file (default: stdout)")
    args = parser.parse_args()

    end = date.today()
    start = end - timedelta(days=args.days)

    print(f"Collecting data from {start} to {end}...", file=sys.stderr)

    data = {}

    # Fetch from all sources
    sources = [
        ("rescuetime", "RescueTime", fetch_rescuetime),
        ("activitywatch", "ActivityWatch", fetch_activitywatch),
        ("wakatime", "WakaTime", fetch_wakatime),
        ("timing", "Timing.app", fetch_timing),
        ("typing_stats", "Typing Stats", fetch_typing_stats),
        ("whatpulse", "WhatPulse", fetch_whatpulse),
        ("qbserve", "Qbserve", fetch_qbserve),
    ]

    for key, label, fn in sources:
        print(f"  Fetching {label}...", file=sys.stderr)
        try:
            data[key] = fn(start, end)
        except Exception as e:
            data[key] = {"status": "error", "reason": str(e)}
        status = data[key].get("status", "unknown")
        print(f"    → {status}", file=sys.stderr)

    report = render_markdown(data, start, end)

    if args.output:
        Path(args.output).write_text(report)
        print(f"\nReport written to {args.output}", file=sys.stderr)
    else:
        print(report)


if __name__ == "__main__":
    main()

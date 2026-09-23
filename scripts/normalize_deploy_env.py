#!/usr/bin/env python3
"""Normalize a Jenkins/VPS .env file for Docker Compose and bash source."""

from __future__ import annotations

import re
import sys
from pathlib import Path

SPECIAL = re.compile(r"""[\s#"'$\\]""")


def parse_env(text: str) -> list[tuple[str, str] | str]:
    rows: list[tuple[str, str] | str] = []
    for raw in text.splitlines():
        line = raw.strip("\ufeff")
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            rows.append(raw.rstrip("\n"))
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in {"'", '"'}:
            val = val[1:-1]
        rows.append((key, val))
    return rows


def env_map(rows: list[tuple[str, str] | str]) -> dict[str, str]:
    data: dict[str, str] = {}
    for row in rows:
        if isinstance(row, tuple):
            data[row[0]] = row[1]
    return data


def quote(val: str) -> str:
    if not val or SPECIAL.search(val):
        return "'" + val.replace("'", "'\\''") + "'"
    return val


def format_rows(rows: list[tuple[str, str] | str]) -> str:
    lines: list[str] = []
    for row in rows:
        if isinstance(row, str):
            lines.append(row)
        else:
            lines.append(f"{row[0]}={quote(row[1])}")
    return "\n".join(lines) + "\n"


def upsert(rows: list[tuple[str, str] | str], key: str, value: str) -> list[tuple[str, str] | str]:
    found = False
    out: list[tuple[str, str] | str] = []
    for row in rows:
        if isinstance(row, tuple) and row[0] == key:
            out.append((key, value))
            found = True
        else:
            out.append(row)
    if not found:
        out.append((key, value))
    return out


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--"]
    path = Path(".env.deploy")
    i = 0
    while i < len(args):
        if not args[i].startswith("-"):
            path = Path(args[i])
        i += 1

    text = path.read_bytes().decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    rows = parse_env(text)
    data = env_map(rows)

    rows = upsert(rows, "PORT", data.get("PORT") or "3123")
    rows = upsert(rows, "DEV", "false")
    rows = upsert(rows, "DOCKER", "true")
    rows = upsert(rows, "CONCURRENCY", data.get("CONCURRENCY") or "1")
    rows = upsert(rows, "DATA_DIR_PATH", data.get("DATA_DIR_PATH") or "/app/data")
    path.write_text(format_rows(rows), encoding="utf-8")

    data = env_map(parse_env(path.read_text(encoding="utf-8")))
    print("=== .env key check (values hidden) ===")
    pexels = bool((data.get("PEXELS_API_KEY") or "").strip())
    print(f"PEXELS_API_KEY={'SET' if pexels else 'MISSING'}")
    print(f"PIXABAY_API_KEY={'SET' if (data.get('PIXABAY_API_KEY') or '').strip() else 'empty'}")
    print(f"GEMINI_API_KEY={'SET' if (data.get('GEMINI_API_KEY') or '').strip() else 'empty'}")
    if not pexels:
        print("ERROR: PEXELS_API_KEY is required.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path

REPO = os.getenv("GITHUB_REPOSITORY", "safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-")
TOKEN = os.getenv("GITHUB_TOKEN", "")


def level_for_stars(stars: int) -> str:
    if stars >= 1000:
        return "🌌 Breakout Community"
    if stars >= 250:
        return "🚀 Strong Community"
    if stars >= 100:
        return "🔥 Growing Community"
    if stars >= 25:
        return "✨ Early Momentum"
    return "🌱 New signal"


def fetch_stars(repo: str) -> int:
    url = f"https://api.github.com/repos/{repo}"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    with urllib.request.urlopen(req, timeout=30) as res:
        payload = json.loads(res.read().decode("utf-8"))
    return int(payload.get("stargazers_count", 0))


def write_json(stars: int, level: str) -> None:
    out = Path("assets/community.json")
    out.write_text(json.dumps({"stars": stars, "level": level}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_readme(stars: int, level: str) -> None:
    path = Path("README.md")
    content = path.read_text(encoding="utf-8")
    replacement = (
        "<!-- community-interest:start -->\n"
        "### 🌟 Community Interest\n\n"
        "![Stars](https://img.shields.io/github/stars/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-?style=for-the-badge)\n\n"
        f"> Current interest: {stars} stars → {level} 🚀  \n"
        "> Want to join? [Click here](https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/stargazers) to show support!\n"
        "<!-- community-interest:end -->"
    )

    pattern = r"<!-- community-interest:start -->[\s\S]*?<!-- community-interest:end -->"
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
    else:
        insertion = "![LTP replay demo](assets/replay-demo.gif)\n\n" + replacement + "\n"
        content = content.replace("![LTP replay demo](assets/replay-demo.gif)\n", insertion)

    path.write_text(content, encoding="utf-8")


def main() -> None:
    stars = fetch_stars(REPO)
    level = level_for_stars(stars)
    write_json(stars, level)
    update_readme(stars, level)
    print(f"Updated community interest for {REPO}: {stars} stars ({level})")


if __name__ == "__main__":
    main()

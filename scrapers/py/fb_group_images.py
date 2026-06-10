"""Fetch image URLs from the Kantyna STAPO Facebook group via facebook-scraper.

Reads FB_COOKIES from env (JSON array or Netscape format, same as kantyna.js).
Prints JSON to stdout: {"images": [{"url": "...", "date": "ISO-or-null"}]}
sorted newest post first. Exits 1 with a message on stderr on failure.
"""

import json
import os
import sys

from facebook_scraper import get_posts
from requests.cookies import RequestsCookieJar

GROUP_ID = "1396911425536833"
MAX_IMAGES = 10


def build_cookie_jar(raw):
    jar = RequestsCookieJar()
    raw = raw.strip()
    if raw.startswith("[") or raw.startswith("{"):
        parsed = json.loads(raw)
        cookies = parsed if isinstance(parsed, list) else [parsed]
        for c in cookies:
            if c.get("name") and c.get("value"):
                jar.set(
                    c["name"],
                    c["value"],
                    domain=c.get("domain", ".facebook.com"),
                    path=c.get("path", "/"),
                )
    else:
        for line in raw.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 7:
                continue
            jar.set(parts[5], parts[6].strip(), domain=parts[0], path=parts[2])
    return jar


def main():
    cookies = None
    raw = os.environ.get("FB_COOKIES", "").strip()
    if raw:
        cookies = build_cookie_jar(raw)
        print(f"Loaded {len(cookies)} cookies from FB_COOKIES", file=sys.stderr)

    images = []
    for post in get_posts(
        group=GROUP_ID,
        cookies=cookies,
        pages=3,
        options={"allow_extra_requests": False},
    ):
        date = post.get("time")
        date_iso = date.isoformat() if date else None
        urls = post.get("images") or ([post["image"]] if post.get("image") else [])
        for url in urls:
            images.append({"url": url, "date": date_iso})
            if len(images) >= MAX_IMAGES:
                break
        if len(images) >= MAX_IMAGES:
            break

    if not images:
        print("No post images found in group feed", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({"images": images}))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(f"{type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)

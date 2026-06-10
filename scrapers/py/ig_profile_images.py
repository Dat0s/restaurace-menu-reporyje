"""Fetch image URLs from the @svoboda_reznictvi Instagram profile via instaloader.

Reads IG_COOKIES from env (JSON array or Netscape format, same as svoboda.js).
Prints JSON to stdout: {"images": [{"url": "...", "date": "ISO-or-null"}]}
sorted newest post first. Exits 1 with a message on stderr on failure.
"""

import json
import os
import sys
from itertools import islice

import instaloader

PROFILE = "svoboda_reznictvi"
MAX_POSTS = 6
MAX_IMAGES = 10


def parse_cookies(raw):
    raw = raw.strip()
    cookies = {}
    if raw.startswith("[") or raw.startswith("{"):
        parsed = json.loads(raw)
        items = parsed if isinstance(parsed, list) else [parsed]
        for c in items:
            if c.get("name") and c.get("value"):
                cookies[c["name"]] = c["value"]
    else:
        for line in raw.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) >= 7:
                cookies[parts[5]] = parts[6].strip()
    return cookies


def main():
    loader = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )

    raw = os.environ.get("IG_COOKIES", "").strip()
    if raw:
        cookies = parse_cookies(raw)
        if "sessionid" in cookies:
            session_keys = ("sessionid", "csrftoken", "ds_user_id", "mid", "ig_did")
            session = {k: cookies[k] for k in session_keys if k in cookies}
            loader.load_session(os.environ.get("IG_USERNAME", "scraper"), session)
            print("Loaded IG session from IG_COOKIES", file=sys.stderr)

    profile = instaloader.Profile.from_username(loader.context, PROFILE)

    images = []
    for post in islice(profile.get_posts(), MAX_POSTS):
        date_iso = post.date_utc.isoformat() if post.date_utc else None
        if post.typename == "GraphSidecar":
            urls = [n.display_url for n in post.get_sidecar_nodes()]
        else:
            urls = [post.url]
        for url in urls:
            if not url:
                continue
            images.append({"url": url, "date": date_iso})
            if len(images) >= MAX_IMAGES:
                break
        if len(images) >= MAX_IMAGES:
            break

    if not images:
        print("No post images found on profile", file=sys.stderr)
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

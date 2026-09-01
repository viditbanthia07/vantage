"""Capture the marketing site's data from real API responses.

The site's charts, twin and "unavailable" quotations are not written by hand.
Each is a JSON file dumped from an actual `DashboardApi` answering an actual
route against an actual store, so the page cannot drift from the product and
cannot show a reading that no run produced.

    python tools/capture_data.py --db vantage.db --out site/src/captured

The directory is `captured/` rather than `data/` for a dull but real reason: the
repository's `.gitignore` excludes `data/` anywhere in the tree - it is where a
run writes its local artefacts - so a folder of that name under `site/src`
staged as nothing at all, silently, with `git add` reporting success. The name
also says what the files are.

Two passes, because the two things the page needs come from two different kinds
of run:

**History.** `analytics`, `events`, `stats` and the relationship graph are
answered from a store on disk with no pipeline attached. That is
exactly `vantage dashboard`, and it is also where the honest refusals live: with
no live feed, `/api/live` says so in words, and those words are what beat 5
quotes.

**Facility.** The twin and the scene graph need cameras running, so this starts a
real short `vantage facility` over the sample clips, waits for its tracks to
confirm, and reads its dashboard over HTTP. What it captures is geometry and
anonymous positions; see `FACILITY_CAMERAS` for why that distinction is the one
that decides what may go on a public page.

Nothing here invents a field. If a route reports `available: false`, that
response is captured as it stands - the page then shows a system declining to
answer, which is the thing the page is about.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from vantage.dashboard.api import DashboardApi

HISTORY_ROUTES = (
    "stats",
    "analytics",
    "events",
    "relationships",
    "relationships/graph",
    "incidents",
    "live",
    "twin",
)
"""Answered from a store alone.

`live` and `twin` are in the list precisely because they will refuse: a history
dashboard has no feed and no facility model, and the refusals are content.
"""

FACILITY_ROUTES = ("twin", "scene", "stats", "live")
"""Answered by a running facility, where those have something to say.

`entities` and `radar` are deliberately absent. Both answer truthfully and both
are redundant here - the twin already carries every entity position and trail the
page draws - and `entities` alone is 248 kB of recent-activity history that
nothing renders. Capturing data the site does not use is how a captured payload
quietly stops matching the code that reads it.
"""

FACILITY_CAMERAS = (
    "north=samples/station.webm",
    "west=samples/square.webm",
    "yard=samples/underpass.webm",
)
"""Three cameras, fed from the real street clips.

A deliberate distinction, and the one that decides what may appear on a public
page. **No pixel of this footage reaches the site.** The twin has never held an
image: it holds a floor plan, camera mounts with their real yaw and field of
view, and anonymous entity positions - `person_17` at 4.2m by 11.8m, with a
trail behind it. Feeding it real footage changes only whether those positions
are of real walking people or of bouncing circles, and the synthetic circles the
detector barely sees produce an empty building.

So the twin is captured from real footage and the *stills and video* are not.
That split is the project's own privacy stance drawn as a picture: identity is
never derived, imagery is never republished, and what is left is a dot in a room
that says somebody was there for eleven seconds.

The Theora `street.ogv` is deliberately not among them: its decoder reports "Not
all references are available" and the facility never comes up.

The clips are Creative Commons files from Wikimedia Commons, listed in the
README, and are not in the repository. With them absent this pass fails loudly
rather than substituting something else.
"""


def dump(payload: Any, path: Path, note: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    size = path.stat().st_size
    flag = ""
    if isinstance(payload, dict) and payload.get("available") is False:
        flag = f"  (unavailable: {payload.get('reason', 'no reason given')})"
    print(f"  {note}: {path.name} ({size / 1e3:.1f} kB){flag}")


def capture_history(db: Path, out: Path, params: dict[str, dict[str, str]]) -> None:
    """Every route a store alone can answer, plus the two it cannot."""
    from vantage.storage.sqlite_store import SqliteStore

    # Read-only: this is the user's real history, and a capture script has no
    # business migrating or writing to it.
    store = SqliteStore(str(db), read_only=True)
    try:
        api = DashboardApi(store=store)
        for route in HISTORY_ROUTES:
            name = route.replace("/", "-")
            try:
                payload = api.handle(route, params.get(route, {}))
            # Reported with its type and message, never swallowed.
            except Exception as error:
                print(f"  {route}: FAILED - {type(error).__name__}: {error}")
                continue
            dump(payload, out / f"history-{name}.json", route)
    finally:
        store.close()


def capture_refusals(db: Path, out: Path) -> None:
    """Every way the API says it does not know, collected by making it say them.

    Beat 5 of the page is this list, and it is the beat that has to be captured
    rather than written. A hand-typed quotation is a claim about what the system
    says; this is a recording of it saying so. Two shapes produce the whole
    vocabulary:

    - **no store at all**, which is `vantage run` with storage off, and
    - **a store with nothing relevant in it**, which is a fresh install.

    Each refusal keeps the route that produced it and which of the two produced
    it, because "there is no such thing here" and "there is nothing in it yet"
    are different sentences and the page should not blur them.
    """
    from vantage.storage.sqlite_store import SqliteStore

    empty = Path(tempfile.gettempdir()) / "vantage-refusal-capture.db"
    for suffix in ("", "-wal", "-shm"):
        Path(str(empty) + suffix).unlink(missing_ok=True)

    refusals: list[dict[str, str]] = []
    seen: set[str] = set()

    def collect(api: DashboardApi, condition: str) -> None:
        for route in sorted({*HISTORY_ROUTES, *FACILITY_ROUTES, "search", "cameras", "scene"}):
            try:
                payload = api.handle(route, {"q": "", "since": "24h"})
            # A raise is a broken route, not a refusal, and not content for the page.
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue
            for key, reason_key in (
                ("available", "reason"),
                ("anomalies_available", "anomalies_reason"),
            ):
                if payload.get(key) is not False:
                    continue
                reason = payload.get(reason_key)
                if not isinstance(reason, str) or reason in seen:
                    continue
                seen.add(reason)
                refusals.append(
                    {"route": f"/api/{route}", "condition": condition, "reason": reason}
                )

    collect(DashboardApi(store=None), "no store attached")
    store = SqliteStore(str(empty))
    try:
        collect(DashboardApi(store=store), "a store with nothing in it yet")
    finally:
        store.close()
        for suffix in ("", "-wal", "-shm"):
            Path(str(empty) + suffix).unlink(missing_ok=True)

    # The two the real captures already produced, so beat 5 quotes one list.
    for name in ("history-live", "history-twin", "history-analytics"):
        path = out / f"{name}.json"
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        for key, reason_key in (
            ("available", "reason"),
            ("anomalies_available", "anomalies_reason"),
        ):
            reason = payload.get(reason_key)
            if payload.get(key) is False and isinstance(reason, str) and reason not in seen:
                seen.add(reason)
                route = "/api/" + name.split("-", 1)[1]
                refusals.append(
                    {"route": route, "condition": "a real history store", "reason": reason}
                )

    if not refusals:
        raise ValueError("no route refused anything; beat 5 would be empty")
    dump({"refusals": refusals}, out / "refusals.json", f"{len(refusals)} refusals")


LIMITATIONS_HEADING = "## 8. Known limitations"


def capture_limitations(readme: Path, out: Path) -> None:
    """The README's Known Limitations section, extracted rather than retyped.

    Beat 6 of the page is the eleven things Vantage gets wrong, and it is the
    beat most likely to quietly fall behind the truth - a limitation gets fixed,
    the README loses it, and the marketing page keeps confessing to a bug that
    no longer exists, or worse, keeps omitting one that does. Parsing the
    section makes that impossible: the page cannot claim a limitation the README
    does not, and cannot drop one it does.

    Each entry is the paragraph as written, markdown and all, rather than a
    title and a body. Splitting on the closing `**` was the obvious shape and is
    wrong: several of these paragraphs put the emphasis on a clause rather than a
    sentence - "**Transitions are reported late** by up to `state.min_state_s`" -
    so a title/body split produces a heading that is not a sentence and a body
    that begins mid-clause. The page renders the inline markdown instead, which
    is both correct for every entry and identical to how the README reads.
    """
    text = readme.read_text(encoding="utf-8")
    start = text.index(LIMITATIONS_HEADING) + len(LIMITATIONS_HEADING)
    end = text.index("\n## ", start)
    section = text[start:end].strip()

    entries: list[dict[str, str]] = []
    for block in section.split("\n\n"):
        paragraph = " ".join(line.strip() for line in block.strip().splitlines())
        if not paragraph.startswith("**"):
            continue
        # The lead phrase, for anchors and for the screen-reader summary. It is
        # never rendered on its own.
        lead = paragraph[2:].partition("**")[0].strip()
        entries.append({"lead": lead, "markdown": paragraph})

    if not entries:
        raise ValueError(
            f"{readme} has a {LIMITATIONS_HEADING!r} section but no bolded entries "
            "in it; the page's limits beat would be empty"
        )
    dump(
        {"source": f"{readme.name} {LIMITATIONS_HEADING.strip('# ')}", "entries": entries},
        out / "limitations.json",
        f"{len(entries)} limitations",
    )


def wait_for(url: str, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(0.5)
    return False


def capture_facility(out: Path, port: int, settle: float) -> None:
    """A real short facility run, read over HTTP the way a browser would."""
    # A temporary directory, not the source tree. The first version wrote this
    # beside the captured JSON, where a locked -wal file on Windows outlived the
    # run and had to be gitignored; a scratch database is not part of the repo.
    scratch = Path(tempfile.gettempdir())
    db = scratch / "vantage-facility-capture.db"
    db.unlink(missing_ok=True)
    command = [
        sys.executable,
        "-m",
        "vantage",
        "facility",
        "--cameras",
        *FACILITY_CAMERAS,
        "--port",
        str(port),
        "--db",
        str(db),
        "--no-pose",
    ]
    missing = [
        pair.split("=", 1)[1]
        for pair in FACILITY_CAMERAS
        if not Path(pair.split("=", 1)[1]).is_file()
    ]
    if missing:
        raise FileNotFoundError(
            "the facility capture needs the sample clips, and these are absent: "
            + ", ".join(missing)
            + ". They are Creative Commons downloads named in the README. Pass "
            "--skip-facility to capture the history routes alone."
        )
    print(f"  starting: {' '.join(command[3:8])} ...")
    # stderr to a file, not a pipe. ffmpeg is voluble about these clips - a few
    # hundred "Not all references are available" lines per minute - and an
    # undrained 64 kB pipe blocks the child mid-write, which looks exactly like
    # a dashboard that never starts. It cost an hour to find once.
    log = scratch / "vantage-facility-capture.log"
    try:
        base = f"http://127.0.0.1:{port}"
        with log.open("w", encoding="utf-8", errors="replace") as stream:
            process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=stream)
        if not wait_for(f"{base}/api/stats", timeout=90):
            tail = log.read_text(encoding="utf-8", errors="replace")[-1200:]
            raise RuntimeError(
                f"the facility dashboard never came up on {port}. Its log ends:\n\n{tail}"
            )

        # Long enough for tracks to confirm and for the twin to have entities in
        # it. A twin captured at second one is an empty building, which is a real
        # answer but not the one the beat is about.
        print(f"  up; letting it run for {settle:.0f}s so tracks confirm")
        time.sleep(settle)

        for route in FACILITY_ROUTES:
            with urllib.request.urlopen(f"{base}/api/{route}", timeout=10) as response:
                payload = json.loads(response.read())
            dump(payload, out / f"facility-{route.replace('/', '-')}.json", route)
    finally:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
        # Windows keeps the file handle for a moment after the child exits, so
        # this retries rather than failing the capture over a temporary file.
        for path in (db, Path(str(db) + "-wal"), Path(str(db) + "-shm")):
            for attempt in range(10):
                try:
                    path.unlink(missing_ok=True)
                    break
                except PermissionError:
                    if attempt == 9:
                        print(f"  left behind: {path} (still locked)")
                    time.sleep(0.5)
        log.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="vantage.db", help="the store to read history from")
    parser.add_argument("--out", default="site/src/captured")
    parser.add_argument("--port", type=int, default=8807, help="port for the capture facility")
    parser.add_argument("--settle", type=float, default=25.0, help="seconds to let it run")
    parser.add_argument("--readme", default="README.md")
    parser.add_argument("--skip-facility", action="store_true")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    db = Path(args.db)
    if not db.is_file():
        print(f"no store at {db}; run `vantage run --source synthetic://` first")
        return 1

    # Facility first, and the order is load-bearing rather than stylistic. The
    # history pass builds a `DashboardApi`, which imports the camera discovery
    # and connector services; once this process has done that, the facility it
    # spawns opens all three clips through ffmpeg and then reads no frames from
    # any of them - "opened via ffmpeg but delivered no frames", every time.
    # Spawned first, from a process that has touched none of that, it works
    # every time. The interaction is not understood, and the ordering is a
    # workaround rather than a fix; it is recorded here so the next person does
    # not spend the hour again reordering it back.
    if not args.skip_facility:
        print("facility, from a real three-camera run:")
        capture_facility(out, args.port, args.settle)
        print()

    print(f"history, from {db}:")
    capture_history(
        db,
        out,
        params={
            # A window wide enough that the chart has something to show and
            # narrow enough that the gaps in it are still visible as gaps.
            "analytics": {"since": "7d", "interval": "1h", "metric": "entities"},
            "events": {"limit": "40"},
        },
    )

    print("\nrefusals, by asking questions nothing can answer:")
    capture_refusals(db, out)

    print("\nlimitations, from the README:")
    capture_limitations(Path(args.readme), out)

    total = sum(path.stat().st_size for path in out.glob("*.json"))
    print(f"\n{out}: {total / 1e3:.0f} kB of captured responses")
    return 0


if __name__ == "__main__":
    sys.exit(main())

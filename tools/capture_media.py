"""Capture the marketing site's footage from a real run of the pipeline.

Everything the site shows has to come from here. That is the whole constraint the
site is built under - a page about a system that refuses to fabricate its
readings cannot fabricate its own screenshots - so the media is generated rather
than art-directed, and this script is how it is reproduced.

    python tools/capture_media.py --out site/public/media

Two artefacts:

**A stacked hero clip.** The same frames twice in one file: analysed on top, raw
underneath. Stacked rather than written as two files because the hero shader
scrubs a boundary between them, and two `<video>` elements drift apart within
seconds however carefully they are started. One texture cannot desynchronise
from itself.

**A layer sequence.** The same single frame with detection, then tracking, then
pose, then activity drawn on it - the page's second beat, which is the claim
that detection is not understanding. Each layer is a real render of that stage's
real output, not an illustration of one.

Both come from the synthetic source and only from it. See `HERO_SOURCE` for why
the far better-looking option was removed rather than shipped.

OpenCV writes the intermediate; ffmpeg makes it web-grade. OpenCV's VP9 writer
ignores `VIDEOWRITER_PROP_QUALITY` - measured, three settings produced
byte-identical 6 MB files - so the clip is captured once at near-lossless
quality and encoded properly afterwards. ffmpeg is taken from PATH or, failing
that, from the `imageio-ffmpeg` wheel: a capture-time dependency, not one the
platform ships.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

from vantage.app import (
    _build_activity_engine,
    _build_engine,
    _build_pose_engine,
    _build_spatial_engine,
    _build_state_estimator,
)
from vantage.config.schema import (
    ActivityConfig,
    DashboardConfig,
    DetectionConfig,
    DisplayConfig,
    IngestConfig,
    PoseConfig,
    SourceConfig,
    SpatialConfig,
    StateConfig,
    TrackingConfig,
    VantageConfig,
)
from vantage.core.errors import SourceExhausted
from vantage.ingestion.registry import create_source
from vantage.tracking.factory import build_tracker
from vantage.viz.overlay import (
    draw_activities,
    draw_detections,
    draw_poses,
    draw_relations,
    draw_tracks,
)

HERO_SOURCE = "synthetic://?width=960&height=540&fps=30&frames=100000&objects=4"
"""The synthetic source, and the only source this script will publish.

An earlier version of this file also rendered a layer sequence from
`samples/station.webm`, which is a far better picture: real people, dense boxes,
a plausible marketing shot. It was removed, and the removal is the most
important decision in this file.

Two reasons, either of which is sufficient. The sample clips are Creative
Commons files whose attribution this repository never recorded - the licences
require crediting the author and the repository cannot, so republishing them
would be a licence breach rather than an oversight. And they show identifiable
members of the public who did not agree to appear on a marketing page for a
video analytics system, which is the exact thing the page argues against.

So the page gets the source that is ours, reproducible by anyone in one command,
and unflattering: four circles, one of which the detector calls a sports ball.
That is a weaker picture and a stronger claim, and the page says so.

The twin is the deliberate exception, and it is not one. `tools/capture_data.py`
does drive a facility from those clips, because the twin holds a floor plan and
anonymous positions and has never held an image. No pixel of that footage
reaches the site from either script.
"""

MAX_STILL_WIDTH = 1280
"""Five full-resolution stills is a large share of the page's weight budget.

1280 is wider than any column they are shown in at any breakpoint, so the cap
costs nothing visible.
"""


def find_ffmpeg() -> str | None:
    """ffmpeg on PATH, else the one `imageio-ffmpeg` bundles, else nothing."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
    except ImportError:
        return None
    return imageio_ffmpeg.get_ffmpeg_exe()


def encode(ffmpeg: str, source: Path, out: Path) -> list[Path]:
    """The intermediate, encoded for the web: VP9, an H.264 fallback, a poster.

    CRF 34 is a measurement rather than a default: on this clip 34/40/46 give
    0.81/0.59/0.41 MB, and 34 is the last one where the thin overlay strokes - a
    two-pixel track box, a pose skeleton - survive without ringing. Those strokes
    are the entire point of the shot.
    """
    targets = [
        (
            out / "hero.webm",
            ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-an"],
        ),
        # For Safari before 14.1 and anything else without VP9 in WebM.
        (
            out / "hero.mp4",
            [
                "-c:v",
                "libx264",
                "-crf",
                "30",
                "-preset",
                "slow",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                "-an",
            ],
        ),
        # The poster is frame one, so the swap from image to video is invisible.
        (out / "hero-poster.jpg", ["-frames:v", "1", "-q:v", "4"]),
    ]

    written: list[Path] = []
    for target, flags in targets:
        result = subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", str(source), *flags, str(target)],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not target.is_file():
            print(f"  encode FAILED for {target.name}: {result.stderr.strip()[:200]}")
            continue
        size = target.stat().st_size
        unit = f"{size / 1e6:.2f} MB" if size > 1e5 else f"{size / 1e3:.0f} kB"
        print(f"  encoded: {target.name} ({unit})")
        written.append(target)
    return written


def build(config: VantageConfig):
    """The analysis chain, assembled the way the app assembles it."""
    return (
        _build_engine(config),
        build_tracker(config.tracking),
        _build_state_estimator(config),
        _build_pose_engine(config),
        _build_activity_engine(config),
        _build_spatial_engine(config),
    )


def analysis_config(uri: str, frames: int) -> VantageConfig:
    return VantageConfig(
        source=SourceConfig(uri=uri, id="capture"),
        ingest=IngestConfig(max_frames=frames),
        detection=DetectionConfig(enabled=True, model="yolox-tiny"),
        tracking=TrackingConfig(enabled=True),
        state=StateConfig(enabled=True),
        pose=PoseConfig(enabled=True),
        activity=ActivityConfig(enabled=True),
        spatial=SpatialConfig(enabled=True),
        display=DisplayConfig(enabled=False),
        dashboard=DashboardConfig(enabled=False),
    )


def fit(image: np.ndarray, max_width: int) -> np.ndarray:
    height, width = image.shape[:2]
    if width <= max_width:
        return image
    scale = max_width / width
    return cv2.resize(image, (max_width, round(height * scale)), interpolation=cv2.INTER_AREA)


def annotate(
    image: np.ndarray, detection, tracking, state, pose, activity, spatial
) -> np.ndarray:
    """Every overlay the console draws, in the order the console draws them."""
    frame = image.copy()
    if spatial is not None and tracking is not None:
        frame = draw_relations(frame, spatial, tracking)
    if tracking is not None:
        frame = draw_tracks(frame, tracking)
    elif detection is not None:
        frame = draw_detections(frame, detection)
    if pose is not None:
        frame = draw_poses(frame, pose, min_confidence=0.3)
    if activity is not None and tracking is not None:
        frame = draw_activities(frame, activity, tracking)
    return frame


def capture_hero(out: Path, seconds: float, warmup: int) -> Path:
    """The stacked analysed-over-raw clip, as a near-lossless intermediate."""
    frames = int(seconds * 30) + warmup
    config = analysis_config(HERO_SOURCE, frames)
    detector, tracker, estimator, poser, activities, spatial = build(config)
    source = create_source(config.source)

    target = out / "hero.intermediate.avi"
    writer: cv2.VideoWriter | None = None
    written = 0

    with source:
        for index in range(frames):
            try:
                frame = source.read()
            except SourceExhausted:
                break
            if frame is None:
                break

            detection = detector.detect(frame)
            tracking = tracker.update(detection, frame=frame)
            state = estimator.update(tracking)
            pose = poser.estimate(frame, tracking)
            activity = activities.update(state, pose)
            scene = spatial.update(tracking, pose, state) if spatial else None

            # The first seconds are the tracker earning its confirmations. A hero
            # that opens on unconfirmed dashed boxes is showing the system at its
            # least certain, which is honest but is not what the shot is about.
            if index < warmup:
                continue

            analysed = annotate(frame.image, detection, tracking, state, pose, activity, scene)
            stacked = np.vstack([analysed, frame.image])

            if writer is None:
                height, width = stacked.shape[:2]
                # MJPEG, thrown away after the ffmpeg pass. Encoding twice at
                # delivery quality would put compression artefacts through a
                # second encoder, and the overlays are exactly the
                # high-frequency detail that survives that worst.
                writer = cv2.VideoWriter(
                    str(target), cv2.VideoWriter.fourcc(*"MJPG"), 30.0, (width, height)
                )
                if not writer.isOpened():
                    raise RuntimeError(f"OpenCV would not open a writer for {target}")
            writer.write(stacked)
            written += 1

    if writer is not None:
        writer.release()
    detector.close()
    poser.close()
    print(f"  hero: {written} frames -> {target.name} ({target.stat().st_size / 1e6:.1f} MB)")
    return target


def capture_layers(out: Path, uri: str, at_frame: int, prefix: str) -> None:
    """One frame, drawn five times, adding a stage each pass."""
    config = analysis_config(uri, at_frame + 1)
    detector, tracker, estimator, poser, activities, spatial = build(config)
    source = create_source(config.source)

    with source:
        for index in range(at_frame + 1):
            try:
                frame = source.read()
            except SourceExhausted:
                break
            if frame is None:
                break
            detection = detector.detect(frame)
            tracking = tracker.update(detection, frame=frame)
            state = estimator.update(tracking)
            pose = poser.estimate(frame, tracking)
            activity = activities.update(state, pose)
            scene = spatial.update(tracking, pose, state) if spatial else None
            if index != at_frame:
                continue

            layers = {
                "0-raw": frame.image.copy(),
                "1-detection": draw_detections(frame.image.copy(), detection),
                "2-tracking": draw_tracks(frame.image.copy(), tracking),
                "3-pose": draw_poses(
                    draw_tracks(frame.image.copy(), tracking), pose, min_confidence=0.3
                ),
                "4-activity": annotate(
                    frame.image, detection, tracking, state, pose, activity, scene
                ),
            }
            for name, image in layers.items():
                path = out / f"{prefix}-{name}.jpg"
                cv2.imwrite(
                    str(path), fit(image, MAX_STILL_WIDTH), [cv2.IMWRITE_JPEG_QUALITY, 82]
                )
                print(f"  layer: {path.name} ({path.stat().st_size / 1e3:.0f} kB)")

    detector.close()
    poser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="site/public/media")
    parser.add_argument("--seconds", type=float, default=12.0, help="hero clip length")
    parser.add_argument("--warmup", type=int, default=60, help="frames to let tracks confirm")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("hero, from the synthetic source:")
    intermediate = capture_hero(out, args.seconds, args.warmup)

    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        print("\nffmpeg is not on PATH and imageio-ffmpeg is not installed, so the hero")
        print("is the raw intermediate, which is far too large to serve. Install one:")
        print("  pip install imageio-ffmpeg")
        print("and re-run. Nothing else in the capture depends on it.")
    else:
        print(f"\nencoding, with {Path(ffmpeg).name}:")
        if encode(ffmpeg, intermediate, out):
            intermediate.unlink()

    print("\nlayer sequence, synthetic:")
    capture_layers(out, HERO_SOURCE, at_frame=180, prefix="layers")

    total = sum(path.stat().st_size for path in out.glob("*") if path.is_file())
    print(f"\n{out}: {total / 1e6:.2f} MB total")
    return 0


if __name__ == "__main__":
    sys.exit(main())

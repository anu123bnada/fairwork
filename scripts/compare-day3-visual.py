"""Assemble original/current evidence without changing either source image."""
from pathlib import Path
import hashlib
import html
import json
import shutil
from PIL import Image, ImageDraw

root = Path('test-results/day3-visual')
pairs = [
    ('00-Splash', 'intro-splash'),
    ('00-Onboarding-1-derived', 'intro-onboarding'),
    ('00-Onboarding-2', 'intro-onboarding-slide-2'),
    ('00-Onboarding-3', 'intro-onboarding-slide-3'),
    ('00-Language', 'intro-language'), ('00-Sign-in', 'sign-in'), ('00-OTP', 'otp'),
    ('01-Welcome', 'app-intro-welcome'), ('02-Home', 'home-populated'),
    ('03-Add-offer', 'app-add-offer'), ('04-Analyzing', 'analyzing-populated'),
    ('05-FAIRWORK-Check', 'check-populated'), ('06-Questions', 'questions-populated'),
    ('07-Agreement', 'agreement-populated'),
]
(root / 'comparisons').mkdir(exist_ok=True)
records = []
sections = []
for reference, current in pairs:
    ref = root / 'reference' / f'{reference}.png'
    src = root / 'after' / f'390-{current}.png' if current.endswith('-populated') else Path('test-results') / f'fairwork-figma-{current}.png'
    full = Image.open(src).convert('RGB')
    # Current full-page captures remain available; pair the initial viewport only.
    viewport = full.crop((0, 0, 390, 844))
    dst = root / 'after' / f'390-{current}-viewport.png'
    viewport.save(dst)
    if src.parent != root / 'after': shutil.copy2(src, root / 'after' / src.name)
    original = Image.open(ref).convert('RGB')
    pair = Image.new('RGB', (800, 874), '#e5e5e5')
    pair.paste(original, (0, 30)); pair.paste(viewport, (410, 30))
    draw = ImageDraw.Draw(pair)
    draw.text((8, 8), 'ORIGINAL ' + reference, fill='black')
    draw.text((418, 8), 'CURRENT (synthetic test session)', fill='black')
    pair.save(root / 'comparisons' / f'{reference}.png')
    Image.blend(original, viewport, .5).save(root / 'comparisons' / f'{reference}-overlay.png')
    records.append({'reference': str(ref), 'referenceSha256': hashlib.sha256(ref.read_bytes()).hexdigest(), 'current': str(src), 'currentSha256': hashlib.sha256(src.read_bytes()).hexdigest(), 'currentFullSize': full.size, 'comparisonViewport': [390,844], 'derivedReference': reference.endswith('-derived')})
    sections.append(f'<section><h2>{html.escape(reference)}</h2><a href="comparisons/{reference}.png">Full resolution side by side</a> · <a href="comparisons/{reference}-overlay.png">50% overlay</a><div class="pair"><img alt="Original {reference}" src="reference/{reference}.png"><img alt="Current {current}" src="after/{dst.name}"></div></section>')
for src in Path('test-results').glob('fairwork-recording-*.png'):
    shutil.copy2(src, root / 'after' / src.name)
(root / 'comparison-manifest.json').write_text(json.dumps(records, indent=2))
(root / 'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><title>FAIRWORK Day 3 visual evidence</title><style>body{font:16px system-ui;margin:24px;background:#edf0f5;color:#0b1b33}h1{font-size:26px}section{margin:36px 0}.pair{display:flex;gap:20px;margin:16px 0;flex-wrap:wrap}.pair img{width:390px;height:844px;border:1px solid #b5c2d8}p{max-width:850px}a{color:#1649d0}</style><h1>DEVELOPMENT DAY 3 — local visual comparison</h1><p>October 13, 2026. Original 390×844 exports on the left; current isolated browser captures on the right. Authenticated data is a browser transport fixture, not hosted verification. Onboarding 1 is a labelled Chromium rendering of the supplied original SVG because its PNG is absent. Full-page captures, 378×744 responsive captures and state evidence are retained in after/. Video frames include phone chrome and are motion/navigation references, not pixel-aligned canvases.</p><p>These pairs expose differences; they do not automatically prove visual parity. Read docs/DAY3_VISUAL_GATE_20261013.md for the acceptance decision and remaining differences.</p>''' + ''.join(sections) + '</html>', encoding='utf-8')
print(f'Created {len(records)} original/current pairs, overlays and manifest.')

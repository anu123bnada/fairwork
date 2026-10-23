"""Extract decorative vectors from the owner's local original SVG exports.

Never rasterize a screen into the application's interactive UI. Original files
are read-only; the generated assets contain only the original decorative groups.
"""
from pathlib import Path
import copy
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET

source = Path(sys.argv[1])
target = Path('public/figma/product')
target.mkdir(parents=True, exist_ok=True)
ns = 'http://www.w3.org/2000/svg'
ET.register_namespace('', ns)
manifest = []
for name in ['00-Splash', '00-Onboarding-1', '00-Onboarding-2', '00-Onboarding-3']:
    path = source / (name + '.svg')
    tree = ET.parse(path).getroot()
    screen = tree.find(f'{{{ns}}}g')
    background = screen.find(f'{{{ns}}}g[@id="Background"]')
    if name in ['00-Splash', '00-Onboarding-1']:
        out = ET.Element(f'{{{ns}}}svg', width='390', height='844', viewBox='0 0 390 844')
        out.append(copy.deepcopy(tree.find(f'{{{ns}}}defs')))
        out.append(copy.deepcopy(background))
        filename = 'splash-background.svg' if name == '00-Splash' else 'background.svg'
        ET.ElementTree(out).write(target / filename, encoding='unicode')
        manifest.append({'asset': filename, 'source': str(path), 'layer': 'Background', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    icon = next(e for e in screen if e.tag == f'{{{ns}}}g' and 'transform' in e.attrib)
    x, y, scale = map(float, re.findall(r'[\d.]+', icon.get('transform')))
    size = 24 * scale
    out = ET.Element(f'{{{ns}}}svg', width=f'{size:g}', height=f'{size:g}', viewBox=f'{x:g} {y:g} {size:g} {size:g}')
    out.append(copy.deepcopy(icon))
    # The supplied v4 help icon has a malformed arc token ("2.500").
    # Restore the omitted separator before the rotation flag; PNG/video show
    # the question-mark stroke that Chromium otherwise drops. Source untouched.
    for path_node in out.iter(f'{{{ns}}}path'):
        if name == '00-Onboarding-2' and path_node.get('d', '').startswith('M9.5 9.5a'):
            path_node.set('d', path_node.get('d').replace('a2.5 2.500 1 1', 'a2.5 2.5 0 1 1'))
    filename = name.lower() + '-icon.svg'
    ET.ElementTree(out).write(target / filename, encoding='unicode')
    manifest.append({'asset': filename, 'source': str(path), 'layer': icon.attrib, 'size': size, 'repair': 'arc rotation separator' if name == '00-Onboarding-2' else None, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
Path('test-results/day3-visual/asset-provenance.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest, indent=2))

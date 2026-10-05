"""Export the SVG mark and aligned signature on the sidebar background."""
from pathlib import Path
import math
import sys
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.pens.basePen import BasePen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent.parent
SCALE = 3
RED = '#ef646b'
BACKGROUND = '#0b0e0f'
README_BANNER = '--readme' in sys.argv


class OutlinePen(BasePen):
    def __init__(self):
        super().__init__(None)
        self.contours = []
        self.points = []

    def _moveTo(self, point):
        self.points = [point]

    def _lineTo(self, point):
        self.points.append(point)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.points[-1]
        length = sum(math.dist(a, b) for a, b in zip([p0, p1, p2], [p1, p2, p3]))
        steps = max(16, math.ceil(length / 6))
        for index in range(1, steps + 1):
            t = index / steps
            self.points.append(tuple((1-t)**3*p0[k] + 3*(1-t)**2*t*p1[k] + 3*(1-t)*t*t*p2[k] + t**3*p3[k] for k in (0, 1)))

    def _closePath(self):
        self.contours.append(self.points)
        self.points = []


def area(points):
    return sum(a[0]*b[1] - b[0]*a[1] for a, b in zip(points, points[1:] + points[:1]))


def symbol(size):
    svg = ET.parse(ROOT / 'icons/favicon.svg').getroot()
    pen = OutlinePen()
    parse_path(svg.find('.//{http://www.w3.org/2000/svg}path').attrib['d'], pen)
    mask = Image.new('L', (size*SCALE, size*SCALE), 0)
    draw = ImageDraw.Draw(mask)
    contours = sorted(pen.contours, key=lambda points: abs(area(points)), reverse=True)
    winding = area(contours[0])
    for points in contours:
        transformed = [(x/2740*size*SCALE, (2740-y)/2740*size*SCALE) for x, y in points]
        draw.polygon(transformed, fill=255 if area(points)*winding > 0 else 0)
    image = Image.new('RGBA', mask.size, RED)
    image.putalpha(mask)
    return image.resize((size, size), Image.Resampling.LANCZOS)


mark = symbol(1024)
if not README_BANNER:
    # Shared vector for website icons; no profile crop ring.
    svg = ET.parse(ROOT / 'icons/favicon.svg').getroot()
    path_data = svg.find('.//{http://www.w3.org/2000/svg}path').attrib['d']
    vector = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 274 274">
    <defs><linearGradient id="red" gradientUnits="userSpaceOnUse" x1="0" y1="2400" x2="0" y2="300"><stop stop-color="#ff8085"/><stop offset="1" stop-color="#d23a4a"/></linearGradient></defs>
    <g transform="translate(0 274) scale(.1 -.1)" fill="url(#red)"><path d="{path_data}"/></g></svg>'''
    (ROOT / 'icons/digimon-cwb-mark.svg').write_text(vector, encoding='utf-8')
    (ROOT / 'icons/favicon.svg').write_text(vector, encoding='utf-8')
    profile_size = 400*SCALE
    icon = Image.new('RGBA', (profile_size, profile_size), BACKGROUND)
    profile_mark = mark.crop(mark.getchannel('A').getbbox())
    profile_width = 244*SCALE
    profile_height = round(profile_width * profile_mark.height / profile_mark.width)
    profile_mark = profile_mark.resize((profile_width, profile_height), Image.Resampling.LANCZOS)
    profile_position = ((profile_size-profile_width)//2, (profile_size-profile_height)//2)
    profile_mask = Image.new('L', icon.size, 0)
    profile_mask.paste(profile_mark.getchannel('A'), profile_position)
    glow = Image.new('RGBA', icon.size, '#d73648')
    glow.putalpha(profile_mask.filter(ImageFilter.GaussianBlur(24*SCALE)).point(lambda value: round(value*0.35)))
    icon.alpha_composite(glow)
    gradient = Image.new('RGBA', icon.size)
    gradient_draw = ImageDraw.Draw(gradient)
    for y in range(profile_size):
        fraction = max(0, min(1, (y-profile_position[1])/profile_height))
        color = tuple(round(a+(b-a)*fraction) for a, b in zip((255, 128, 133), (210, 58, 74)))
        gradient_draw.line((0, y, profile_size, y), fill=color+(255,))
    gradient.putalpha(profile_mask)
    icon.alpha_composite(gradient)
    icon = icon.resize((400, 400), Image.Resampling.LANCZOS).convert('RGB')
    icon.save(ROOT / 'icons/digimon-cwb-symbol-red.png')
    icon.save(ROOT / 'icons/digimon-cwb-profile-x.png')
brand = Image.new('RGBA', (1500*SCALE, 500*SCALE), BACKGROUND)
ambient_mask = Image.new('L', brand.size, 0)
ImageDraw.Draw(ambient_mask).ellipse(((265*SCALE, 95*SCALE, 1235*SCALE, 405*SCALE) if README_BANNER else (430*SCALE, 60*SCALE, 1400*SCALE, 365*SCALE)), fill=30)
ambient_glow = Image.new('RGBA', brand.size, '#d73648')
ambient_glow.putalpha(ambient_mask.filter(ImageFilter.GaussianBlur(60*SCALE)))
brand.alpha_composite(ambient_glow)
draw = ImageDraw.Draw(brand)
fonts = Path('C:/Windows/Fonts')
title = ImageFont.truetype(str(fonts / 'ariblk.ttf'), 110*SCALE)
subtitle = ImageFont.truetype(str(fonts / 'arial.ttf'), 53*SCALE)
title_text = 'DIGIMON CWB'
subtitle_text = 'Digimon Card Game Community'
title_bounds = draw.textbbox((0, 0), title_text, font=title)
subtitle_bounds = draw.textbbox((0, 0), subtitle_text, font=subtitle)
title_width = title_bounds[2] - title_bounds[0]
subtitle_layer = Image.new('RGBA', (subtitle_bounds[2] - subtitle_bounds[0], subtitle_bounds[3] - subtitle_bounds[1]), (0, 0, 0, 0))
ImageDraw.Draw(subtitle_layer).text((-subtitle_bounds[0], -subtitle_bounds[1]), subtitle_text, font=subtitle, fill='#aab1b5')
subtitle_layer = subtitle_layer.resize((title_width, subtitle_layer.height), Image.Resampling.LANCZOS)
title_height = title_bounds[3] - title_bounds[1]
gap_vertical = 24*SCALE
text_height = title_height + gap_vertical + subtitle_layer.height
visible_mark = mark.crop(mark.getchannel('A').getbbox())
mark_width = round(visible_mark.width / visible_mark.height * text_height)
visible_mark = visible_mark.resize((mark_width, text_height), Image.Resampling.LANCZOS)
gap_horizontal = 80*SCALE
content_width = mark_width + gap_horizontal + title_width
mark_left = (brand.width - content_width) // 2 + (0 if README_BANNER else 80*SCALE)
top = (brand.height - text_height) // 2 - (0 if README_BANNER else 35*SCALE)
left = mark_left + mark_width + gap_horizontal
banner_mask = visible_mark.getchannel('A')
banner_gradient = Image.new('RGBA', visible_mark.size)
banner_draw = ImageDraw.Draw(banner_gradient)
for y in range(text_height):
    fraction = y / max(1, text_height-1)
    color = tuple(round(a+(b-a)*fraction) for a, b in zip((255, 128, 133), (210, 58, 74)))
    banner_draw.line((0, y, mark_width, y), fill=color+(255,))
banner_gradient.putalpha(banner_mask)
glow_mask = Image.new('L', brand.size, 0)
glow_mask.paste(banner_mask, (mark_left, top))
banner_glow = Image.new('RGBA', brand.size, '#d73648')
banner_glow.putalpha(glow_mask.filter(ImageFilter.GaussianBlur(20*SCALE)).point(lambda value: round(value*0.35)))
brand.alpha_composite(banner_glow)
brand.alpha_composite(banner_gradient, (mark_left, top))
draw.text((left-title_bounds[0], top-title_bounds[1]), title_text, font=title, fill='white')
brand.alpha_composite(subtitle_layer, (left, top + title_height + gap_vertical))
brand = brand.resize((1500, 500), Image.Resampling.LANCZOS)
if README_BANNER:
    destination = ROOT / 'icons/digimon-cwb-banner-readme.png'
    brand.convert('RGB').save(destination)
    print(f'{destination.name}: 1500 x 500, centered signature')
else:
    brand.convert('RGB').save(ROOT / 'icons/digimon-cwb-logo.png')
    brand.convert('RGB').save(ROOT / 'icons/digimon-cwb-banner-x.png')
    for name in ['digimon-cwb-symbol-red.png', 'digimon-cwb-logo.png']:
        with Image.open(ROOT / 'icons' / name) as image:
            assert image.getpixel((0, 0)) == (11, 14, 15)
            print(f'{name}: {image.size[0]} x {image.size[1]}, {image.mode}, background={BACKGROUND}')

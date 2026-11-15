"""Recreate the rover terrain tile from the project's archived NASA PDS row band."""
import hashlib
import json
import math
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
ARCHIVE = HERE.parents[2] / "clps-prototype/data/terrain"
MANIFEST = json.loads((ARCHIVE / "dem-source-manifest.json").read_text())
band = (ARCHIVE / MANIFEST["file"]).read_bytes()
assert hashlib.sha256(band).hexdigest() == MANIFEST["sha256"]

# Pixel centre nearest the project's hypothetical 89.5 S, 0 E reference.
row, col = 3610, 3800
lines = []
for r in range(row - 32, row + 33):
    offset = ((r - MANIFEST["row_start_zero_based"]) * 7600 + col - 32) * 2
    line = struct.unpack_from("<65h", band, offset)
    assert all(-14592 <= n <= 14052 for n in line)
    lines.append(line)

grid = "export const rows = [\n" + "".join("  [" + ",".join(map(str, ln)) + "],\n" for ln in lines) + "];\n"
(HERE / "lola-samples.mjs").write_text("// LDEM_80S_80M V2.0 • signed source DN • scale 0.5 m/DN. See lola.json.\n" + grid)
x, y = (col - 3799.5)*80, (3799.5 - row)*80
radius = MANIFEST["reference_radius_m"]
meta = {
 "product": MANIFEST["product_id"], "version": MANIFEST["product_version"],
 "publisher":"NASA LRO Lunar Orbiter Laser Altimeter, NASA Planetary Data System",
 "productUrl": MANIFEST["source_url"], "labelUrl": MANIFEST["source_url"][:-3]+"lbl",
 "parentBandSha256": MANIFEST["sha256"],
 "fileSha256":hashlib.sha256((HERE/"lola-samples.mjs").read_bytes()).hexdigest(),
 "centrePixelRowColumnZeroBased":[row,col],"centreLatitudeDeg":-90+math.degrees(2*math.atan(math.hypot(x,y)/(2*radius))),
 "centreLongitudeEastDeg":math.degrees(math.atan2(x,y))%360,
 "centreElevationM":lines[32][32]*0.5,"referenceRadiusM":radius,"metresPerDN":0.5,
 "gridSpacingM":80,"gridColumns":65,"gridRows":65,"spanM":5120,
 "coordinates":"x increases with source column; +z decreases source row (projected grid up). Units are projected metres. Local +z is not geographic north everywhere.",
 "limits":"Bilinear interpolated terrain relative to the centre pixel. Subpixel rocks, local wheel-scale slopes, bearing strength and traction are unresolved."
}
(HERE/"lola.json").write_text(json.dumps(meta,indent=2)+"\n")
print(meta)

"""Reproduce selected points from the published FLEX-155 figure (Python 3 + Pillow).

Run beside flex-155-figure.jpg. Prints the JavaScript used by the exhibit.
Pixel locations are on the original 1275 x 829 raster, with origin at top left.
"""
import hashlib
import json
import statistics
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCE_SHA = "e0201a88b341021cf48b5439887c8a84e0e167c4b70422244f14ef3acb009ead"
# Selected centres along the green camera trace. Later x positions sample the red trace only.
SAMPLES = [(248,136),(297,88),(322,87),(336,132),(339,215),(343,393),
           (346,553),(353,738),(445,None),(592,None),(691,None),(839,None),
           (937,None),(1085,None),(1180,None)]

def read_points():
    image_path = HERE / "flex-155-figure.jpg"
    if hashlib.sha256(image_path.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError("The figure differs from the source image.")
    im = Image.open(image_path).convert("RGB")
    if im.size != (1275,829):
        raise ValueError("Unexpected figure dimensions")
    readings = []
    for x,green_y in SAMPLES:
        red_y = []
        for xx in range(x-2,x+3):
            for y in range(145,700):
                r,g,b = im.getpixel((xx,y))
                if r > g+65 and r > b+65:
                    red_y.append(y)
        if not red_y:
            raise ValueError(f"No droplet trace near column {x}")
        row = {"x": x, "t":round((x-198)/49.25,2),
               "drop2": round((738-statistics.median(red_y))/80.25,2), "flame":None}
        if green_y is not None:
            green = []
            for xx in range(x-4,x+5):
                for y in range(green_y-5,green_y+6):
                    r,g,b = im.getpixel((xx,y))
                    if g>r+36 and g>b+28:
                        green.append(y)
            if not green:
                raise ValueError(f"No color-camera marker near column {x}")
            row["flame"] = max(0,round((738-statistics.median(green))/28.88,1))
        readings.append(row)
    return readings

if __name__ == "__main__":
    print("window.FFFlex155 = "+json.dumps(read_points(),separators=(",",":"))+";")

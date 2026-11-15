# A Saffire-I flame measurement from five flight frames

Open **Measure a flame video** in the research desk and choose the Saffire-I example. These are five native-resolution images of the opposed-flow burn of SIBAL fabric in Cygnus. NASA’s PSI-98 experimental table identifies sample S2, camera C2, approximately 21.5% oxygen, airflow of 20 cm/s and a reported burn duration of 70 seconds. F1 denotes pre-flow, F2 denotes post-flow and S2 identifies the second burn. Select the same S2C2 sequence throughout. [NASA PSI-98 study](https://doi.org/10.60555/0t15-1z43) · [NASA investigation and file inventory](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98)

## Clock and image geometry

Each date-like number in the first column below is the suffix of an archived filename. Using the suffix, join each mapped photograph to its ICMAD companion. The text NASA added beneath that companion gives the original name, camera acquisition count, exposure and gain. All five exposures are 30,000 microseconds at 0 dB gain. Urban and colleagues report that the cameras acquired 30 frames per second. Subtract acquisition count 1047 and divide by 30 to get elapsed time. The filenames differ by 13,998 milliseconds over the selected span, consistent with the 14.0 seconds from the independent counter and nominal camera cadence. Dropped and unselected frames still count toward elapsed time. [Investigators’ Saffire-I–III methods](https://doi.org/10.1016/j.combustflame.2018.10.012) · [NASA’s annotated image set](https://psi.nasa.gov/geode-py/ws/studies/PSI-98/download?file=PSI-98_Raw%20Data_SAFFIRE_I_S2C2_Raw2TIFF_Complete_icmad.zip&version=1&studyVersion=4)

| Mapped image suffix | Acquisition count | Elapsed seconds | Worked luminous contour x (px) |
| --- | ---: | ---: | ---: |
| 1465937828374 | 1047 | 0 | 408 |
| 1465937830340 | 1106 | 1.967 | 417 |
| 1465937834373 | 1227 | 6 | 429 |
| 1465937838373 | 1347 | 10 | 448 |
| 1465937842372 | 1467 | 14 | 457 |

NASA’s mapped camera-2 photographs are 1,705 × 1,222 pixels. The downloadable 30 mm checkerboard is a pre-flight camera-2 calibration target. Its mapped JPEG also measures 1,705 × 1,222. The annotations use a separate, 1,280-pixel-wide image plus a footer. Use the mapped JPEG for a coordinate and the annotated image for the count. The archived readme explains the distortion correction and the distinction between flight frames and pre-flow. [Mapped sample-2 photographs](https://psi.nasa.gov/geode-py/ws/studies/PSI-98/download?file=PSI-98_Raw%20Data_SAFFIRE_I_S2C2_Raw2TIFF_Mapped.zip&version=1&studyVersion=4) · [Mapped camera-2 calibration grid](https://psi.nasa.gov/geode-py/ws/studies/PSI-98/download?file=PSI-98_Raw%20Data_Mapped_SAFFIRE-1_F1C2_DistortionGrid_1280x920.zip&version=1&studyVersion=4) · [NASA data readme](https://psi.nasa.gov/geode-py/ws/studies/PSI-98/download?file=PSI-98_Science%20Documents_SAFFIRE-I%20and%20SAFFIRE-III%20Readme.docx&version=1&studyVersion=4)

## Reproduce the worked measurement

The endpoint here is the projected position of the bright red band. The window’s origin is the top-left corner of the decoded native JPEG. For each x, average red minus blue over y = 350 through 850 inclusive. Smooth this profile with a horizontal, centered seven-pixel moving average. Within x = 250 through 650 inclusive, find the rightmost pixel at or above half that frame’s maximum. Measuring relative to the local peak accommodates a fading signal. A stronger or weaker luminous feature, a different field of view or a different band can shift the endpoint.

The contour moves 49 px in 14.0 s, or **3.50 px/s toward increasing x**. Moving the threshold to 40% gives 3.57 px/s, and 60% gives 3.50 px/s. This is sensitivity to one choice of threshold. A manually placed point may differ. This contour describes emitted light projected onto the image. Converting the value into fuel-surface propagation would also require a defined physical front and its relation to the observed light.

With Python, Pillow and NumPy installed, run this from the repository root to verify each photo against its digest and recompute the result.

```python
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image

site = Path("site")
example = json.loads((site / "front-example.json").read_text())
positions = []
for frame in example["frames"]:
    file = site / frame["file"]
    assert hashlib.sha256(file.read_bytes()).hexdigest() == frame["sha256"]
    rgb = np.asarray(Image.open(file).convert("RGB"), dtype=float)
    band = rgb[350:851, :, 0] - rgb[350:851, :, 2]
    smoothed = np.convolve(band.mean(axis=0), np.ones(7) / 7, "same")
    profile = smoothed[250:651]
    positions.append(250 + int(np.flatnonzero(profile >= 0.5 * profile.max())[-1]))

elapsed = (example["frames"][-1]["acquisitionCount"] -
           example["frames"][0]["acquisitionCount"]) / example["clock"]["framesPerSecond"]
assert positions == [408, 417, 429, 448, 457]
print((positions[-1] - positions[0]) / elapsed, "px/s")
```

## What would support a physical speed?

Obtain a camera-2 calibration that ties the target plane to the measured specimen plane, with the same lens, ROI offsets and distortion map as these frames. Use a local multi-square fit around the measurement band, quantify residual distortion and perspective, and propagate their uncertainty. The record lists `PSI-98_Raw Data_SAFFIRE-I_ImageFrameSizes_ROI_Offsets_Grid_1280x920_v1.0.pdf`. Its public download returned HTTP 404 during this audit. The checkerboard spacing and matching output dimensions alone leave plane registration unresolved. The example therefore retains pixels and seconds. The published spread speeds remain independent measurements. [NASA source file inventory](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98) · [Published Saffire-I rates, slide 21](https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21)

The downloadable manifest records the three NASA ZIP names and hashes, each original member name and its SHA-256, nominal camera cadence, individual source counts and the worked contour settings. PSI lists the dataset under CC0 1.0. The five science JPEGs and their five corresponding annotated JPEGs were copied byte for byte after ZIP member CRC validation. [Example manifest](../dist/front-example.json)

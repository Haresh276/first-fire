"""Pack the pinned Potion static encoder for browser searches under the 5 MB limit."""
import array
import base64
import hashlib
import json
from pathlib import Path
import struct
import sys

root = Path(__file__).resolve().parents[1]
source = root / 'data/model'
weights = (source / 'model.safetensors').read_bytes()
assert hashlib.sha256(weights).hexdigest() == 'f95ffde02ad06f63ae38eb9d400038cd5ccaf8411ec3cb650c6025113f96cbb8'
header_size = int.from_bytes(weights[:8], 'little')
header = json.loads(weights[8:8 + header_size])['embeddings']
rows, dim = header['shape']
assert header['dtype'] == 'F32' and header['data_offsets'] == [0, rows * dim * 4]
values = array.array('f', weights[8 + header_size:])
if sys.byteorder != 'little':
    values.byteswap()
scales, packed = bytearray(), array.array('b')
for offset in range(0, len(values), dim):
    vector = values[offset:offset + dim]
    scale = max(map(abs, vector)) / 127 or 1.0
    scales.extend(struct.pack('<f', scale))
    packed.extend(round(x / scale) for x in vector)
encode = lambda data: base64.b64encode(data).decode('ascii')
model = {'dim':dim, 'vocab':json.loads((source / 'tokenizer.json').read_text())['model']['vocab'],
         'scales':encode(scales), 'weights':encode(packed)}
script = 'window.FFSearchVectors=' + json.dumps(model, separators=(',', ':'), ensure_ascii=True) + ';\n'
assert len(script.encode()) < 5_000_000
(root / 'site/search-vectors.js').write_text(script)

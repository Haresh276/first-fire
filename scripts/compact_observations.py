"""Dictionary-encode repeated strings for an offline classic-script archive.

Only the transport representation changes. Missing object properties and cells
with empty strings are distinct. Raw source table row lengths are preserved.
"""
import json


def compact_script(tests, tables):
    dictionary = []
    indexes = {}

    def symbol(value):
        # The ingest format is text; preserve nulls and numbers if a future release adds them.
        identity = (type(value), value)
        if identity not in indexes:
            indexes[identity] = len(dictionary)
            dictionary.append(value)
        return indexes[identity]

    keys = list(dict.fromkeys(key for row in tests for key in row))
    rows = [[symbol(row[key]) if key in row else -1 for key in keys] for row in tests]
    raw = {name:[[symbol(cell) for cell in row] for row in table] for name, table in tables.items()}
    payload = json.dumps([dictionary, keys, rows, raw], ensure_ascii=True, separators=(',', ':'))
    return '''/* Lossless dictionary-coded copy of the original table bundle. */
(() => {
  const [values,keys,rows,tables] = ''' + payload + ''';
  const tests = rows.map(indices => {
    const row = {};
    indices.forEach((index,i) => { if(index !== -1) row[keys[i]]=values[index]; });
    return row;
  });
  const rawTables = Object.fromEntries(Object.entries(tables).map(([name,entries]) =>
    [name,entries.map(row => row.map(i => values[i]))]));
  Object.assign(window.FF,{tests,rawTables});
})();
'''

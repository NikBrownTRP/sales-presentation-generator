#!/bin/bash
# Re-embeds css/slides.css into index.html as a hardcoded JS string
# Run this after any changes to css/slides.css

cd "$(dirname "$0")"

python3 << 'PYEOF'
import json, sys

with open('css/slides.css') as f:
    css = f.read()

with open('index.html') as f:
    html = f.read()

# Find and replace the __SLIDES_CSS__ assignment using string ops (not regex)
marker_start = 'window.__SLIDES_CSS__ = '
marker_end = ';'

idx = html.find(marker_start)
if idx == -1:
    print('Warning: window.__SLIDES_CSS__ not found in index.html')
    sys.exit(1)

# Find the end of the JSON string (the semicolon after the closing quote)
val_start = idx + len(marker_start)
# The value is a JSON string, find its end by parsing
depth = 0
in_string = False
escape_next = False
end_idx = val_start
for i in range(val_start, len(html)):
    c = html[i]
    if escape_next:
        escape_next = False
        continue
    if c == '\\':
        escape_next = True
        continue
    if c == '"' and not in_string:
        in_string = True
        continue
    if c == '"' and in_string:
        in_string = False
        continue
    if not in_string and c == ';':
        end_idx = i + 1
        break

new_assignment = marker_start + json.dumps(css) + ';'
new_html = html[:idx] + new_assignment + html[end_idx:]

with open('index.html', 'w') as f:
    f.write(new_html)

print('CSS embedded: ' + str(len(css)) + ' chars')
PYEOF

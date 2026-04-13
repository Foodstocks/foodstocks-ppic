import os

files = [
    'app/page.tsx',
    'app/cogs/page.tsx',
    'app/inventory/page.tsx',
    'app/planner/page.tsx',
    'app/po-budget/page.tsx',
    'app/suppliers/page.tsx',
    'app/settings/page.tsx',
]

# Order matters — do longer/more specific strings first
replacements = [
    # Backgrounds
    ("'#1e2132'", "'var(--bg-card)'"),
    ('"#1e2132"', '"var(--bg-card)"'),
    ("'#1a1d27'", "'var(--bg-surface)'"),
    ('"#1a1d27"', '"var(--bg-surface)"'),
    ("'#252840'", "'var(--bg-hover)'"),
    ('"#252840"', '"var(--bg-hover)"'),
    ("'#0f1117'", "'var(--bg-primary)'"),
    ('"#0f1117"', '"var(--bg-primary)"'),
    # Borders
    ("'#2a2d3e'", "'var(--border)'"),
    ('"#2a2d3e"', '"var(--border)"'),
    # Text
    ("'#e2e8f0'", "'var(--text-primary)'"),
    ('"#e2e8f0"', '"var(--text-primary)"'),
    ("'#94a3b8'", "'var(--text-secondary)'"),
    ('"#94a3b8"', '"var(--text-secondary)"'),
    ("'#64748b'", "'var(--text-muted)'"),
    ('"#64748b"', '"var(--text-muted)"'),
    ("'#475569'", "'var(--text-faint)'"),
    ('"#475569"', '"var(--text-faint)"'),
]

for filepath in files:
    full_path = os.path.join('c:/Users/ferry/Claude/Purchasing Tracker/foodstocks-app', filepath)
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated: {filepath}')
    else:
        print(f'No changes: {filepath}')

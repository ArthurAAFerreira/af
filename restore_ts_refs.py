import re, os

BASE = os.path.dirname(os.path.abspath(__file__))

entries = [
    (os.path.join(BASE, 'utfprld', 'agendaveiculosdeseg', 'index.html'),     './pages/index.ts'),
    (os.path.join(BASE, 'utfprct', 'agendaveiculosdeseg', 'index.html'),     './pages/index.ts'),
    (os.path.join(BASE, 'utfprld', 'agendaveiculosdeseg', 'cadastros.html'), './pages/cadastros.ts'),
    (os.path.join(BASE, 'utfprct', 'agendaveiculosdeseg', 'cadastros.html'), './pages/cadastros.ts'),
    (os.path.join(BASE, 'utfprld', 'agendaveiculosdeseg', 'relatorios.html'),'./pages/relatorios.ts'),
    (os.path.join(BASE, 'utfprct', 'agendaveiculosdeseg', 'relatorios.html'),'./pages/relatorios.ts'),
]

for filepath, ts_src in entries:
    if not os.path.exists(filepath):
        print(f'SKIP (not found): {filepath}')
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove ALL modulepreload link lines (including data: URIs)
    content = re.sub(r'[ \t]*<link rel="modulepreload"[^\n]*\n', '', content)

    # Replace compiled-asset script tag with TS source ref
    content = re.sub(
        r'<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>',
        f'<script type="module" src="{ts_src}"></script>',
        content
    )

    # Remove bundled CSS link (CSS is re-emitted by Vite from the TS import)
    content = re.sub(r'[ \t]*<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+\.css">\n?', '', content)

    # Collapse 3+ consecutive blank lines into 2
    content = re.sub(r'\n{3,}', '\n\n', content)

    with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

    print(f'Restored: {filepath}')

print('Done.')

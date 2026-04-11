import re, pathlib

for path in [
    r'utfprct\agendaveiculosdeseg\relatorios.html',
    r'utfprld\agendaveiculosdeseg\relatorios.html',
]:
    p = pathlib.Path(path)
    t = p.read_bytes().decode('utf-8')
    # Remove every <link rel="modulepreload" ...> line
    t = re.sub(r'[ \t]*<link rel="modulepreload"[^\n]*\n', '', t)
    # Remove the hashed stylesheet <link rel="stylesheet" crossorigin ...> line
    t = re.sub(r'[ \t]*<link rel="stylesheet" crossorigin[^\n]*\n', '', t)
    p.write_bytes(t.encode('utf-8'))
    print(f'Fixed: {path}')

import openpyxl, re, unicodedata

def slugify(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.lower().strip()
    return re.sub(r'[^a-z0-9]', '', s)

def make_email(resp):
    if not resp:
        return 'NULL'
    s = str(resp).strip()
    if re.search(r'[,;/]|\be\b|multiusu', s, re.I):
        return 'NULL'
    s = re.sub(r'^(profa?\.?\s*|tec\.?\s*)', '', s, flags=re.I).strip()
    parts = s.split()
    if not parts:
        return 'NULL'
    slug = slugify(parts[0])
    return f"'{slug}@utfpr.edu.br'" if slug else 'NULL'

def make_nome(resp):
    if not resp:
        return 'NULL'
    s = str(resp).strip().replace("'", "''")
    return f"'{s}'"

SEDE = {'Centro': 1, 'Neoville': 2, 'Ecoville': 3}
DURAB = {1: 8, 2: 7, 3: 6}
MANUT = {0: 15, 3: 4, 6: 5, 9: 13}
MATER = {0: 1, 3: 2, 6: 3, 9: 11}
UTILI = {0.5: 12, 1.0: 9, 2.0: 10}

wb = openpyxl.load_workbook(
    r'C:\Users\arthu\OneDrive\AFN8N\github\af\matrizorcamentaria\LABORATORIOS.xlsx',
    data_only=True
)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))[1:]

errors = []
lines = []
lines.append('DO $$')
lines.append('DECLARE')
lines.append('  cfg_id bigint;')
lines.append('  est_id bigint;')
lines.append('  unid_id bigint;')
lines.append('BEGIN')
lines.append('  SELECT id INTO cfg_id FROM utfprct.matriz_orc_configuracao_base WHERE ativo = true LIMIT 1;')
lines.append('')

inserted = 0
for i, r in enumerate(rows, 1):
    if not r[0]:
        continue
    nome = r[0]
    unid = r[2]
    sede = r[3]
    sala = r[4]
    dur  = r[5]
    man  = r[6]
    mat  = r[7]
    uti  = r[8]
    resp = r[9]

    if not nome or not unid:
        continue

    # Limpar siglas compostas: "DAEST/DAGEE" → "DAEST"
    unid = re.split(r'[/,;]', str(unid).strip())[0].strip()

    sede_id = SEDE.get(str(sede).strip()) if sede else None
    sede_val = str(sede_id) if sede_id else 'NULL'

    try:
        dur_id = DURAB.get(int(dur)) if dur is not None else None
        man_id = MANUT.get(int(man)) if man is not None else None
        mat_id = MATER.get(int(mat)) if mat is not None else None
        uti_id = UTILI.get(float(uti)) if uti is not None else None
    except Exception as e:
        errors.append(f'Row {i}: {nome} - parse error: {e}')
        continue

    nome_s  = str(nome).strip().replace("'", "''")
    attr_ids = [a for a in [dur_id, man_id, mat_id, uti_id] if a is not None]
    if None in [dur_id, man_id, mat_id, uti_id]:
        missing = []
        if dur_id is None: missing.append(f'dur={dur}')
        if man_id is None: missing.append(f'man={man}')
        if mat_id is None: missing.append(f'mat={mat}')
        if uti_id is None: missing.append(f'uti={uti}')
        errors.append(f'Row {i}: {nome_s[:50]} - atributo(s) sem mapeamento: {", ".join(missing)}')
    unid_s  = str(unid).strip()
    sala_s  = str(sala).strip().replace("'", "''") if sala else None
    sala_val = f"'{sala_s}'" if sala_s else 'NULL'
    resp_nome  = make_nome(resp)
    resp_email = make_email(str(resp) if resp else '')

    lines.append(f'  -- [{i}] {nome_s[:70]}')
    lines.append(f"  SELECT id INTO unid_id FROM utfprct.matriz_orc_unidades WHERE sigla = '{unid_s}' AND ativo = true LIMIT 1;")
    lines.append(f'  IF unid_id IS NULL THEN')
    lines.append(f"    RAISE WARNING 'Unidade nao encontrada: {unid_s} (row {i}: {nome_s[:40]})';")
    lines.append(f'  ELSE')
    lines.append(f'    INSERT INTO utfprct.matriz_orc_estruturas')
    lines.append(f'      (configuracao_id, unidade_id, tipo_id, nome, sede_id, sala, responsavel_nome, responsavel_email, ativo)')
    lines.append(f'    VALUES (')
    lines.append(f'      cfg_id, unid_id,')
    lines.append(f"      1, '{nome_s}', {sede_val}, {sala_val}, {resp_nome}, {resp_email}, true")
    lines.append(f'    ) RETURNING id INTO est_id;')
    if attr_ids:
        vals = ', '.join(f'(est_id, {a})' for a in attr_ids)
        lines.append(f'    INSERT INTO utfprct.matriz_orc_estrutura_selecao (estrutura_id, atributo_id) VALUES')
        lines.append(f'      {vals};')
    lines.append(f'  END IF;')
    lines.append('')
    inserted += 1

lines.append('END $$;')

if errors:
    lines.append('')
    lines.append('-- LINHAS COM ERRO DE MAPEAMENTO (verifique manualmente):')
    for e in errors:
        lines.append(f'-- {e}')

out = r'C:\Users\arthu\OneDrive\AFN8N\github\af\matrizorcamentaria\importar_laboratorios.sql'
with open(out, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Arquivo gerado: {out}')
print(f'Laboratorios inseridos: {inserted}')
print(f'Erros de mapeamento: {len(errors)}')
for e in errors[:20]:
    print(' ', e)

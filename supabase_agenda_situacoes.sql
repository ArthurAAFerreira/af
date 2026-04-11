-- Tabela de situações do calendário de agendas (cores e rótulos personalizáveis, descrição fixa)
-- Rodar nos schemas: utfprld  e  desegct
-- Se a tabela já existir, o ALTER TABLE adiciona a coluna descricao se não existir.

-- === SCHEMA utfprld ===
CREATE TABLE IF NOT EXISTS utfprld.agenda_situacoes (
  chave        TEXT PRIMARY KEY,
  nome_display TEXT        NOT NULL,
  descricao    TEXT        NOT NULL DEFAULT '',
  cor_fundo    TEXT        NOT NULL DEFAULT '#246f85',
  cor_borda    TEXT        NOT NULL DEFAULT '#1b5161',
  cor_texto    TEXT        NOT NULL DEFAULT '#ffffff',
  icone        TEXT        NOT NULL DEFAULT 'fa-circle',
  ordem        SMALLINT    NOT NULL DEFAULT 0
);
ALTER TABLE utfprld.agenda_situacoes ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '';
ALTER TABLE utfprld.agenda_situacoes DISABLE ROW LEVEL SECURITY;

INSERT INTO utfprld.agenda_situacoes (chave, nome_display, descricao, cor_fundo, cor_borda, cor_texto, icone, ordem) VALUES
  ('finalizada',              'Finalizada',                    'Saídas com situação "Solicitação atendida e documentos preenchidos"',                         '#7e3aa9', '#5d2a7f', '#ffffff', 'fa-flag-checkered',     1),
  ('aguardando_finalizacao',  'Aguardando Finalização',        'Saídas com situação "Liberada pelo Disau" cuja saída já passou do dia e hora atual',          '#59647a', '#414a5d', '#ffffff', 'fa-circle-xmark',       2),
  ('liberada',                'Liberada',                      'Saídas com situação "Liberada pelo Disau"',                                                   '#12853b', '#0b6028', '#ffffff', 'fa-circle-check',       3),
  ('aguardando_aprovador',    'Aguardando Aprovador',          'Saídas com situação "Aguardando autorização do aprovador"',                                   '#2f5fc4', '#234b9a', '#ffffff', 'fa-clock',              4),
  ('aguardando_liberacao_deseg','Aguardando Liberação DESEG',  'Saídas com situação "Autorizada pelo aprovador"',                                             '#d08b00', '#945f00', '#ffffff', 'fa-circle-half-stroke', 5),
  ('em_andamento',            'Solicitação em andamento',      'Saídas com situação "Solicitação em andamento"',                                              '#246f85', '#1b5161', '#ffffff', 'fa-circle',             6)
ON CONFLICT (chave) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  icone     = EXCLUDED.icone,
  ordem     = EXCLUDED.ordem;

-- === SCHEMA desegct ===
CREATE TABLE IF NOT EXISTS desegct.agenda_situacoes (
  chave        TEXT PRIMARY KEY,
  nome_display TEXT        NOT NULL,
  descricao    TEXT        NOT NULL DEFAULT '',
  cor_fundo    TEXT        NOT NULL DEFAULT '#246f85',
  cor_borda    TEXT        NOT NULL DEFAULT '#1b5161',
  cor_texto    TEXT        NOT NULL DEFAULT '#ffffff',
  icone        TEXT        NOT NULL DEFAULT 'fa-circle',
  ordem        SMALLINT    NOT NULL DEFAULT 0
);
ALTER TABLE desegct.agenda_situacoes ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '';
ALTER TABLE desegct.agenda_situacoes DISABLE ROW LEVEL SECURITY;

INSERT INTO desegct.agenda_situacoes (chave, nome_display, descricao, cor_fundo, cor_borda, cor_texto, icone, ordem) VALUES
  ('finalizada',              'Finalizada',                    'Saídas com situação "Solicitação atendida e documentos preenchidos"',                         '#7e3aa9', '#5d2a7f', '#ffffff', 'fa-flag-checkered',     1),
  ('aguardando_finalizacao',  'Aguardando Finalização',        'Saídas com situação "Liberada pelo Disau" cuja saída já passou do dia e hora atual',          '#59647a', '#414a5d', '#ffffff', 'fa-circle-xmark',       2),
  ('liberada',                'Liberada',                      'Saídas com situação "Liberada pelo Disau"',                                                   '#12853b', '#0b6028', '#ffffff', 'fa-circle-check',       3),
  ('aguardando_aprovador',    'Aguardando Aprovador',          'Saídas com situação "Aguardando autorização do aprovador"',                                   '#2f5fc4', '#234b9a', '#ffffff', 'fa-clock',              4),
  ('aguardando_liberacao_deseg','Aguardando Liberação DESEG',  'Saídas com situação "Autorizada pelo aprovador"',                                             '#d08b00', '#945f00', '#ffffff', 'fa-circle-half-stroke', 5),
  ('em_andamento',            'Solicitação em andamento',      'Saídas com situação "Solicitação em andamento"',                                              '#246f85', '#1b5161', '#ffffff', 'fa-circle',             6)
ON CONFLICT (chave) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  icone     = EXCLUDED.icone,
  ordem     = EXCLUDED.ordem;

-- Limpar chaves antigas que não são mais usadas
DELETE FROM utfprld.agenda_situacoes WHERE chave IN ('realizada','autorizada','aguardando','outros');
DELETE FROM desegct.agenda_situacoes  WHERE chave IN ('realizada','autorizada','aguardando','outros');

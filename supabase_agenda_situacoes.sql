-- Tabela de situações do calendário de agendas (cores, ícones e nomes personalizáveis)
-- Rodar nos schemas: utfprld  e  desegct

-- === SCHEMA utfprld ===
CREATE TABLE IF NOT EXISTS utfprld.agenda_situacoes (
  chave        TEXT PRIMARY KEY,
  nome_display TEXT        NOT NULL,
  cor_fundo    TEXT        NOT NULL DEFAULT '#246f85',
  cor_borda    TEXT        NOT NULL DEFAULT '#1b5161',
  cor_texto    TEXT        NOT NULL DEFAULT '#ffffff',
  icone        TEXT        NOT NULL DEFAULT 'fa-circle',
  ordem        SMALLINT    NOT NULL DEFAULT 0
);

INSERT INTO utfprld.agenda_situacoes (chave, nome_display, cor_fundo, cor_borda, cor_texto, icone, ordem) VALUES
  ('liberada',   'Liberada (DISAU)',           '#12853b', '#0b6028', '#ffffff', 'fa-circle-check',      1),
  ('realizada',  'Realizada (sem finalizar)',  '#59647a', '#414a5d', '#ffffff', 'fa-circle-xmark',      2),
  ('finalizada', 'Finalizada',                '#7e3aa9', '#5d2a7f', '#ffffff', 'fa-flag-checkered',    3),
  ('autorizada', 'Autorizada pelo aprovador', '#d08b00', '#945f00', '#ffffff', 'fa-circle-half-stroke',4),
  ('aguardando', 'Aguardando aprovador',       '#2f5fc4', '#234b9a', '#ffffff', 'fa-clock',             5),
  ('outros',     'Outros',                    '#246f85', '#1b5161', '#ffffff', 'fa-circle',             6)
ON CONFLICT (chave) DO NOTHING;

-- === SCHEMA desegct ===
CREATE TABLE IF NOT EXISTS desegct.agenda_situacoes (
  chave        TEXT PRIMARY KEY,
  nome_display TEXT        NOT NULL,
  cor_fundo    TEXT        NOT NULL DEFAULT '#246f85',
  cor_borda    TEXT        NOT NULL DEFAULT '#1b5161',
  cor_texto    TEXT        NOT NULL DEFAULT '#ffffff',
  icone        TEXT        NOT NULL DEFAULT 'fa-circle',
  ordem        SMALLINT    NOT NULL DEFAULT 0
);

INSERT INTO desegct.agenda_situacoes (chave, nome_display, cor_fundo, cor_borda, cor_texto, icone, ordem) VALUES
  ('liberada',   'Liberada (DISAU)',           '#12853b', '#0b6028', '#ffffff', 'fa-circle-check',      1),
  ('realizada',  'Realizada (sem finalizar)',  '#59647a', '#414a5d', '#ffffff', 'fa-circle-xmark',      2),
  ('finalizada', 'Finalizada',                '#7e3aa9', '#5d2a7f', '#ffffff', 'fa-flag-checkered',    3),
  ('autorizada', 'Autorizada pelo aprovador', '#d08b00', '#945f00', '#ffffff', 'fa-circle-half-stroke',4),
  ('aguardando', 'Aguardando aprovador',       '#2f5fc4', '#234b9a', '#ffffff', 'fa-clock',             5),
  ('outros',     'Outros',                    '#246f85', '#1b5161', '#ffffff', 'fa-circle',             6)
ON CONFLICT (chave) DO NOTHING;

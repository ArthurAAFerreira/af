-- ============================================================
-- Agenda de Veículos DESEG · UTFPR-CT
-- Cadastros dinâmicos: motoristas, veículos, grupos e agendas
-- Execute no SQL Editor do Supabase — schema: desegct
-- ============================================================

-- Motoristas
CREATE TABLE IF NOT EXISTS desegct.agenda_motoristas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  matricula   TEXT,
  tipo        TEXT        NOT NULL DEFAULT 'habilitado'
                CHECK (tipo IN ('oficial','habilitado','externo')),
  observacoes TEXT,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grupos de motoristas
CREATE TABLE IF NOT EXISTS desegct.agenda_grupos_motoristas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  is_todos    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relação grupo ↔ motorista
CREATE TABLE IF NOT EXISTS desegct.agenda_grupo_motoristas_itens (
  grupo_id      UUID NOT NULL REFERENCES desegct.agenda_grupos_motoristas(id) ON DELETE CASCADE,
  motorista_id  UUID NOT NULL REFERENCES desegct.agenda_motoristas(id)        ON DELETE CASCADE,
  PRIMARY KEY (grupo_id, motorista_id)
);

-- Veículos
CREATE TABLE IF NOT EXISTS desegct.agenda_veiculos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  placa       TEXT        NOT NULL UNIQUE,
  descricao   TEXT,
  tipo        TEXT        NOT NULL DEFAULT 'passeio'
                CHECK (tipo IN ('passeio','especial','onibus','van','outro')),
  capacidade  INTEGER,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grupos de veículos
CREATE TABLE IF NOT EXISTS desegct.agenda_grupos_veiculos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  is_todos    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relação grupo ↔ veículo
CREATE TABLE IF NOT EXISTS desegct.agenda_grupo_veiculos_itens (
  grupo_id    UUID NOT NULL REFERENCES desegct.agenda_grupos_veiculos(id) ON DELETE CASCADE,
  veiculo_id  UUID NOT NULL REFERENCES desegct.agenda_veiculos(id)        ON DELETE CASCADE,
  PRIMARY KEY (grupo_id, veiculo_id)
);

-- Tipos / Agendas
CREATE TABLE IF NOT EXISTS desegct.agenda_tipos (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome                TEXT        NOT NULL,
  descricao           TEXT,
  grupo_motoristas_id UUID        REFERENCES desegct.agenda_grupos_motoristas(id) ON DELETE SET NULL,
  grupo_veiculos_id   UUID        REFERENCES desegct.agenda_grupos_veiculos(id)   ON DELETE SET NULL,
  cor                 TEXT        NOT NULL DEFAULT '#2f5fc4',
  ativo               BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_motoristas              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupos_motoristas        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupo_motoristas_itens   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_veiculos                 TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupos_veiculos          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupo_veiculos_itens     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_tipos                    TO anon, authenticated;

-- Seed: grupos padrão "Todos" (não deletáveis)
INSERT INTO desegct.agenda_grupos_motoristas (nome, descricao, is_todos)
SELECT 'Todos', 'Grupo padrão — inclui todos os motoristas', true
WHERE NOT EXISTS (SELECT 1 FROM desegct.agenda_grupos_motoristas WHERE is_todos = true);

INSERT INTO desegct.agenda_grupos_veiculos (nome, descricao, is_todos)
SELECT 'Todos', 'Grupo padrão — inclui todos os veículos', true
WHERE NOT EXISTS (SELECT 1 FROM desegct.agenda_grupos_veiculos WHERE is_todos = true);

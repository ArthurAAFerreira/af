-- ============================================================
-- Agenda de Veículos DESEG · UTFPR-CT — Setup v2 completo
-- Execute no SQL Editor do Supabase — schema: desegct
-- (as tabelas agenda_* ainda não existiam neste schema)
-- ============================================================

-- 1. Motoristas (sem coluna tipo; usa oficial + servidor)
CREATE TABLE IF NOT EXISTS desegct.agenda_motoristas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  matricula   TEXT,
  oficial     BOOLEAN     NOT NULL DEFAULT false,
  servidor    BOOLEAN     NOT NULL DEFAULT false,
  observacoes TEXT,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Grupos de motoristas
CREATE TABLE IF NOT EXISTS desegct.agenda_grupos_motoristas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  is_todos    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Relação grupo ↔ motorista
CREATE TABLE IF NOT EXISTS desegct.agenda_grupo_motoristas_itens (
  grupo_id     UUID NOT NULL REFERENCES desegct.agenda_grupos_motoristas(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES desegct.agenda_motoristas(id)        ON DELETE CASCADE,
  PRIMARY KEY (grupo_id, motorista_id)
);

-- 4. Veículos (sem coluna tipo; use grupos para classificar)
CREATE TABLE IF NOT EXISTS desegct.agenda_veiculos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  placa       TEXT        NOT NULL UNIQUE,
  descricao   TEXT,
  capacidade  INTEGER,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Grupos de veículos
CREATE TABLE IF NOT EXISTS desegct.agenda_grupos_veiculos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  is_todos    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Relação grupo ↔ veículo
CREATE TABLE IF NOT EXISTS desegct.agenda_grupo_veiculos_itens (
  grupo_id   UUID NOT NULL REFERENCES desegct.agenda_grupos_veiculos(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES desegct.agenda_veiculos(id)        ON DELETE CASCADE,
  PRIMARY KEY (grupo_id, veiculo_id)
);

-- 7. Tipos / Agendas
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

-- 8. Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_motoristas            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupos_motoristas      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupo_motoristas_itens TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_veiculos               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupos_veiculos        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_grupo_veiculos_itens   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON desegct.agenda_tipos                  TO anon, authenticated;

-- 9. Seed: grupos padrão "Todos"
INSERT INTO desegct.agenda_grupos_motoristas (nome, descricao, is_todos)
SELECT 'Todos', 'Grupo padrão — inclui todos os motoristas', true
WHERE NOT EXISTS (SELECT 1 FROM desegct.agenda_grupos_motoristas WHERE is_todos = true);

INSERT INTO desegct.agenda_grupos_veiculos (nome, descricao, is_todos)
SELECT 'Todos', 'Grupo padrão — inclui todos os veículos', true
WHERE NOT EXISTS (SELECT 1 FROM desegct.agenda_grupos_veiculos WHERE is_todos = true);

-- 10. View do calendário: mapear solicitacoes_veiculos → Evento
--     DROP primeiro pois já existe uma versão antiga com colunas diferentes
DROP VIEW IF EXISTS desegct.vw_agenda_eventos CASCADE;

CREATE VIEW desegct.vw_agenda_eventos AS
SELECT
  id::text                                                            AS id,
  numero_solicitacao,
  solicitante_nome,
  motoristas                                                          AS motorista_nome,
  veiculos                                                            AS veiculo_principal,
  veiculos,
  roteiro,
  CASE
    WHEN partida_data IS NOT NULL
    THEN (partida_data::text || 'T' || COALESCE(partida_hora::text, '00:00:00'))::timestamptz
    ELSE NULL
  END                                                                 AS inicio_previsto,
  CASE
    WHEN retorno_data IS NOT NULL
    THEN (retorno_data::text || 'T' || COALESCE(retorno_hora::text, '00:00:00'))::timestamptz
    WHEN chegada_data IS NOT NULL
    THEN (chegada_data::text || 'T' || COALESCE(chegada_hora::text, '00:00:00'))::timestamptz
    ELSE NULL
  END                                                                 AS fim_previsto,
  situacao,
  situacao                                                            AS situacao_normalizada,
  quantidade_passageiros
FROM desegct.solicitacoes_veiculos;

GRANT SELECT ON desegct.vw_agenda_eventos TO anon, authenticated;

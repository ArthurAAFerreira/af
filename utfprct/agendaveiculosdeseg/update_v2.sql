-- ============================================================
-- Agenda de Veículos DESEG · UTFPR-CT — Migração v2
-- Execute no SQL Editor do Supabase — schema: desegct
-- ============================================================

-- 1. agenda_motoristas: remover tipo, adicionar oficial e servidor
ALTER TABLE desegct.agenda_motoristas
  DROP COLUMN IF EXISTS tipo,
  ADD COLUMN IF NOT EXISTS oficial  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS servidor BOOLEAN NOT NULL DEFAULT false;

-- 2. agenda_veiculos: remover tipo
ALTER TABLE desegct.agenda_veiculos
  DROP COLUMN IF EXISTS tipo;

-- 3. View principal do calendário: adapte o FROM para a tabela de solicitações do CT
--    Substitua desegct.solicitacoes_veiculos pelo nome correto se for diferente
CREATE OR REPLACE VIEW desegct.vw_agenda_eventos AS
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

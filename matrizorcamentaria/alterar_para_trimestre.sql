-- ─── Migração: bimestre (1–6) → trimestre (1–4) ─────────────────────────────
-- Execute no Supabase SQL Editor. Apaga dados com período > 4 antes de alterar.

-- 1. Limpar dados fora do novo range (caso já tenha alguma entrada)
DELETE FROM utfprct.matriz_orc_cronograma_gastos  WHERE bimestre > 4;
DELETE FROM utfprct.matriz_orc_repasse_bimestral  WHERE bimestre > 4;
DELETE FROM utfprct.matriz_orc_repasse_item        WHERE bimestre > 4;

-- 2. Atualizar constraint de CHECK nas três tabelas

ALTER TABLE utfprct.matriz_orc_cronograma_gastos
  DROP CONSTRAINT IF EXISTS matriz_orc_cronograma_gastos_bimestre_check,
  ADD  CONSTRAINT matriz_orc_cronograma_gastos_bimestre_check CHECK (bimestre BETWEEN 1 AND 4);

ALTER TABLE utfprct.matriz_orc_repasse_bimestral
  DROP CONSTRAINT IF EXISTS matriz_orc_repasse_bimestral_bimestre_check,
  ADD  CONSTRAINT matriz_orc_repasse_bimestral_bimestre_check CHECK (bimestre BETWEEN 1 AND 4);

ALTER TABLE utfprct.matriz_orc_repasse_item
  DROP CONSTRAINT IF EXISTS matriz_orc_repasse_item_bimestre_check,
  ADD  CONSTRAINT matriz_orc_repasse_item_bimestre_check CHECK (bimestre BETWEEN 1 AND 4);

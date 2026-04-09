import { createClient } from '@supabase/supabase-js';
import type {
  Motorista, GrupoMotoristas, Veiculo, GrupoVeiculos, AgendaTipo, Evento,
  MotoristaPayload, VeiculoPayload, GrupoMotoristasPayload, GrupoVeiculosPayload,
  AgendaTipoPayload,
} from './types.ts';

const SUPABASE_URL      = 'https://wycjvjlhabiyhusupivx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y2p2amxoYWJpeWh1c3VwaXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjc2MzksImV4cCI6MjA3NDQwMzYzOX0.pFu4bfrsvZpr7D4bh3LhoDZuRetsUZO6p2MavMtfyv0';
export const SCHEMA = 'utfprld';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: SCHEMA },
});

function assertOk<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  if (!data)  throw new Error('Sem dados retornados');
  return data;
}

// ── Eventos do calendário ─────────────────────────────────────────────────────
export async function loadEventos(): Promise<Evento[]> {
  const { data, error } = await sb.from('vw_agenda_eventos').select('*').order('inicio_previsto');
  if (error) throw error;
  return (data ?? []) as Evento[];
}

// ── Agenda tipos ──────────────────────────────────────────────────────────────
export async function loadAgendaTipos(): Promise<AgendaTipo[]> {
  const { data, error } = await sb.from('agenda_tipos')
    .select(`
      *,
      grupo_motoristas:agenda_grupos_motoristas!grupo_motoristas_id (
        id, nome, is_todos,
        itens:agenda_grupo_motoristas_itens (
          motorista:agenda_motoristas (id, nome, matricula, tipo)
        )
      ),
      grupo_veiculos:agenda_grupos_veiculos!grupo_veiculos_id (
        id, nome, is_todos,
        itens:agenda_grupo_veiculos_itens (
          veiculo:agenda_veiculos (id, placa, tipo)
        )
      )
    `)
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as AgendaTipo[];
}

export async function loadAgendaTiposAll(): Promise<AgendaTipo[]> {
  const { data, error } = await sb.from('agenda_tipos').select('*').order('nome');
  if (error) throw error;
  return (data ?? []) as AgendaTipo[];
}

export async function upsertAgendaTipo(payload: AgendaTipoPayload): Promise<AgendaTipo> {
  const { id, ...rest } = payload;
  const { data, error } = id
    ? await sb.from('agenda_tipos').update(rest).eq('id', id).select()
    : await sb.from('agenda_tipos').insert(rest).select();
  return assertOk(data, error)[0] as AgendaTipo;
}

export async function deleteAgendaTipo(id: string): Promise<void> {
  const { error } = await sb.from('agenda_tipos').delete().eq('id', id);
  if (error) throw error;
}

// ── Motoristas ────────────────────────────────────────────────────────────────
export async function loadMotoristas(): Promise<Motorista[]> {
  const { data, error } = await sb.from('agenda_motoristas').select('*').order('nome');
  if (error) throw error;
  return (data ?? []) as Motorista[];
}

export async function upsertMotorista(payload: MotoristaPayload): Promise<Motorista> {
  const { id, ...rest } = payload;
  const { data, error } = id
    ? await sb.from('agenda_motoristas').update(rest).eq('id', id).select()
    : await sb.from('agenda_motoristas').insert(rest).select();
  return assertOk(data, error)[0] as Motorista;
}

export async function deleteMotorista(id: string): Promise<void> {
  const { error } = await sb.from('agenda_motoristas').delete().eq('id', id);
  if (error) throw error;
}

// ── Grupos de motoristas ──────────────────────────────────────────────────────
export async function loadGruposMotoristas(): Promise<GrupoMotoristas[]> {
  const { data, error } = await sb.from('agenda_grupos_motoristas')
    .select('*, itens:agenda_grupo_motoristas_itens(motorista_id)')
    .order('nome');
  if (error) throw error;
  return (data ?? []) as GrupoMotoristas[];
}

export async function upsertGrupoMotoristas(
  payload: GrupoMotoristasPayload,
  membros: string[],
): Promise<string> {
  const row = { nome: payload.nome, descricao: payload.descricao ?? null };
  let id = payload.id;

  if (!id) {
    const { data, error } = await sb.from('agenda_grupos_motoristas').insert(row).select();
    assertOk(data, error);
    id = (data as { id: string }[])[0].id;
  } else {
    const { error } = await sb.from('agenda_grupos_motoristas').update(row).eq('id', id);
    if (error) throw error;
    await sb.from('agenda_grupo_motoristas_itens').delete().eq('grupo_id', id);
  }

  if (membros.length > 0) {
    const itens = membros.map(mid => ({ grupo_id: id as string, motorista_id: mid }));
    const { error } = await sb.from('agenda_grupo_motoristas_itens').insert(itens);
    if (error) throw error;
  }
  return id as string;
}

export async function deleteGrupoMotoristas(id: string): Promise<void> {
  const { error } = await sb.from('agenda_grupos_motoristas').delete().eq('id', id);
  if (error) throw error;
}

export async function loadGrupoMotoristasItens(grupoId: string): Promise<string[]> {
  const { data, error } = await sb.from('agenda_grupo_motoristas_itens')
    .select('motorista_id').eq('grupo_id', grupoId);
  if (error) throw error;
  return ((data ?? []) as { motorista_id: string }[]).map(r => r.motorista_id);
}

// ── Veículos ──────────────────────────────────────────────────────────────────
export async function loadVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await sb.from('agenda_veiculos').select('*').order('placa');
  if (error) throw error;
  return (data ?? []) as Veiculo[];
}

export async function upsertVeiculo(payload: VeiculoPayload): Promise<Veiculo> {
  const { id, ...rest } = payload;
  const { data, error } = id
    ? await sb.from('agenda_veiculos').update(rest).eq('id', id).select()
    : await sb.from('agenda_veiculos').insert(rest).select();
  return assertOk(data, error)[0] as Veiculo;
}

export async function deleteVeiculo(id: string): Promise<void> {
  const { error } = await sb.from('agenda_veiculos').delete().eq('id', id);
  if (error) throw error;
}

// ── Grupos de veículos ────────────────────────────────────────────────────────
export async function loadGruposVeiculos(): Promise<GrupoVeiculos[]> {
  const { data, error } = await sb.from('agenda_grupos_veiculos')
    .select('*, itens:agenda_grupo_veiculos_itens(veiculo_id)')
    .order('nome');
  if (error) throw error;
  return (data ?? []) as GrupoVeiculos[];
}

export async function upsertGrupoVeiculos(
  payload: GrupoVeiculosPayload,
  membros: string[],
): Promise<string> {
  const row = { nome: payload.nome, descricao: payload.descricao ?? null };
  let id = payload.id;

  if (!id) {
    const { data, error } = await sb.from('agenda_grupos_veiculos').insert(row).select();
    assertOk(data, error);
    id = (data as { id: string }[])[0].id;
  } else {
    const { error } = await sb.from('agenda_grupos_veiculos').update(row).eq('id', id);
    if (error) throw error;
    await sb.from('agenda_grupo_veiculos_itens').delete().eq('grupo_id', id);
  }

  if (membros.length > 0) {
    const itens = membros.map(vid => ({ grupo_id: id as string, veiculo_id: vid }));
    const { error } = await sb.from('agenda_grupo_veiculos_itens').insert(itens);
    if (error) throw error;
  }
  return id as string;
}

export async function deleteGrupoVeiculos(id: string): Promise<void> {
  const { error } = await sb.from('agenda_grupos_veiculos').delete().eq('id', id);
  if (error) throw error;
}

export async function loadGrupoVeiculosItens(grupoId: string): Promise<string[]> {
  const { data, error } = await sb.from('agenda_grupo_veiculos_itens')
    .select('veiculo_id').eq('grupo_id', grupoId);
  if (error) throw error;
  return ((data ?? []) as { veiculo_id: string }[]).map(r => r.veiculo_id);
}

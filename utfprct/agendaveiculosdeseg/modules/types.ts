// ── Motoristas ────────────────────────────────────────────────────────────────
export type TipoMotorista = 'oficial' | 'habilitado' | 'externo';

export interface Motorista {
  id:          string;
  nome:        string;
  matricula:   string | null;
  tipo:        TipoMotorista;
  observacoes: string | null;
  ativo:       boolean;
  created_at:  string;
}

// ── Grupos de motoristas ──────────────────────────────────────────────────────
export interface GrupoMotoristas {
  id:        string;
  nome:      string;
  descricao: string | null;
  is_todos:  boolean;
  created_at: string;
  itens?:    { motorista_id: string }[];
}

export interface GrupoMotoristasDetalhe extends Omit<GrupoMotoristas, 'itens'> {
  itens: { motorista: Pick<Motorista, 'id' | 'nome' | 'matricula' | 'tipo'> }[];
}

// ── Veículos ──────────────────────────────────────────────────────────────────
export type TipoVeiculo = 'passeio' | 'especial' | 'onibus' | 'van' | 'outro';

export interface Veiculo {
  id:         string;
  placa:      string;
  descricao:  string | null;
  tipo:       TipoVeiculo;
  capacidade: number | null;
  ativo:      boolean;
  created_at: string;
}

// ── Grupos de veículos ────────────────────────────────────────────────────────
export interface GrupoVeiculos {
  id:        string;
  nome:      string;
  descricao: string | null;
  is_todos:  boolean;
  created_at: string;
  itens?:    { veiculo_id: string }[];
}

export interface GrupoVeiculosDetalhe extends Omit<GrupoVeiculos, 'itens'> {
  itens: { veiculo: Pick<Veiculo, 'id' | 'placa' | 'tipo'> }[];
}

// ── Agenda tipos ──────────────────────────────────────────────────────────────
export interface AgendaTipo {
  id:                  string;
  nome:                string;
  descricao:           string | null;
  grupo_motoristas_id: string | null;
  grupo_veiculos_id:   string | null;
  cor:                 string;
  ativo:               boolean;
  created_at:          string;
  grupo_motoristas?:   GrupoMotoristasDetalhe | null;
  grupo_veiculos?:     GrupoVeiculosDetalhe   | null;
}

// ── Evento do calendário ──────────────────────────────────────────────────────
export interface Evento {
  id?:                     string;
  numero_solicitacao?:     string;
  solicitante_nome?:       string;
  motorista_nome?:         string;
  veiculo_principal?:      string;
  veiculos?:               string;
  roteiro?:                string;
  inicio_previsto?:        string;
  fim_previsto?:           string;
  situacao?:               string;
  situacao_normalizada?:   string;
  quantidade_passageiros?: number;
  [key: string]: unknown;
}

// ── Payloads de upsert ────────────────────────────────────────────────────────
export type MotoristaPayload = Omit<Motorista, 'created_at' | 'id'> & { id?: string };
export type VeiculoPayload   = Omit<Veiculo,   'created_at' | 'id'> & { id?: string };

export interface GrupoMotoristasPayload {
  id?:      string;
  nome:     string;
  descricao?: string | null;
}

export interface GrupoVeiculosPayload {
  id?:      string;
  nome:     string;
  descricao?: string | null;
}

export interface AgendaTipoPayload {
  id?:                  string;
  nome:                 string;
  descricao?:           string | null;
  grupo_motoristas_id?: string | null;
  grupo_veiculos_id?:   string | null;
  cor:                  string;
  ativo:                boolean;
}

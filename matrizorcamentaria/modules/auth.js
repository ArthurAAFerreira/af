// =============================================================================
// auth.js — Controle de acesso por senha
// Para alterar senhas ou permissões, edite SENHAS abaixo.
// Permissões disponíveis: 'configuracao', 'unidades', 'v1', 'v2', 'v3', 'estruturas', 'simulacoes', '*'
// =============================================================================
export const SENHAS = {
  '154358':      { perms: ['simulacoes'],                               label: 'Simulações' },
  '154358dirge': { perms: ['configuracao'],                            label: 'Configuração' },
  'dirpladlu':   { perms: ['configuracao', 'simulacoes', 'estruturas'], label: 'Planejamento/DLU' },
  'federer':     { perms: ['*'],                                        label: 'Acesso Total' },
};

const KEY = 'matriz_orc_auth';

export function unlock(senha) {
  const entry = SENHAS[senha];
  if (!entry) return null;
  sessionStorage.setItem(KEY, JSON.stringify({ perms: entry.perms, label: entry.label }));
  return entry.label;
}

export function lock() {
  sessionStorage.removeItem(KEY);
}

export function getAuth() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || { perms: [], label: null }; }
  catch { return { perms: [], label: null }; }
}

export function canEdit(perm) {
  const { perms } = getAuth();
  return perms.includes('*') || perms.includes(perm);
}

export function getLabel() {
  return getAuth().label;
}

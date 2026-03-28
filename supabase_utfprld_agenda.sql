create schema if not exists utfprld;

create table if not exists utfprld.solicitacoes_veiculos (
  id bigserial primary key,
  numero_solicitacao text not null,
  solicitante_nome text,
  quantidade_passageiros integer,
  roteiro text,
  partida_data date,
  partida_hora time,
  retorno_data date,
  retorno_hora time,
  chegada_data date,
  chegada_hora time,
  situacao text not null,
  data_situacao date,
  veiculos text,
  motoristas text,
  compartilhadas text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists utfprld.motoristas_oficiais (
  id bigserial primary key,
  nome_motorista text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_motoristas_oficiais_nome_normalizado
  on utfprld.motoristas_oficiais (lower(trim(nome_motorista)));

insert into utfprld.motoristas_oficiais (nome_motorista, ativo)
values ('Celso Crespim - 02495180', true)
on conflict do nothing;

create or replace view utfprld.vw_motoristas_oficiais as
select
  id,
  nome_motorista,
  ativo,
  created_at
from utfprld.motoristas_oficiais;

create table if not exists utfprld.veiculos_cadastrados (
  id bigserial primary key,
  veiculo_referencia text not null,
  tipo_veiculo text not null default '',
  campus text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table utfprld.veiculos_cadastrados
  add column if not exists tipo_veiculo text not null default '';

create unique index if not exists ux_veiculos_cadastrados_referencia_normalizada
  on utfprld.veiculos_cadastrados (lower(trim(veiculo_referencia)));

insert into utfprld.veiculos_cadastrados (veiculo_referencia, tipo_veiculo, campus, ativo)
values
  ('AFP2721-Kombi Aberta/Vw', 'Kombi Aberta', '', true),
  ('AOL8790-Astra/Gm', 'Passeio', '', true),
  ('ASH1276-Livina/Nissan', 'Passeio', '', true),
  ('ATM7929-Focus/Ford', 'Passeio', '', true),
  ('AVA9214-Sprinter/Mercedes', 'Van', '', true),
  ('AYC2148-Amarok/Vw', 'Picape', '', true),
  ('AYF6659-Onibus/Volvo Marco Polo', 'Onibus', '', true),
  ('JGC9671-Corolla/Toyota', 'Passeio', '', true),
  ('MHW1712-Montana Ls/Chevrolet', 'Picape', '', true),
  ('MIN1174-Uno/Fiat', 'Passeio', '', true)
on conflict do nothing;

update utfprld.veiculos_cadastrados
set tipo_veiculo = case lower(trim(veiculo_referencia))
  when lower('AFP2721-Kombi Aberta/Vw') then 'Kombi Aberta'
  when lower('AOL8790-Astra/Gm') then 'Passeio'
  when lower('ASH1276-Livina/Nissan') then 'Passeio'
  when lower('ATM7929-Focus/Ford') then 'Passeio'
  when lower('AVA9214-Sprinter/Mercedes') then 'Van'
  when lower('AYC2148-Amarok/Vw') then 'Picape'
  when lower('AYF6659-Onibus/Volvo Marco Polo') then 'Onibus'
  when lower('JGC9671-Corolla/Toyota') then 'Passeio'
  when lower('MHW1712-Montana Ls/Chevrolet') then 'Picape'
  when lower('MIN1174-Uno/Fiat') then 'Passeio'
  else tipo_veiculo
end
where lower(trim(veiculo_referencia)) in (
  lower('AFP2721-Kombi Aberta/Vw'),
  lower('AOL8790-Astra/Gm'),
  lower('ASH1276-Livina/Nissan'),
  lower('ATM7929-Focus/Ford'),
  lower('AVA9214-Sprinter/Mercedes'),
  lower('AYC2148-Amarok/Vw'),
  lower('AYF6659-Onibus/Volvo Marco Polo'),
  lower('JGC9671-Corolla/Toyota'),
  lower('MHW1712-Montana Ls/Chevrolet'),
  lower('MIN1174-Uno/Fiat')
);

create or replace view utfprld.vw_veiculos_cadastrados as
select
  id,
  veiculo_referencia,
  campus,
  ativo,
  created_at,
  tipo_veiculo
from utfprld.veiculos_cadastrados;

create unique index if not exists ux_solicitacoes_veiculos_numero
  on utfprld.solicitacoes_veiculos (numero_solicitacao);

create index if not exists ix_solicitacoes_veiculos_partida
  on utfprld.solicitacoes_veiculos (partida_data, partida_hora);

create index if not exists ix_solicitacoes_veiculos_situacao
  on utfprld.solicitacoes_veiculos (situacao);

create or replace function utfprld.normalize_situacao(input_text text)
returns text
language sql
immutable
as $$
  select trim(
    translate(
      lower(coalesce(input_text, '')),
      'áàãâäéèêëíìîïóòõôöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    )
  );
$$;

create or replace function utfprld.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at on utfprld.solicitacoes_veiculos;
create trigger trg_touch_updated_at
before update on utfprld.solicitacoes_veiculos
for each row
execute function utfprld.touch_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'utfprld'
      and table_name = 'vw_agenda_eventos'
      and column_name = 'agenda_motorista'
  ) then
    execute 'alter view utfprld.vw_agenda_eventos rename column agenda_motorista to motorista_oficial';
  end if;
exception
  when undefined_table then
    null;
end;
$$;

create or replace view utfprld.vw_agenda_eventos as
with base as (
  select
    s.id,
    s.numero_solicitacao,
    s.solicitante_nome,
    s.quantidade_passageiros,
    s.roteiro,
    s.situacao,
    utfprld.normalize_situacao(s.situacao) as situacao_normalizada,
    s.veiculos,
    s.motoristas,
    nullif(trim((regexp_split_to_array(coalesce(s.veiculos, ''), '\\s*[;,/]\\s*'))[1]), '') as veiculo_principal,
    nullif(trim((regexp_split_to_array(coalesce(s.motoristas, ''), '\\s*[;,/]\\s*'))[1]), '') as motorista_nome,
    (s.partida_data + coalesce(s.partida_hora, time '00:00')) as inicio_previsto,
    coalesce(
      (s.retorno_data + coalesce(s.retorno_hora, time '23:59')),
      (s.partida_data + coalesce(s.partida_hora, time '00:00') + interval '1 hour')
    ) as fim_previsto
  from utfprld.solicitacoes_veiculos s
  where s.partida_data is not null
), filtrada as (
  select *
  from base
  where situacao_normalizada not like 'cancelada pelo solicitante%'
    and situacao_normalizada not like 'devolvida pelo disau%'
    and situacao_normalizada not like 'cancelada pelo disau%'
)
select
  f.id,
  f.numero_solicitacao,
  f.solicitante_nome,
  f.quantidade_passageiros,
  f.roteiro,
  f.situacao,
  f.situacao_normalizada,
  f.veiculos,
  f.motoristas,
  coalesce(f.veiculo_principal, 'Sem veículo') as veiculo_principal,
  coalesce(f.motorista_nome, 'Não informado') as motorista_nome,
  f.inicio_previsto,
  f.fim_previsto,
  exists (
    select 1
    from utfprld.vw_motoristas_oficiais mo
    where mo.ativo
      and lower(trim(mo.nome_motorista)) = lower(trim(coalesce(f.motorista_nome, '')))
  ) as motorista_oficial,
  (
    coalesce(f.veiculos, '') <> ''
    and coalesce(f.veiculos, '') !~* 'amarok'
    and coalesce(f.veiculos, '') !~* 'onibus|ônibus'
  ) as agenda_passeio_ocupado,
  (coalesce(f.veiculos, '') ~* 'amarok') as agenda_amarok,
  (coalesce(f.veiculos, '') ~* 'onibus|ônibus') as agenda_previa_onibus
from filtrada f;

create or replace view utfprld.vw_relatorio_veiculos as
select
  veiculo_principal as veiculo_referencia,
  count(*)::integer as total_saidas,
  round(sum(extract(epoch from (fim_previsto - inicio_previsto)) / 3600.0)::numeric, 2) as total_horas_reservadas
from utfprld.vw_agenda_eventos
group by veiculo_principal
order by veiculo_principal;

create or replace view utfprld.vw_relatorio_motoristas as
select
  motorista_nome,
  count(*)::integer as total_agendamentos,
  count(distinct date(inicio_previsto))::integer as total_dias_agendados,
  bool_or(motorista_oficial) as motorista_oficial
from utfprld.vw_agenda_eventos
group by motorista_nome
order by total_agendamentos desc, motorista_nome;

create or replace view utfprld.vw_solicitacoes_aguardando_liberacao as
select
  numero_solicitacao,
  solicitante_nome,
  inicio_previsto,
  fim_previsto,
  veiculo_principal,
  motorista_nome,
  situacao,
  situacao_normalizada
from utfprld.vw_agenda_eventos
where situacao_normalizada in (
  'aguardando autorizacao do aprovador',
  'autorizada pelo aprovador'
)
order by inicio_previsto;

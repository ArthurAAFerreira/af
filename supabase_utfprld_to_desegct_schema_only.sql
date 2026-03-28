-- Clona somente a estrutura das tabelas do schema utfprld para o schema desegct (sem dados)

create schema if not exists desegct;

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'utfprld'
    order by tablename
  loop
    execute format(
      'create table if not exists desegct.%I (like utfprld.%I including defaults including constraints including generated including identity including indexes including storage including comments)',
      r.tablename,
      r.tablename
    );
  end loop;
end
$$;

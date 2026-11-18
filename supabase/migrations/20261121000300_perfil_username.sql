-- Hive Break · Username do perfil (docs/PERFIL.md, seção 9)
-- Identificador público e estável para a rota /@username: minúsculo, só
-- letras, números e "_", de 3 a 20 caracteres. Gerado a partir do apelido
-- (ou do nome do Google, no primeiro cadastro) e editável pelo dono em
-- /perfil/config. Nunca é reaproveitado de outra pessoa (fica único para
-- sempre, mesmo que a conta troque de apelido).

create extension if not exists unaccent;

alter table public.profiles add column username text;

create function public.slug_username(p_texto text) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select left(regexp_replace(lower(unaccent(coalesce(p_texto, ''))), '[^a-z0-9_]+', '', 'g'), 20)
$$;

-- Gera um username livre a partir de um texto de referência (apelido ou
-- nome do Google). Acrescenta um número quando o nome já está em uso.
create function public.gerar_username(p_texto text) returns text
language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  base text := public.slug_username(p_texto);
  tentativa text;
  sufixo int := 0;
begin
  if length(base) < 3 then
    base := 'hiver';
  end if;
  loop
    tentativa := case when sufixo = 0 then base else left(base, 20 - length(sufixo::text)) || sufixo end;
    exit when not exists (select 1 from public.profiles where username = tentativa);
    sufixo := sufixo + 1;
  end loop;
  return tentativa;
end;
$$;

-- Backfill: quem já tinha conta ganha um username, na ordem do cadastro.
do $$
declare p record;
begin
  for p in select id, apelido, nome from public.profiles where username is null order by criado_em loop
    update public.profiles set username = public.gerar_username(coalesce(p.apelido, p.nome, 'hiver')) where id = p.id;
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_username_formato check (username ~ '^[a-z0-9_]{3,20}$'),
  add constraint profiles_username_unico unique (username),
  alter column username set not null;

-- Conta nova já nasce com username (a partir do nome do Google).
create or replace function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nome, avatar_url, codigo_convite, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    public.gerar_codigo_convite(),
    public.gerar_username(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'hiver'))
  );
  insert into public.streaks (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

-- O dono pode trocar o próprio username (mesmo formato, continua único).
grant update (username) on public.profiles to authenticated;

-- A view pública ganha o username (para os links /@username) e passa a
-- valer também para quem não está logado: é a base do perfil público
-- (seção 6 do docs/PERFIL.md). Continua sem nenhum dado de saúde.
create or replace view public.perfis_publicos with (security_invoker = false) as
  select id, apelido, avatar_url, divisao_atual, nivel_atual, username, criado_em
  from public.profiles
  where onboarding_concluido_em is not null;
grant select on public.perfis_publicos to anon, authenticated;

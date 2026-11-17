-- Nunca entra lead duplicado no CRM.
-- Antes só existia um índice único no telefone escrito exatamente igual, que deixava passar
-- o mesmo número com outra formatação ("(41) 99999-0000" x "5541999990000"), com ou sem o 9,
-- ou repetido no campo Telefone 2.
--
-- Regra nova (vale para a Central, importações e n8n):
-- 1. Telefone: compara DDD + últimos 8 dígitos dos dois campos (Telefone e Telefone 2)
--    com os dois campos de todos os outros leads.
-- 2. Lead sem telefone: não pode repetir o nome da barbearia na mesma cidade
--    (ignorando acentos, maiúsculas e pontuação).
-- Leads diferentes da mesma empresa com números diferentes (ex.: contatos de uma escola) continuam permitidos.

create or replace function public.lead_chave_telefone(p text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when length(x) >= 12 and left(x, 2) = '55' then substr(x, 3, 2) || right(x, 8)
    when length(x) in (10, 11) then left(x, 2) || right(x, 8)
    when length(x) >= 8 then right(x, 8)
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) d;
$$;

create or replace function public.lead_chave_nome(p text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select nullif(lower(regexp_replace(
    translate(coalesce(p, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                               'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^a-zA-Z0-9]', '', 'g')), '');
$$;

create or replace function public.leads_bloqueia_duplicado()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  k1 text := public.lead_chave_telefone(new.telefone);
  k2 text := public.lead_chave_telefone(new.telefone_2);
  outro record;
begin
  if k1 is not null or k2 is not null then
    select l.nome_barbearia, l.cidade, l.status into outro
    from public.leads l
    where l.id <> new.id
      and (public.lead_chave_telefone(l.telefone) in (k1, k2)
        or public.lead_chave_telefone(l.telefone_2) in (k1, k2))
    limit 1;
    if found then
      raise exception 'Lead duplicado: esse telefone já está no lead "%"%.',
        outro.nome_barbearia, coalesce(' (' || outro.cidade || ')', '')
        using errcode = '23505';
    end if;
  elsif public.lead_chave_nome(new.nome_barbearia) is not null then
    select l.nome_barbearia, l.cidade into outro
    from public.leads l
    where l.id <> new.id
      and public.lead_chave_nome(l.nome_barbearia) = public.lead_chave_nome(new.nome_barbearia)
      and coalesce(public.lead_chave_nome(l.cidade), '') = coalesce(public.lead_chave_nome(new.cidade), '')
    limit 1;
    if found then
      raise exception 'Lead duplicado: já existe "%"% no CRM.',
        outro.nome_barbearia, coalesce(' em ' || outro.cidade, '')
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_bloqueia_duplicado on public.leads;
create trigger trg_leads_bloqueia_duplicado
  before insert or update of telefone, telefone_2, nome_barbearia, cidade on public.leads
  for each row execute function public.leads_bloqueia_duplicado();

create index if not exists leads_chave_telefone_idx on public.leads (public.lead_chave_telefone(telefone));
create index if not exists leads_chave_telefone2_idx on public.leads (public.lead_chave_telefone(telefone_2));

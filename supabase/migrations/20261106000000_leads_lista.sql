-- De qual lista (safra de busca) o lead veio. Aparece e filtra na aba Leads da Central.

alter table public.leads add column if not exists lista text;

update public.leads set lista = 'Curitiba (out/26)'
where lista is null and criado_em < '2026-10-20';

update public.leads set lista = 'Região Metropolitana (nov/26)'
where lista is null and notas like '%Safra Região Metropolitana (06/11)%';

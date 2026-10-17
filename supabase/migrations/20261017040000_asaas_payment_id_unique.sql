-- O webhook grava com upsert(onConflict: asaas_payment_id); o índice parcial
-- (where asaas_payment_id is not null) não serve pro ON CONFLICT.
-- Constraint unique normal aceita vários nulos, então tem o mesmo efeito.
alter table public.asaas add constraint asaas_asaas_payment_id_key unique (asaas_payment_id);

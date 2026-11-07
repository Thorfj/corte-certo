-- Os roteiros de parceria com escolas ainda citavam o preço antigo (R$ 69).
-- O plano custa R$ 67/mês (ver 20261106010000_preco_plano_67.sql).
update public.mensagens_prospeccao
   set texto = regexp_replace(texto, 'R\$ ?69', 'R$ 67', 'g')
 where texto ~ 'R\$ ?69';

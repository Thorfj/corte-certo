# E-mails do Supabase em português

Cole cada modelo em **Supabase → Authentication → Emails → Templates**. Em cada um, troque o **Subject** e cole o arquivo inteiro em **Body (Source)**.

| Modelo no Supabase | Assunto (Subject) | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu e-mail no Barbozap | `1-confirmar-cadastro.html` |
| Invite user | Você foi convidado para o Barbozap | `2-convite.html` |
| Magic Link | Seu link de acesso ao Barbozap | `3-link-de-acesso.html` |
| Change Email Address | Confirme seu novo e-mail no Barbozap | `4-troca-de-email.html` |
| Reset Password | Crie uma nova senha no Barbozap | `5-redefinir-senha.html` |
| Reauthentication | Seu código de confirmação do Barbozap | `6-codigo-de-confirmacao.html` |

O que mais importa é o **Reset Password**, usado pelo "Esqueci minha senha" do login do CRM, que manda para `/app/nova-senha/`. A confirmação de cadastro está desligada no projeto, então o "Confirm signup" só é usado se ela for ligada.

Em **Authentication → URL Configuration**:
- **Site URL:** `https://barbozap.com.br`
- **Redirect URLs:** `https://barbozap.com.br/**`

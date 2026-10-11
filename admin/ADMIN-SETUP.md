# Painel da Noca Doces — instalação (uma vez só)

O painel fica em `admin/admin.html` (ex.: `https://SEU-USUARIO.github.io/Nocadoces/admin/admin.html`).
A cliente entra com e-mail e senha e edita o banner de promoção e o cardápio (nomes, descrições, preços, ordem, visibilidade).

## 1. Criar o projeto no Supabase
1. Crie uma conta grátis em https://supabase.com e clique em **New project**.
2. Anote a senha do banco (não será usada no site) e espere o projeto ficar pronto.

## 2. Criar as tabelas
1. Abra o arquivo `supabase.sql` e troque `TROQUE-PELO-EMAIL-DA-CLIENTE@exemplo.com` pelo e-mail real da cliente.
   Só esse e-mail poderá alterar dados, mesmo que alguém consiga criar outra conta.
2. No Supabase: **SQL Editor → New query**, cole o conteúdo inteiro e clique em **Run**. Rode uma única vez.

## 3. Criar o login da cliente
1. **Authentication → Users → Add user → Create new user**.
2. Informe o mesmo e-mail e uma senha forte. Marque **Auto Confirm User**.
3. Em **Authentication → Sign In / Providers** (ou *Settings*), desative **Allow new users to sign up**.

## 4. Conectar o site
1. **Project Settings → API** (ou *Connect*): copie a **Project URL** e a chave **anon / publishable**.
2. Cole no `config.js` (na raiz do projeto, fora da pasta `admin`) os valores de `url` e `chave`.
   Nunca use a chave `service_role` neste arquivo.

## 5. Publicar
Envie para o GitHub a estrutura inteira: na raiz `index.html`, `style.css`, `script.js`, `config.js` e, dentro da pasta `admin/`, `admin.html`, `admin.css`, `admin.js` (o `supabase.sql` e este guia são opcionais).
Depois acesse `/admin/admin.html`, entre e teste uma alteração.

## Observações
- Se o banco ficar fora do ar, o site continua mostrando o cardápio que está escrito no `index.html`.
- Projetos gratuitos do Supabase podem ser pausados após um período sem uso. Os acessos ao site contam como uso, mas confira a política atual no painel do Supabase.
- A galeria de fotos ainda não é editável pelo painel (próxima etapa).

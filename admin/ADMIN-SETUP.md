# Painel da Noca Doces — instalação (uma vez só)

O painel fica em `admin/admin.html` (ex.: `https://SEU-USUARIO.github.io/Nocadoces/admin/admin.html`).
A cliente entra com e-mail e senha e edita o banner de promoção e o cardápio (nomes, descrições, preços, ordem, visibilidade).

## 1. Criar o projeto no Supabase
1. Crie uma conta grátis em https://supabase.com e clique em **New project**.
2. Anote a senha do banco (não será usada no site) e espere o projeto ficar pronto.

## 2. Criar as tabelas
1. Abra o arquivo `supabase.sql` e troque `TROQUE-PELO-EMAIL-DA-CLIENTE@exemplo.com` pelo e-mail real da cliente.
   Só esse e-mail poderá alterar dados, mesmo que alguém consiga criar outra conta.
2. No Supabase: **SQL Editor → New query**, cole o conteúdo inteiro e clique em **Run**. Pode rodar de novo quando houver atualização.

## 3. Criar o login da cliente
1. **Authentication → Users → Add user → Create new user**.
2. Informe o mesmo e-mail e uma senha forte. Marque **Auto Confirm User**.
3. Em **Authentication → Sign In / Providers** (ou *Settings*), desative **Allow new users to sign up**.

## 4. Conectar o site
1. **Project Settings → API** (ou *Connect*): copie a **Project URL** e a chave **anon / publishable**.
2. Cole no `config.js` (na raiz do projeto, fora da pasta `admin`) os valores de `url` e `chave`.
   Nunca use a chave `service_role` neste arquivo.

## 5. Publicar
Envie para o GitHub a estrutura inteira: na raiz `index.html` e `config.js` e, dentro da pasta `admin/`, o `admin.html` (o `supabase.sql` e este guia são opcionais; o `index.html` e o `admin.html` já trazem o CSS e o JavaScript dentro).
Depois acesse `/admin/admin.html`, entre e teste uma alteração.

## Atualização (feedbacks, novas versões)
O `supabase.sql` é reexecutável: se já instalou antes, rode o arquivo de novo no **SQL Editor** para criar a tabela de feedbacks e outras novidades, sem duplicar o cardápio.
Depois publique o `index.html` e a pasta `admin/`, abra a aba **Feedbacks** do painel e cadastre os comentários. Enquanto não houver nenhum cadastrado, o site mostra depoimentos de exemplo.

## Atualização do novo painel (Pedidos, Estoque, Financeiro, Relatórios, Clientes, Configurações)
1. No **SQL Editor** do Supabase, rode o arquivo `supabase-painel.sql` (pode rodar de novo sem duplicar nada).
2. Publique no GitHub: `script.js` (raiz) e `admin/admin.html`.
3. Entre no painel: o menu lateral mostra todas as seções. Os pedidos enviados pelo carrinho do site passam a aparecer em **Pedidos**.
4. O número de WhatsApp dos pedidos pode ser trocado em **Configurações** (o link `wa.me` fixo do `index.html` não muda sozinho).

## Observações
- Se o banco ficar fora do ar, o site continua mostrando o cardápio que está escrito no `index.html`.
- Projetos gratuitos do Supabase podem ser pausados após um período sem uso. Os acessos ao site contam como uso, mas confira a política atual no painel do Supabase.
- A galeria de fotos ainda não é editável pelo painel (próxima etapa).

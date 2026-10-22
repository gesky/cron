# Cron Web Studio · Setup

Site estático (GitHub Pages) + Firebase gratuito (Firestore e Authentication, sem Storage).

## 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e crie um projeto (ex.: `cron-web-studio`). Pode desativar o Google Analytics.
2. **Firestore Database** > Criar banco de dados > modo de produção > região `southamerica-east1` (São Paulo).
3. **Authentication** > Começar > Método de login > ative **E-mail/senha**.
4. **Configurações do projeto** (engrenagem) > Seus apps > ícone `</>` (Web) > registre o app (sem Hosting).
5. Copie o objeto `firebaseConfig` e cole os valores em `js/firebase-config.js`, no lugar de `COLE_AQUI`.

> As chaves do Firebase web podem ficar públicas no código. Quem protege os dados são as regras do passo 2.

## 2. Publicar as regras de segurança

Firestore Database > aba **Regras** > apague o conteúdo e cole todo o arquivo `firestore.rules` > **Publicar**.

O que elas fazem:
- **projects**: qualquer visitante lê só os publicados; só o admin cria, edita e exclui.
- **leads**: qualquer visitante pode enviar (com consentimento LGPD e campos validados); só o admin lê, edita e exclui.
- **admins**: lista de quem pode entrar no painel.

## 3. Criar o seu acesso de admin

1. Authentication > Usuários > **Adicionar usuário** com seu e-mail e uma senha forte.
2. Copie o **UID** que aparece na lista.
3. Firestore > **Iniciar coleção** > ID `admins` > ID do documento = **o seu UID** > adicione um campo qualquer (ex.: `email` = seu e-mail) > Salvar.

Pronto: `seusite/admin.html` libera o painel para esse usuário.

## 4. Primeiro acesso ao painel

1. Abra `admin.html`, entre com e-mail e senha.
2. Em **Projetos no ar**, cadastre de 1 a 4 projetos. Enquanto não houver nenhum publicado, o site mostra os 3 exemplos fixos do HTML.
3. Os leads chegam em tempo real na aba **Leads**.

Para ver o painel com dados de exemplo sem Firebase: abra `admin.html?demo` direto do computador (arquivo local).

## 5. Imagens (WebP, sem Storage)

- Toda imagem enviada no painel é convertida para **WebP** no navegador e salva dentro do próprio documento do projeto.
- O painel redimensiona (até 1600 px) e comprime automaticamente até caber no limite do Firestore (cerca de 500 KB por imagem).
- Use **Chrome, Edge ou Firefox** para enviar imagens. O Safari não gera WebP pelo navegador e o painel avisa.
- Tamanho ideal para enviar: 1600 × 1000 px, proporção 16:10.

## 6. GitHub Pages e domínio

1. Suba a pasta para um repositório no GitHub (ex.: `cron-site`).
2. Settings > Pages > Source: `Deploy from a branch` > `main` / `root`.
3. O arquivo `CNAME` já aponta para `cronwebstudio.com.br`.
4. No registro.br, em DNS do `cronwebstudio.com.br`:
   - 4 registros **A** no domínio raiz: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - **CNAME** `www` → `SEU-USUARIO.github.io`
5. Para o `cronwebstudio.com`, redirecione para o `.com.br` no painel do registrador (redirecionamento 301).
6. Volte em Settings > Pages e marque **Enforce HTTPS** quando liberar.
7. No Firebase: Authentication > Configurações > **Domínios autorizados** > adicione `cronwebstudio.com.br` (necessário para o login do painel).

## 7. Antes de ir ao ar

- [ ] Revisar o texto da `politica-de-privacidade.html`.
- [ ] Trocar os placeholders de imagem do hero e das seções por imagens reais.
- [ ] Colocar o Meta Pixel / GA4 no `<head>` do `index.html`, se for usar. O formulário já dispara `Lead` (Pixel) e `generate_lead` (GA4) quando eles existem.
- [ ] Testar um envio real do formulário e conferir se ele aparece no painel.

## Estrutura

```
index.html                  landing
admin.html                  painel (noindex)
politica-de-privacidade.html
css/style.css               landing + formulário + cursor
css/admin.css               painel
js/firebase-config.js       chaves do Firebase (editar)
js/main.js                  rolagem suave, reveal, header
js/projects.js              projetos dinâmicos na landing
js/lead-form.js             formulário de lead
js/cursor.js                cursor personalizado
js/admin.js                 painel
firestore.rules             regras de segurança (colar no console)
```

## Origem dos leads

Cada botão do site tem um `data-cta` que vira a "origem" do lead no painel (ex.: `hero-primary`, `plano-sistema`, `case-meccal`). Assim o ranking **De onde vêm** mostra qual botão converte mais. UTMs da URL (`?utm_source=instagram`) também são salvas.

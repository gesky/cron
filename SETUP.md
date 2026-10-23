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
5. O `cronwebstudio.com` redireciona para o `.com.br` pelo Cloudflare (regra 301 já configurada).
6. Volte em Settings > Pages e marque **Enforce HTTPS** quando liberar.
7. No Firebase: Authentication > Configurações > **Domínios autorizados** > adicione `cronwebstudio.com.br` (necessário para o login do painel).

## 7. Antes de ir ao ar

- [ ] Revisar o texto da `politica-de-privacidade.html`.
- [ ] Trocar os placeholders de imagem do hero e das seções por imagens reais.
- [ ] Colocar o Meta Pixel / GA4, se for usar. O formulário já dispara `Lead` (Pixel) e `generate_lead` (GA4) quando eles existem. **Atenção:** o site tem uma política de segurança (CSP) que bloqueia scripts de fora; ao adicionar Pixel ou GA4, os domínios deles precisam entrar na meta `Content-Security-Policy` do `index.html` (e o código vai num arquivo `.js`, não solto no HTML). Me chame que eu ajusto.
- [ ] Testar um envio real do formulário e conferir se ele aparece no painel.

## 8. Segurança (o que já está no código)

- **CSP (Content-Security-Policy)** em todas as páginas: o navegador só executa scripts do próprio site (e do reCAPTCHA, se o App Check for ligado). Nenhum script solto no HTML, nenhum `onclick`. Isso corta a maior parte dos ataques de injeção (XSS).
- **Sem dependências de CDN**: Firebase, Lenis e a fonte Sora ficam hospedados no próprio site (`js/vendor/`, `fonts/`). Se um CDN for comprometido, o site não é afetado. A fonte local também evita enviar o IP do visitante ao Google (LGPD).
- **Regras do Firestore fechadas por padrão**: cada campo de projeto e de lead é validado (tipo, tamanho, formato de WhatsApp, e-mail, URL `https`, imagem WebP/PNG/JPEG). O admin só consegue mudar status e anotações de um lead. Qualquer coleção nova fica bloqueada.
- **Formulário**: campo-isca contra robôs, bloqueio de envio rápido demais e limite de um envio por minuto por navegador.
- **Painel**: `noindex`, não abre dentro de iframe de outro site (anti-clickjacking), sessão que some ao fechar o navegador, saída automática após 45 min sem uso, `no-referrer`.
- **Conteúdo do Firestore exibido com segurança**: todo texto é escapado antes de ir para a página; links só `http/https`; imagens só no formato que o painel gera.
- `/.well-known/security.txt` com o contato para quem encontrar alguma falha.

### Passos no console (faça uma vez, 10 minutos)

1. **Bloquear cadastro de contas novas** (importante): Firebase > Authentication > Configurações > **Ações do usuário** > desmarque **Ativar criação (inscrição)**. Assim ninguém cria conta pela API usando a chave pública. Na mesma tela, deixe ligada a **Proteção contra enumeração de e-mails**.
2. **Restringir a chave da API**: Google Cloud Console (mesmo projeto `cron-91280`) > APIs e serviços > Credenciais > clique na "Browser key" > **Restrições de aplicativo: Referenciadores HTTP** > adicione:
   - `https://cronwebstudio.com.br/*`
   - `https://www.cronwebstudio.com.br/*`
   - `https://cron-91280.firebaseapp.com/*`
   - `http://localhost/*` (só se for testar no computador)
3. **Senha forte + 2 etapas** na conta Google dona do projeto Firebase (é a chave de tudo).
4. **App Check (recomendado)**: impede robôs de gravar leads direto pela API, sem passar pelo site.
   1. Crie uma chave **reCAPTCHA v3** em https://www.google.com/recaptcha/admin (domínio `cronwebstudio.com.br`).
   2. Firebase > **App Check** > Apps > registre o app web com o provedor **reCAPTCHA v3** e a **chave secreta**.
   3. Cole a **chave do site** em `js/firebase-config.js`, na variável `appCheckSiteKey`.
   4. Publique, confira em App Check > Métricas que os pedidos aparecem como "verificados" e só então clique em **Aplicar (Enforce)** no Cloud Firestore.
5. **Cabeçalhos extras (opcional)**: o GitHub Pages não deixa configurar cabeçalhos HTTP. Se quiser o pacote completo (HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy), coloque o `cronwebstudio.com.br` no Cloudflare, igual ao `.com`, e crie uma *Response Header Transform Rule* com:
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `X-Frame-Options: SAMEORIGIN`
   - `X-Content-Type-Options: nosniff`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 9. SEO (o que já está no código)

- Título e descrição com os termos de busca principais (criação de sites, sistemas web, painel administrativo), URL canônica e `lang="pt-BR"`.
- **Dados estruturados (JSON-LD)**: Organização, Site, Página, os dois Serviços e o FAQ. Ajudam o Google (e buscas com IA) a entender o que a Cron faz e a quem atende.
- **Open Graph e Twitter Card** com imagem própria 1200 × 630 (`img/og-image.jpg`): o link fica bonito no WhatsApp, LinkedIn e Instagram.
- `robots.txt`, `sitemap.xml`, favicons em todos os tamanhos, `site.webmanifest`, página `404.html` com a marca.
- Performance: fontes locais com pré-carregamento, imagens WebP com tamanho definido, nenhum script de terceiros bloqueando.

### Passos para aparecer no Google

1. **Google Search Console** (https://search.google.com/search-console): adicione a propriedade de **Domínio** `cronwebstudio.com.br`, verifique pelo registro TXT no DNS (Hostinger), envie o sitemap `https://cronwebstudio.com.br/sitemap.xml` e use **Inspeção de URL > Solicitar indexação** na página inicial.
2. **Bing Webmaster Tools**: importe direto do Search Console (1 clique). O Bing também alimenta o ChatGPT e outros buscadores.
3. **Perfil da Empresa no Google** (Google Business Profile): crie como empresa de **área de atendimento** (sem endereço público), categoria "Web designer" ou "Serviço de criação de sites", área: Brasil. É o que faz a Cron aparecer no mapa e nas buscas "perto de mim".
4. **Links de volta**: coloque `cronwebstudio.com.br` na bio do Instagram, no LinkedIn e, com permissão, um "Site por Cron" no rodapé dos sites dos clientes. Isso pesa muito para o Google.
5. **Conteúdo**: o que mais traz busca orgânica com o tempo são páginas próprias para cada case (ex.: `/projetos/meccal`) e textos respondendo dúvidas reais ("quanto custa um site com painel", "site institucional ou landing page"). Quando quiser, eu monto essa estrutura.

Leva de algumas semanas a alguns meses para o Google ranquear um domínio novo. Termos amplos como "criação de sites" são muito disputados; os primeiros resultados vêm de buscas mais específicas e do nome da marca.

## Estrutura

```
index.html                  landing
admin.html                  painel (noindex)
politica-de-privacidade.html
404.html                    página de erro
robots.txt, sitemap.xml     para o Google
site.webmanifest            ícones/app
.well-known/security.txt    contato de segurança
css/fonts.css               fonte Sora local
css/style.css               landing + formulário + cursor
css/motion.css              animação do painel
css/admin.css               painel
fonts/                      arquivos da Sora
js/early.js, js/intro.js    marcação inicial e abertura 3D
js/firebase-config.js       chaves do Firebase (+ App Check opcional)
js/main.js                  rolagem suave, reveal, header, efeitos
js/projects.js              projetos dinâmicos na landing
js/lead-form.js             formulário de lead
js/cursor.js                cursor personalizado
js/globe.js, globe-data.js  globo do hero
js/admin.js                 painel
js/vendor/                  Firebase e Lenis hospedados no site
firestore.rules             regras de segurança (colar no console)
```

## Origem dos leads

Cada botão do site tem um `data-cta` que vira a "origem" do lead no painel (ex.: `hero-primary`, `plano-sistema`, `case-meccal`). Assim o ranking **De onde vêm** mostra qual botão converte mais. UTMs da URL (`?utm_source=instagram`) também são salvas.

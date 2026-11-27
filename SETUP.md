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
- **leads**: qualquer visitante pode enviar (com consentimento LGPD e campos validados); só o admin lê, edita e exclui. O CronUS lê, cria leads de prospecção (`origin: 'cronus'`) e edita só esses, dentro de uma lista fechada de campos.
- **leads/{id}/interacoes**: histórico de cada lead; admin e CronUS leem e criam; só o admin apaga (junto com o lead); ninguém edita.
- **leads/{id}/kit/marca**: logo e produtos do lead; admin grava em qualquer lead, o CronUS só nos leads dele.
- **leads/{id}/previews/{pid}**: índice privado das prévias do lead (nicho e motivo do formato); só admin e CronUS leem e gravam.
- **previews**: sites modelo; qualquer pessoa abre só uma prévia ativa pelo id (nunca lista); admin e CronUS criam e editam; só o admin apaga. O documento público não guarda lead, nicho nem motivo do formato.
- **rodadas**: rodadas de prospecção; admin e CronUS leem, criam e editam; só o admin arquiva; ninguém apaga.
- **admins**: lista de quem pode entrar no painel. Os próprios admins adicionam e removem pela aba Usuários; ninguém remove o próprio acesso nem o do dono.
- **bots**: contas de automação (CronUS). Só o admin libera e remove. Nunca entram no painel.
- **config/owner**: UID do dono do sistema. Criado uma vez pelo console, nunca muda nem é apagado.

O CronUS nunca apaga nada, nunca aprova mensagem nem candidato, nunca marca proposta, fechado ou perdido e nunca toca em projetos, admins, bots ou config. Detalhes em **Acesso do CronUS**, no fim deste arquivo.

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
css/admin-crm.css           CRM do painel (quadro, cartões, gaveta do lead)
css/admin-prospeccao.css    Prospecção, Usuários e menu do painel no celular
css/admin-modelos.css       qualificação, marca, kit e site modelo no painel
fonts/                      arquivos da Sora
js/early.js, js/intro.js    marcação inicial e abertura 3D
js/firebase-config.js       chaves do Firebase (+ App Check opcional)
js/main.js                  rolagem suave, reveal, header, efeitos
js/projects.js              projetos dinâmicos na landing
js/lead-form.js             formulário de lead
js/cursor.js                cursor personalizado
js/globe.js, globe-data.js  globo do hero
js/admin.js                 núcleo do painel (login, abas, dados, projetos) e window.CRON_ADMIN
js/admin-crm.js             aba CRM
js/admin-prospeccao.js      aba Prospecção (rodadas, candidatos, fila de aprovação)
js/admin-users.js           aba Usuários
js/admin-modelos.js         qualificação, marca, kit e site modelo (CRON_ADMIN.previews)
modelo/                     página pública do site modelo (noindex, fora do sitemap)
js/vendor/                  Firebase e Lenis hospedados no site
firestore.rules             regras de segurança (colar no console)
tests/                      testes das regras no emulador (não vão para o banco real)
```

## Origem dos leads

Cada botão do site tem um `data-cta` que vira a "origem" do lead no painel (ex.: `hero-primary`, `plano-sistema`, `case-meccal`). Assim o ranking **De onde vêm** mostra qual botão converte mais. UTMs da URL (`?utm_source=instagram`) também são salvas.

## CRM (aba "CRM" do painel)

A antiga aba Leads virou o CRM. Os leads do formulário continuam entrando do mesmo jeito; tudo o que é novo é opcional e convive com os leads antigos.

### Etapas

| Valor no banco | No painel |
|---|---|
| `novo` | Novo |
| `mensagem_pronta` | Mensagem pronta (aguardando aprovação) |
| `abordado` | Abordado |
| `respondeu` | Respondeu |
| `em_conversa` | Em conversa |
| `reuniao` | Reunião marcada |
| `proposta` | Proposta enviada |
| `fechado` | Fechado |
| `perdido` | Perdido (pede o motivo) |

Leads antigos com `contato` aparecem como **Em conversa**. Para gravar a etapa nova no banco, use o botão de engrenagem no topo do CRM, **Atualizar etapas antigas**. Ele roda em lotes, pode ser usado mais de uma vez e não apaga nada. Essa troca técnica não gera registro no histórico; as mudanças de etapa feitas à mão geram.

### Campos novos em `leads`

`origin` (`site` | `cronus` | `indicacao` | `manual`; sem valor = `site`), `role`, `instagram` (só o usuário), `niche` (ex.: `industria-moveis`), `city` e `state` (internos, nunca aparecem em nada público), `currentSite`, `siteStatus` (`sem_site` | `site_fraco` | `ok`), `siteScore` (0 a 10), `siteReason`, `googleRating` (0 a 5), `googleReviews`, `cnpj` (14 dígitos), `companyYears`, `phone`, `linkedin`, `companyLinkedin`, `companyEmail`, `cnpjEmail`, `cnpjPhone`, `legalName`, `googleMapsUrl`, `facebook`, `address`, `otherLinks` (até 10 links, cada um http/https), `sources` (de onde veio cada dado: a chave é o nome de um campo do lead e o valor um texto de até 40 caracteres, ex.: `{ whatsapp: 'google_maps' }`), `channel` (`whatsapp` | `instagram` | `email`), `fitReason`, `draft` (`{ channel, text, approved, approvedAt, sentAt }`), `previewId`, `batchId`, `owner`, `nextStep` (`{ text, dueAt }`), `meetingAt`, `lostReason`, `stageAt` (quando entrou na etapa atual) e `createdBy` (`admin` nos cadastros manuais).

Histórico: subcoleção `leads/{id}/interacoes` com `{ type, text, channel, from, to, createdAt, createdBy }`. Tipos: `mensagem_enviada`, `resposta`, `nota`, `mudanca_etapa`, `reuniao`, `proposta`. Ninguém edita uma interação. No painel não existe botão para apagar um registro isolado: o histórico só é apagado junto com o lead, em **Excluir lead** (exclusão completa, inclusive para pedidos pela LGPD).

### Como funciona no dia a dia

- **Quadro ou Lista**: o painel lembra a última visão. No celular, as colunas rolam para o lado e cada cartão tem um seletor de etapa (no computador também dá para arrastar).
- **Destaques**: próximos passos vencidos, para hoje, abordagens feitas hoje (mensagens marcadas como enviadas no dia) e mensagens para aprovar. O número verde no menu é o de mensagens aguardando aprovação.
- **Filtros** (etapa, nicho, origem, canal, situação do site) e busca ficam no endereço (`#crm?...`), então dá para salvar ou voltar.
- **Mensagem de abordagem**: editar o texto sempre volta para "aguardando aprovação". O WhatsApp só abre com o texto preenchido depois de aprovado. "Marcar como enviada" grava o envio, move para Abordado e registra no histórico. **Nada é enviado sozinho.**
- **Novo lead**: cadastro manual para indicações e contatos que chegaram fora do site.
- **WhatsApp e telefone**: o número pode ser gravado com ou sem o 55 do Brasil (10 a 13 dígitos). O painel só acrescenta o 55 quando ele não está lá.
- **Link direto**: abrir o painel com `#crm?...` no endereço já entra na aba CRM com os filtros aplicados.

### Modo demonstração

Abra `admin.html?demo` no computador (arquivo local ou `localhost`). Funciona mesmo com o Firebase configurado e não grava nada no banco.

### Testar as regras (opcional, no seu computador)

Precisa de Node e Java. Os testes usam o emulador local com um projeto fictício e nunca tocam no banco real:

```
cd tests
npm install
npm test
```

## Prospecção (aba "Prospecção" do painel)

O CronUS pesquisa empresas de um nicho, qualifica e deixa mensagens prontas. Você revisa, aprova e manda para o CRM. **Aprovar é sempre seu; nada é enviado sozinho.**

### Dados

- Coleção `rodadas`: `{ niche, nicheLabel, region (interna), criteria: { minRating, minReviews, siteStatusAccepted, requireContact }, funnel: { encontradas, notaMinima, avaliacoes, siteSemOuFraco, comContato, qualificadas }, status ('em_andamento' | 'concluida' | 'arquivada'), notes, createdBy ('admin' | 'cronus'), createdAt, updatedAt }`. Não se apaga rodada: arquiva.
- Os candidatos ficam em `leads` mesmo, com `origin: 'cronus'`, `batchId` (id da rodada) e `prospectState`: `pendente` | `aprovado` | `descartado`. Pendentes e descartados **não aparecem no CRM**, só na Prospecção. Não existe cópia de dados entre coleções.
- Mensagens sugeridas por canal: `drafts: { whatsapp, instagram, email }`. A escolhida e aprovada vai para `draft` (o mesmo campo do CRM). Motivo de descarte: `discardReason`.

### Como funciona

- **Rodadas**: lista com nicho, data, funil resumido e pendentes. Dentro da rodada: funil completo, candidatos por estado (pendentes, aprovados, descartados), mensagem por canal editável no próprio cartão.
- **Aprovar e mandar para o CRM**: o candidato entra no CRM em **Mensagem pronta** com a mensagem que está na tela já aprovada (sem mensagem, entra em **Novo**). O histórico registra a aprovação e a mudança de etapa.
- **Descartar**: motivo opcional. Dá para voltar o descartado para pendentes.
- **Seleção em lote**: marque vários e use a barra que aparece embaixo (Aprovar ou Descartar).
- **Fila de aprovação**: junta os candidatos pendentes com mensagem, de qualquer rodada, e os leads do CRM em Mensagem pronta ainda sem aprovação. Para os leads do CRM, aprovar só aprova a mensagem.
- **Nova rodada**: dá para criar à mão (nicho, região, critérios e funil). Normalmente quem cria é o CronUS (fase 4).

## Usuários (aba "Usuários" do painel)

Quem tem documento em `admins/{uid}` entra no painel e pode fazer tudo, inclusive gerenciar outros usuários.

### Adicionar

Três jeitos, escolhidos na gaveta:

1. **Enviar e-mail para criar a senha** (recomendado): o painel cria a conta com uma senha aleatória e o Firebase manda para a pessoa o e-mail de redefinição. Ninguém além dela conhece a senha.
2. **Senha provisória**: você define e passa para a pessoa. Ela pode trocar em "Esqueci minha senha".
3. **A conta já existe no Firebase**: cole o UID que aparece em Authentication > Usuários.

A conta é criada num app secundário do Firebase, então a sua sessão não muda.

**Se a criação de contas estiver desligada** no Firebase (Authentication > Configurações > Ações do usuário > "Ativar criação"), as opções 1 e 2 mostram um aviso. Nesse caso, crie a conta no console (Authentication > Usuários > Adicionar usuário) e use a opção 3. Ligar a criação de contas é seguro neste projeto: uma conta nova não vê nada sem o documento em `admins`, que só um admin cria.

O e-mail de redefinição usa o modelo padrão do Firebase. Para trocar o remetente e o texto: Authentication > Modelos > Redefinição de senha.

### Remover

Tira o acesso ao painel na hora (se a pessoa estiver com o painel aberto, ele fecha). A conta de login continua existindo no Firebase; para apagar de vez, use Authentication > Usuários no console. Ninguém consegue remover o próprio acesso, então sempre sobra pelo menos um admin.

### Dono do sistema

O UID gravado em `config/owner` é o dono. Ele aparece com a etiqueta **Dono** e não tem botão Remover; as regras recusam a remoção mesmo fora do painel. Enquanto `config/owner` não existir, ninguém remove admin nenhum e a aba mostra um aviso. Como criar: veja **Acesso do CronUS**, passo 2.

### Assistente (bots)

Abaixo dos admins fica a seção **Assistente**, com as contas de bot (hoje, o CronUS). **Liberar assistente** pede o UID da conta (criada antes em Authentication), um nome e o e-mail. O mesmo UID não pode ser admin e bot ao mesmo tempo. **Remover** corta o acesso do bot na hora; a conta de login continua no Firebase.

### Testes

`tests/rules/fase2.test.js` cobre rodadas, prospecção nos leads, usuários e a proteção do dono (`cd tests && npm install && npm test`).

## Sites modelo (fase 3)

Para cada lead qualificado, o painel gera com um clique um rascunho de site: o template do nicho com a logo, as cores, os serviços e textos padrão já com o nome da empresa. Você aprova a mensagem e a prévia juntas. Nada é enviado sozinho.

### Fluxo

1. **Qualificação** (cartão da Prospecção ou gaveta do lead): Qualificado, Desqualificado (pede o motivo) ou Sem avaliação. Desqualificado não ganha prévia. Dá para aprovar um desqualificado mesmo assim, com confirmação.
2. **Formato**: Landing, Institucional ou Catálogo, com o motivo ao lado. "Site + sistema" não é formato de prévia: é assunto de reunião.
3. **Marca**: cores (`#rrggbb`), slogan, serviço principal e até 8 serviços. Fica no lead (`brand`).
4. **Kit**: logo e, no catálogo, até 24 produtos com categoria, descrição e foto. Fica em `leads/{id}/kit/marca`, fora do lead, para não pesar o painel. As imagens são convertidas para WebP (logo até 512 px, produtos até 480 px). O painel mostra o peso e avisa acima de 800 KB (o documento do Firestore aceita até 1 MB).
5. **Gerar site modelo**: só com o lead qualificado, formato escolhido e nome da empresa. Cria a prévia, liga ao lead (`previewId`), registra no histórico e abre numa aba nova. "Gerar de novo" desativa a anterior (não apaga).
6. **Editar prévia**: todos os campos e os textos. Em branco, vale o texto padrão do template, mostrado em cinza. "Copiar logo e produtos do kit atual" atualiza as imagens.
7. **Aprovar**: na fila ou na rodada, aprovar grava `draft.previewId` e garante que a prévia está ativa.

### Link na mensagem

Escreva `{link}` no texto da mensagem para o endereço da prévia entrar no lugar ao copiar ou abrir o WhatsApp. Sem `{link}`, nada é anexado: a abordagem pergunta antes e o link vai depois, pelo botão **Copiar link**.

### Página pública `modelo/`

- Endereço: `https://cronwebstudio.com.br/modelo/?id=<id>` (id aleatório de 20 caracteres).
- Só abre prévia ativa. Id inválido, inexistente ou desativado mostra "Este rascunho não está disponível." sem revelar nada.
- `noindex`, `Disallow: /modelo/` no `robots.txt`, fora do `sitemap.xml`, CSP fechada, sem script inline e anti-iframe.
- Os botões da prévia não levam a lugar nenhum: mostram "No site final, este botão leva direto ao seu WhatsApp."
- A prévia não guarda contato, cidade, endereço, nota do Google nem motivos internos.

### Templates

- Cada template fica em `modelo/templates/<nome>/` com `template.js` (textos padrão e desenho) e `template.css`.
- Só carregam os nomes de `modelo/templates/registry.js`. A prévia usa o template com o nome do nicho do lead, se ele estiver na lista; senão, `_base`.
- Textos padrão por formato, com os marcadores `{empresa}`, `{servicoPrincipal}` e `{servicos}`. Prioridade: texto da prévia, depois o padrão do template, depois o padrão do `_base`.
- **Novo nicho**: copie `modelo/templates/_base` para `modelo/templates/<nicho>` (o mesmo código usado no campo Nicho do lead, ex.: `industria-moveis`), troque o nome em `CRON_MODELO.register('<nicho>', ...)`, ajuste os textos padrão e o visual e acrescente o nome em `registry.js`. Para os textos padrão aparecerem como sugestão na edição do painel, inclua também o `template.js` novo no `admin.html`, logo depois do `_base`.
- Regras dos textos padrão: sem travessão, sem emoji, sem cidade, sem preço e sem dados inventados (anos de empresa, número de clientes, depoimentos, selos).

### Modo demonstração

- Painel: `admin.html?demo` já traz três leads com prévia (landing, institucional e catálogo), um desqualificado e um sem avaliação. As prévias geradas no demo ficam no navegador (`localStorage`).
- Página: `modelo/?demo=demoLanding000000001`, `modelo/?demo=demoInstitucional001` ou `modelo/?demo=demoCatalogo00000001` (só no computador).

### Exclusão completa

Excluir um lead apaga também o histórico, o kit, o índice privado e todas as prévias dele (as listadas no índice e as antigas que ainda têm `leadId`).

### Índice privado das prévias

Desde a fase 4, a ligação entre lead e prévia fica em `leads/{id}/previews/{pid}` (com o nicho e o motivo do formato), que só admin e CronUS leem. O documento público em `previews/{pid}` não tem `leadId`, `niche` nem `formatReason`. O motivo do formato editado no painel é salvo no lead.

### Testes

`tests/rules/fase3.test.js` cobre prévias (público e admin), o índice privado, kit e os campos novos do lead.

## Acesso do CronUS (fase 4)

O CronUS grava a prospecção direto no Firestore, pela API REST, com uma conta própria de Authentication. Ele não entra no painel e não tem acesso de admin. O que ele pode e não pode está nas regras (`isBot()`) e na lista do passo 2 deste arquivo.

### Passos no console, nesta ordem

1. **Publicar as regras novas antes do merge.** Firestore > Regras > cole o `firestore.rules` desta versão > Publicar. As regras novas aceitam o painel antigo e o novo, então publicar antes não quebra nada.
2. **Criar `config/owner`.** Firestore > Iniciar coleção `config` > ID do documento `owner` > campos `uid` (string, o seu UID, o mesmo do seu documento em `admins`) e `createdAt` (timestamp, agora) > Salvar. As regras não deixam ninguém alterar nem apagar esse documento depois (só o próprio console do Firebase consegue): confira o UID antes de salvar.
3. **Criar a conta do bot.** Authentication > Usuários > Adicionar usuário, com um e-mail só dele (ex.: um alias do seu e-mail) e uma senha longa gerada pelo gerenciador de senhas. A senha vai direto para o cofre e para a configuração do CronUS. Não cole a senha no chat, no repositório, em PR nem em comentário. Copie o UID.
4. **Liberar o bot.** No painel, aba Usuários > Assistente > Liberar assistente > cole o UID, nome `CronUS` e o e-mail. (Pelo console também funciona: coleção `bots`, documento = UID, campos `name`, `email`, `role` = `bot`.)
5. **Conferir.** Entre em `admin.html` com a conta do bot: o painel deve recusar ("sem acesso"). Saia em seguida.

### Login (REST)

A chave web é a `apiKey` de `js/firebase-config.js`. Recomendado: no Google Cloud Console > APIs e serviços > Credenciais, crie uma **chave separada para o bot**, restrita às APIs "Identity Toolkit API" e "Token Service API". A chave do site normalmente fica restrita por referenciador HTTP (`cronwebstudio.com.br/*`) e um servidor sem `Referer` recebe `API_KEY_HTTP_REFERRER_BLOCKED`.

Entrar (o token dura 1 hora):

```bash
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$CHAVE_BOT" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CRONUS_EMAIL\",\"password\":\"$CRONUS_SENHA\",\"returnSecureToken\":true}"
# resposta: idToken, refreshToken, expiresIn, localId (UID)
```

Renovar sem senha:

```bash
curl -s -X POST "https://securetoken.googleapis.com/v1/token?key=$CHAVE_BOT" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN"
# resposta: id_token, refresh_token
```

`$CRONUS_EMAIL` e `$CRONUS_SENHA` vêm do cofre, como variáveis de ambiente. Nunca em arquivo versionado.

**App Check:** hoje não está ativado. Se um dia for imposto no Firestore, o CronUS vai precisar de um token de depuração do App Check (App Check > Apps > Gerenciar tokens de depuração) enviado no cabeçalho `X-Firebase-AppCheck`. Ative só depois de configurar isso.

### Gravações (REST)

Base: `https://firestore.googleapis.com/v1/projects/cron-91280/databases/(default)/documents`. Todas as chamadas levam `Authorization: Bearer $ID_TOKEN`.

Use sempre `:commit`. Ele aceita várias gravações juntas (tudo ou nada) e o `setToServerValue: REQUEST_TIME`, que é o que as regras exigem em `createdAt` e `updatedAt`. IDs novos: 20 caracteres de `A-Z a-z 0-9`, gerados pelo CronUS.

```bash
curl -s -X POST "$BASE:commit" -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" -d @gravacao.json
```

**1. Rodada nova**

```json
{ "writes": [{
  "update": { "name": "projects/cron-91280/databases/(default)/documents/rodadas/ID_RODADA",
    "fields": {
      "niche": { "stringValue": "industria-moveis" },
      "nicheLabel": { "stringValue": "Indústria de móveis" },
      "region": { "stringValue": "Norte do Paraná" },
      "status": { "stringValue": "em_andamento" },
      "createdBy": { "stringValue": "cronus" } } },
  "currentDocument": { "exists": false },
  "updateTransforms": [
    { "fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME" },
    { "fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME" } ]
}]}
```

**2. Atualizar o funil da rodada** (o CronUS pode marcar `concluida`, nunca `arquivada`)

```json
{ "writes": [{
  "update": { "name": ".../documents/rodadas/ID_RODADA",
    "fields": { "funnel": { "mapValue": { "fields": {
      "encontradas": { "integerValue": "40" }, "qualificadas": { "integerValue": "6" } } } },
      "status": { "stringValue": "concluida" } } },
  "updateMask": { "fieldPaths": ["funnel", "status"] },
  "currentDocument": { "exists": true },
  "updateTransforms": [{ "fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME" }]
}]}
```

**3. Lead novo** (sempre `origin` e `createdBy` = `cronus`, `status` = `novo` ou `mensagem_pronta`, `prospectState` = `pendente`; a mensagem nasce sem aprovação)

```json
{ "writes": [{
  "update": { "name": ".../documents/leads/ID_LEAD",
    "fields": {
      "origin": { "stringValue": "cronus" },
      "createdBy": { "stringValue": "cronus" },
      "status": { "stringValue": "mensagem_pronta" },
      "prospectState": { "stringValue": "pendente" },
      "company": { "stringValue": "Nome da empresa" },
      "niche": { "stringValue": "industria-moveis" },
      "batchId": { "stringValue": "ID_RODADA" },
      "whatsapp": { "stringValue": "43999999999" },
      "sources": { "mapValue": { "fields": { "whatsapp": { "stringValue": "google_maps" } } } },
      "drafts": { "mapValue": { "fields": { "whatsapp": { "stringValue": "Texto da abordagem" } } } },
      "draft": { "mapValue": { "fields": {
        "channel": { "stringValue": "whatsapp" }, "text": { "stringValue": "Texto da abordagem" } } } } } },
  "currentDocument": { "exists": false },
  "updateTransforms": [{ "fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME" }]
}]}
```

Os valores acima são só o formato. Grave apenas dados encontrados de verdade, com a fonte em `sources`.

**4. Atualizar um lead do CronUS** (só campos da lista do bot; sempre com `updateMask`)

```json
{ "writes": [{
  "update": { "name": ".../documents/leads/ID_LEAD",
    "fields": { "qualification": { "stringValue": "qualificado" },
      "format": { "stringValue": "catalogo" }, "formatReason": { "stringValue": "Motivo curto" } } },
  "updateMask": { "fieldPaths": ["qualification", "format", "formatReason"] },
  "currentDocument": { "exists": true },
  "updateTransforms": [{ "fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME" }]
}]}
```

**5. Registro no histórico**

```json
{ "writes": [{
  "update": { "name": ".../documents/leads/ID_LEAD/interacoes/ID_INTERACAO",
    "fields": { "type": { "stringValue": "nota" }, "text": { "stringValue": "O que aconteceu" },
      "channel": { "stringValue": "" }, "from": { "stringValue": "" }, "to": { "stringValue": "" },
      "createdBy": { "stringValue": "cronus" } } },
  "currentDocument": { "exists": false },
  "updateTransforms": [{ "fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME" }]
}]}
```

**6. Kit da marca** (documento sempre `marca`; logo e fotos em WebP base64)

```json
{ "writes": [{
  "update": { "name": ".../documents/leads/ID_LEAD/kit/marca",
    "fields": { "logo": { "stringValue": "data:image/webp;base64,..." },
      "products": { "arrayValue": { "values": [{ "mapValue": { "fields": {
        "name": { "stringValue": "Produto" }, "category": { "stringValue": "Categoria" } } } }] } },
      "categories": { "arrayValue": { "values": [{ "stringValue": "Categoria" }] } },
      "updatedBy": { "stringValue": "cronus" } } },
  "updateTransforms": [{ "fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME" }]
}]}
```

**7. Prévia, índice privado e ligação no lead** (num commit só; nada de `leadId`, `niche` ou `formatReason` no documento público)

```json
{ "writes": [
  { "update": { "name": ".../documents/previews/ID_PREVIA",
      "fields": { "template": { "stringValue": "_base" }, "format": { "stringValue": "catalogo" },
        "companyName": { "stringValue": "Nome da empresa" }, "tagline": { "stringValue": "" },
        "mainService": { "stringValue": "Serviço principal" },
        "services": { "arrayValue": { "values": [{ "stringValue": "Serviço" }] } },
        "primaryColor": { "stringValue": "#112233" }, "secondaryColor": { "stringValue": "#ffffff" },
        "logo": { "stringValue": "" }, "products": { "arrayValue": {} }, "categories": { "arrayValue": {} },
        "texts": { "mapValue": {} }, "active": { "booleanValue": false },
        "createdBy": { "stringValue": "cronus" } } },
    "currentDocument": { "exists": false },
    "updateTransforms": [
      { "fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME" },
      { "fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME" } ] },
  { "update": { "name": ".../documents/leads/ID_LEAD/previews/ID_PREVIA",
      "fields": { "niche": { "stringValue": "industria-moveis" }, "formatReason": { "stringValue": "Motivo curto" } } },
    "currentDocument": { "exists": false },
    "updateTransforms": [{ "fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME" }] },
  { "update": { "name": ".../documents/leads/ID_LEAD", "fields": { "previewId": { "stringValue": "ID_PREVIA" } } },
    "updateMask": { "fieldPaths": ["previewId"] },
    "currentDocument": { "exists": true },
    "updateTransforms": [{ "fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME" }] }
]}
```

A prévia do CronUS pode nascer inativa (`active: false`); quem ativa e aprova é você, no painel.

### Checar duplicado antes de criar

```bash
curl -s -X POST "$BASE:runQuery" -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" -d '{
  "structuredQuery": {
    "from": [{ "collectionId": "leads" }],
    "where": { "fieldFilter": { "field": { "fieldPath": "whatsapp" }, "op": "EQUAL", "value": { "stringValue": "43999999999" } } },
    "limit": 1 } }'
```

Repita com `instagram`, `cnpj` ou `googleMapsUrl` quando houver. Resposta com `document` = já existe: atualize (se for lead do CronUS) ou pule.

### Erros comuns

- `PERMISSION_DENIED`: campo fora da lista do bot, `status` ou `prospectState` não permitido, lead que não é do CronUS, `createdAt`/`updatedAt` sem `REQUEST_TIME`, ou falta do `updateMask` (sem ele o REST substitui o documento inteiro e as regras recusam).
- `UNAUTHENTICATED`: token vencido; renove com o `refreshToken`.

### Prévias antigas

As prévias criadas antes desta versão ainda têm `leadId`, `niche` e `formatReason` no documento público. O painel remove esses campos sempre que a prévia é salva, ativada ou desativada, e continua achando as antigas pelo `leadId` para listar e para a exclusão completa. Para limpar de vez: no painel, abra cada prévia ativa e salve (ou gere de novo). Não há script de migração em massa, de propósito.

### Outros ajustes desta fase

- `.nojekyll` na raiz: o GitHub Pages serve os arquivos como estão.
- `robots.txt` com `Disallow: /tests/`.
- Os testes de regras rodam só no emulador local e precisam de Node e Java (veja `tests/README.md`). `tests/rules/fase4.test.js` cobre o acesso do CronUS, o dono e a privacidade das prévias.

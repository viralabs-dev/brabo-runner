# brabo-runner

CLI `brabo-runner` que roda na máquina do usuário (ADR 0103). Terminal por PTY, container local, espelho e agente de máquina.

> Partido do `CLAUDE.md` do monorepo `daneiel/brabo` (hoje `brabo-legacy`, `dev` @ `1586158973`) na AT-708 (EP-033, ADR 0252). Copiado, não resumido: o que era de outro repo foi cortado e os caminhos do monorepo viraram a raiz deste repo (ou `brabo-<x>:caminho`). Caminhos sem prefixo que não existem aqui (`docker/`, `deploy/`, `install.sh`, `e2e/`, `scripts/dev/`, `scripts/ci/` fora do `brabo-ci`) moram no `brabo-infra`, no `brabo-qa` ou no `brabo-ci`. O resto das regras mora no `CLAUDE.md` da pasta-mãe (`brabo-workspace`, clonado em `~/dev/brabo/CLAUDE.md`) e no de cada repo irmão.

## Stack (decidida — não proponha alternativas)
- `brabo-runner`: CLI Node/TS na máquina do usuário (ADR 0103), distribuído só como binário standalone na Release (AT-774).
- Contratos: `@brabo/docker-port` vem do GitHub Packages (`npm:@viralabs-dev/brabo-docker-port@1.2.0`, alias do pnpm, devDependency; ADR 0270), publicado pela tag do `brabo-contracts`. O `dist` já é `.js`, então não há hook de type stripping. O `.npmrc` do repo só aponta o registry do escopo `@viralabs-dev`; o token vive no `~/.npmrc` (PAT `read:packages`) ou no CI (`GITHUB_TOKEN` com `packages: read`), nunca no repo. O pacote do runner não declara `@viralabs-dev/*` em `dependencies` (RN-1040). Subir a versão: `scripts/ci/subir-contracts.sh` do `brabo-ci`; o check `contracts-alinhado` confere alias e lock.

## Repositório, branches e PR (vale para todo repo `brabo-*`)
- Branches permanentes: dev, main — um branch, um ambiente; a esteira é
  `dev → main`. A `qa` foi APOSENTADA por hora (ADR 0235, só no repositório do
  Brabo; arquivada em `refs/archive/qa`, segue em `PROTECTED_BRANCHES` do
  produto e em `NUNCA_ARQUIVAR`). `rc` saiu
  da política (ADR 0030) e o bootstrap parou de criá-la, mas continua em
  `PROTECTED_BRANCHES` DE PROPÓSITO: a lista decide o que a trava de merge
  RECUSA, e repositórios bootstrapados por versões anteriores ainda têm a
  branch. Proteger uma branch que não existe não custa nada; desproteger
  uma que existe custa caro. Não "limpe" essa lista.
  Trabalho nasce de dev com a taxonomia da política (breaking/,
  feature/, bugfix/, perf/, refactor/, chore/, docs/, test/);
  hotfix/ nasce de main. Os AGENTES seguem a mesma régua desde a RN-664: o
  worktree do dev agent nasce de `dev`, a PR dele e a de ADR miram `dev`, e o
  gate julga o diff contra `dev` — os três juntos, nunca um só (o gate
  julgaria um diff que não é o da PR); repositório sem `dev` falha nomeado,
  sem queda para a default. A PR de INFRA (`open_infra_pr`) segue a
  mesma régua desde a RN-729: `feature/infra-setup` nasce de `dev`, mira `dev`
  e leva o autor `infra[bot]`. Formato funcao/descritivo,
  regex ^.{0,30}/\S{0,32}$. EXCEÇÃO nomeada: `dependabot/…` é branch
  PERMITIDA sem critério de caracteres (sem limite de tamanho, qualquer número
  de barras), mas só quando o AUTOR é o próprio Dependabot
  (`ehBranchDoDependabot` em `scripts/ci/pr-police.ts`) — humano com esse
  prefixo reprova em `FUNCAO-DESCONHECIDA`, senão o prefixo vira a porta para
  escapar do formato. Commits em conventional commits, pt-BR.
  A FUNÇÃO da branch decide a VERSÃO (scripts/ci/version.ts): breaking/
  sobe MAJOR, feature/ sobe MINOR, todo o resto é PATCH. Mudança que
  exige ação do operador antes do deploy nasce em breaking/ mesmo quando
  o conteúdo é correção — o v2.5.1 saiu patch porque a chave obrigatória
  do OAuth nasceu em bugfix/, e um patch diz "atualize sem pensar".
  Versão não se corrige à mão depois: o valor de ela ser calculada vem de
  não ser negociada caso a caso.
- Toda mudança entra por PR — push direto em permanente é bloqueado;
  únicas exceções de push: tags (bot de release) e .release/gate.json
  (bot do gate).
- Toda branch cujo PR é mergeado é ARQUIVADA automaticamente, SEM carência, por checagem
  SEMANAL (segunda 09:00 de Brasília, AT-661) (`.github/workflows/archive-merged-branch.yml`,
  AT-557): sem PR aberta e sem commit depois do merge; branch sem PR mergeada
  não é tocada — move de
  `refs/heads/<nome>` para `refs/archive/<nome>`, nunca apaga: histórico
  intacto, recuperável com um `git push` de volta. Exceções: dev/qa/main
  (aparecem como `head` de todo PR de promoção), `gh-pages` (deploy do
  site, não é branch de feature) e branch de fork. A política mora em
  `scripts/ci/archive-branch.ts` (testado), ver
  scripts/ci/docs/explanation/branching-policy.md, seção "Merged branches get
  archived".
- PR do Dependabot entra pela `dev`, nunca direto na `main`; na `dev` ele não espera aprovação humana (ADR 0236) e a `main` segue com a escada inteira. Dependência de linguagem só por segurança (`open-pull-requests-limit: 0`), `github-actions` e `docker` semanais, `target-branch: dev`. O `dependabot-para-dev.yml` do `brabo-ci` fecha ou redireciona o PR de segurança que o GitHub abre contra a `main`.
- Merge em branch protegida (`dev`/`main`) é SEMPRE manual do usuário, sem opção de automatizar. A política de PR, escada, promoção e carimbo de tag vem dos workflows reutilizáveis do `brabo-ci`, fixados por SHA com `# vX` no `uses:`. Imagem de terceiro por digest com a tag inline. Segredo nunca é impresso; teste nunca roda contra o Postgres da instalação.
- Ref de doc quebrada reprova no próprio PR: o check `refs` (reutilizável `refs-com-simbolo` do `brabo-ci`, não obrigatório) confere cada `caminho:N` (`símbolo`) das RNs, e o artefato `refs-patch` traz a reancoragem (`gh run download <id> -n refs-patch && git apply refs.patch`) (AT-782).
- Regressivo por funcionalidade (AT-769): PR que toca uma funcionalidade do catálogo (`brabo-qa/funcionalidades.yml`, mapa por caminho) ajusta o regressivo dela no `brabo-qa` contra a `dev`, ou diz no card por que não precisa. Na PR para a `dev` o check `Regressivo do brabo-qa` só atesta (nunca obrigatório); na PR para a `main` o `E2E do brabo-qa` roda o catálogo inteiro e bloqueia, salvo `/qa-aceitar`.

## Convenções (agentes, telas e testes)
- Arquivo que outro PROGRAMA vai parsear se prova contra o PARSER dele, nunca
  contra uma asserção de string — é a mesma lição do `#` no `FROM` do
  Dockerfile ("linter concordar não é build concordar"), medida uma segunda
  vez e mais cara. A unit de `systemd --user` do `brabo-runner` saía com
  `WorkingDirectory="…"` e NUNCA iniciou, em instalação nenhuma e nas duas
  espécies (`bad-setting`, `path is not absolute`), com a suíte VERDE: cada
  asserção pedia de volta exatamente a forma errada. As TRÊS diretivas que
  carregam valor não têm a mesma sintaxe — `ExecStart=` é unquoted e separado
  em palavras (cada argumento entre aspas, `\`→`\\`, `%`→`%%`, `$`→`$$`),
  `WorkingDirectory=` toma a linha INTEIRA (aspa nenhuma, espaço literal, só
  `%`→`%%`) e `Environment=` é LISTA separada por espaço (a atribuição inteira
  entre aspas, `"VAR=valor"`, com `\`, `"` e `%` escapados — AT-095). Não reuse
  o escape de uma na outra. `systemd-analyze --user verify` sobre a unit GERADA
  (`src/servico-systemd.spec.ts`) prova que ela CARREGA, e não
  basta: `Environment=X=/a/50%off b` carrega e entrega OUTRO valor. O que prova
  o VALOR é o despejo de `systemd --test --user --unit=<u>` sobre uma pasta de
  units temporária, comparado com o gravado; as formas antigas ficam fixadas
  como reprovadas; sem systemd na máquina o teste PULA nomeando o motivo — nunca
  passa em silêncio nem reprova por ambiente, a mesma régua do golden-set. O
  plist do macOS não tinha o defeito (o valor vai num `<string>` de XML), e a
  leitura de volta aceita as DUAS formas, para não tirar `status`/`uninstall`
  de quem tem a unit quebrada em disco — o conserto é REINSTALAR. Terceira vez,
  AT-083: o `.env` do `install.sh` saía com o `SECRET_KEY_BASE` quebrado em duas
  linhas (`openssl rand -base64` quebra aos 64), e o Compose ora recusava, ora
  ACEITAVA cortando o segredo. `scripts/dev/install-env.spec.ts` passa o `.env`
  das funções de verdade por `docker compose config` e cobra cada valor INTEIRO
  do outro lado — "parseia" não basta quando o parser aceita o arquivo errado.

## Regras do runner
- este repo: workspace novo, Node/TS — CLI (`brabo-runner`) que roda
  na máquina do usuário, conectando ao engine via canal Phoenix (`phoenix`,
  embutido no bundle) para executar comandos aprovados e terminal
  interativo (`node-pty`, único `external` do build `tsup` — binding
  nativo, resolvido via `node_modules` de quem instalou o pacote) — ver
  "Runner local" (ADR 0103). Desde a RN-514 (ADR 0147 ponto 1) o `join`
  desse canal NÃO é mais mudo: o runner DECLARA nos params o que sabe
  fazer (`CAPACIDADES_DO_RUNNER` em `channel.ts` — desde a RN-516 as TRÊS,
  `exec`, `pty` e `espelho`, e só o que ele implementa de verdade) e o
  servidor CONCEDE a interseção com o vocabulário que conhece
  (`Engine.Runners.Capacidades`), guardando o conjunto em `socket.assigns`
  e NUNCA em tabela. Params ausentes/vazios são o binário LEGADO e valem
  `{exec, pty}` — fato, não suposição —, nome desconhecido é IGNORADO, e
  capacidade EXIGIDA e não declarada recusa o join NOMEANDO a que falta.
  Quem exige: o `execution_mode` (`runner` exige `exec`;
  `container`/`mounted` não exigem nada) e, desde a RN-516, o DADO
  `projects.mirror_path` — destino de espelho declarado EXIGE `espelho`,
  em qualquer modo. Essa é a primeira exigência que DISPARA de verdade, e
  o custo está declarado no ADR: binário velho num projeto com destino
  deixa de conectar (recusa nomeada, fatal, sem retry), e é opt-in.
  Mensagem cuja capacidade não foi concedida é RECUSADA com resposta
  nomeada — nunca entregue a um handler que não existe do outro lado, que
  era o defeito silencioso que o ADR 0147 nomeia. A resposta do `join`
  também deixou de ser vazia para o `:runner`: é por ela, e SÓ por ela,
  que o DESTINO do espelho chega (`%{espelho: %{destino: ...}}`, ADR 0147
  ponto 4) — nunca configuração local nem variável de ambiente, e o runner
  recusa `mirror_sync` para destino que não lhe foi concedido NAQUELA
  conexão; trocar o destino com o runner de pé exige reconectá-lo. O
  espelho em si (`espelho.ts`/`espelho-guard.ts`) copia a LISTA DO GIT
  numa direção só e NUNCA apaga — arquivo apagado na origem permanece no
  destino —, com guarda IRMÃ de `guard.ts` (mesma dupla passada, mesma
  ressalva de TOCTOU), e é disparado por MOMENTO NOMEADO do engine
  (`mirror_sync`, hoje o commit), nunca por watcher. DOIS caminhos de
  distribuição: clonar o
  repo (dev) e binário standalone via `bun` (`bun build --compile`, ADR
  0112) — o `.node` nativo do `node-pty` embutido por `with { type: 'file'
  }` e extraído para um diretório real em runtime, já que `node-pty`
  resolve seu próprio addon por um `require()` de caminho COMPUTADO que o
  Bun não consegue embutir sozinho. Desde a RN-518 (ADR 0147 ponto 5) ele
  também se INSTALA — `brabo-runner service install|uninstall|status`, nível
  de USUÁRIO sempre (`systemd --user`/`LaunchAgent`), com root RECUSADO e
  Windows recusado por NOME; `Restart=on-abnormal` e
  nunca `on-failure` (exit 1 é recusa fatal de join ou teto esgotado, e
  reiniciar seria o laço que o CLI recusa fazer), autenticação por CHAVE DE
  DISPOSITIVO e nunca por token (uma unit com token o deixaria em disco), e
  `status` com QUATRO estados e quatro códigos de saída — a primeira resposta
  vem do DISCO, então ela continua certa numa máquina sem gerenciador. Desde a
  RN-545 (ADR 0154 ponto 4) são DUAS ESPÉCIES de unit e elas CONVIVEM: a de
  PROJETO (`brabo-runner-<projectId>.service`/`dev.brabo.runner.<projectId>`,
  byte a byte como sempre) e a de MÁQUINA (`brabo-runner.service`/
  `dev.brabo.runner`, sem sufixo), que roda o modo de N conexões da RN-544. Os
  nomes não colidem por CONSTRUÇÃO (`projectId` nunca é vazio, então o de
  projeto sempre tem um `-` onde o de máquina termina), e isso é travado por
  teste. O discriminador é a flag `--machine` e NUNCA a ausência de
  `--project` — o ADR dizia o contrário e foi MEDIDO: `resolverProjeto` tem
  DUAS fontes, e o caminho normal é rodar `install` sem flag de dentro da pasta
  que o navegador configurou, então a letra do ADR converteria em silêncio a
  instalação de quem já usa o produto. `install --machine` RECUSA sem base
  consentida, sem chave, e quando a pasta tem `brabo-runner.config.json` (o
  serviço subiria em modo de PROJETO, em silêncio, atendendo um só), e a unit
  congela `XDG_CONFIG_HOME` mas NUNCA o valor da base — trocar a base é editar
  o arquivo e reiniciar, nunca reinstalar. `install` também RECUSA quando a
  OUTRA espécie já está instalada, nomeando o `uninstall` de cada unit, sem
  remover nem gravar nada e sem `--force`: as duas juntas seriam dois processos
  disputando o mesmo projeto. `status` responde sobre a espécie PERGUNTADA (os
  quatro códigos NÃO viram oito nem se somam) e diz em TEXTO que a outra
  existe, como presença lida do DISCO; sem `--machine` e sem projeto resolvível
  ele cai na MÁQUINA. `uninstall` NÃO herda esse default e recusa listando o
  que existe — ler a espécie errada custa uma linha, remover a errada custa um
  serviço e uma chave.
  Desde a RN-529 (ADR 0151 pontos 1 e 2) ele também pode nascer com uma
  BASE — a pasta da máquina do usuário sob a qual cada projeto é uma
  SUBPASTA. Ela é LOCAL e NUNCA chega pela rede (o desenho do broker, ADR
  0144: quem tem a raiz é quem executa, e o que viaja é o SEGMENTO
  relativo), vem de `--base` ou de `$XDG_CONFIG_HOME/brabo/runner.json`
  (senão `~/.config/brabo/runner.json`, a precedência que `servico.ts` já
  usa) — nunca do `brabo-runner.config.json`, que é POR PROJETO e escrito
  pelo navegador, e nunca de variável de ambiente, que colidiria com
  `BRABO_PROJECTS_BASE` (a base do lado SERVIDOR, ADR 0141) e não
  sobreviveria a uma unit de serviço. `--dir` NÃO muda de significado e a
  base NÃO entra na validação dele: é a proibição de
  `project-workspaces-root.ts` transposta — projeto legado fora da base
  segue válido, e a base é regra de CRIAÇÃO. `base-guard.ts` é o TERCEIRO
  irmão de `guard.ts`, reusando os três helpers, a dupla passada e
  `validarDirDentroDoHomeNoLinux` inteira, e o laço dele é ASSIMÉTRICO (a
  pasta do projeto dentro da base é o arranjo normal; a base dentro da
  pasta do projeto é o defeito). Recusa vinda da FLAG sai com código 2;
  vinda do ARQUIVO é dita e o runner segue SEM base. Ausente é o estado
  normal. Desde a RN-532 (ADR 0151 pontos 3–6) a base tem CONSUMIDOR: o par
  `workspace_create`/`workspace_create_result`, no molde de PEDIDO COM
  RESPOSTA de `exec`/`exec_result` — e nunca no de `workspace_confirm`, que
  é UNIDIRECIONAL. O engine manda `projectId` e o SEGMENTO relativo (nunca
  caminho absoluto); o runner faz `mkdir -p` e `git init`/clone, e a
  confirmação REUSA o `workspace_confirm` que já existia — **nenhuma rota
  nova de gravação nasce**, o engine continua não escrevendo a tabela, e o
  único caminho que carimba `workspace_verified_at` continua sendo um só.
  A ORDEM é o mecanismo (confirm ANTES do resultado: os dois chegam ao mesmo
  processo de canal em ordem, e o handler do confirm é síncrono). A QUARTA
  capacidade, `workspace`, é a única cuja declaração depende do ESTADO da
  execução e não da versão do binário — só é declarada com base consentida,
  e é por ela, e por mais nada, que o servidor sabe que existe base; ninguém
  a EXIGE no join (runner sem base conecta normalmente e só perde essa
  mensagem, recusada com resposta NOMEADA). `estado.dir` NÃO muda com isso:
  trocar em runtime a raiz que `guard.ts` usa moveria uma fronteira de
  contenção por causa de uma mensagem de rede. Criar a pasta NÃO é
  `proposed_action` — é configuração consentida (a linha da RN-516).
  `--project`/`--dir`/`--token` são
  OPCIONAIS quando a pasta tem `brabo-runner.config.json` e a chave de
  dispositivo (RN-464..466, ADR 0118) — gravados, até o ADR 0203, pelo fluxo
  do navegador, que gerava o par Ed25519 (Web Crypto), registrava a pública
  como `runner_device_keys` e gravava os três arquivos via File System Access
  API. Esse fluxo foi APOSENTADO (ADR 0203, RN-687), mas a LEITURA da pasta
  continua: quem a configurou assim segue funcionando —
  `POST .../runner-ticket` aceita essa chave como segunda credencial de
  dispositivo, ADITIVA ao PAT (ADR 0105), nunca um substituto. Desde a RN-551
  (ADR 0155 ponto 4) o gerador é o TERMINAL: `brabo-runner
  device-key create` gera o par NA MÁQUINA e `device-key finish --id <id>`
  carimba o `kid`. São DOIS comandos porque o `kid` É o id do registro no
  SERVIDOR (RN-475) e só existe depois dele — o `create` grava um `.parcial`
  que `lerChaveDeDispositivo` NÃO procura, então o arquivo que o runner lê
  nunca existe sem `kid`. O CLI NÃO fala com a api, e a razão é de SEGREDO:
  quem registra é o instalador, com o `BRABO_SERVICE_TOKEN` — cada lado guarda
  UM segredo e nenhum vê o do outro; o que atravessa é a JWK PÚBLICA e o id.
  Destino padrão `$XDG_CONFIG_HOME/brabo/` (senão `~/.config/brabo/`), modo
  600, REUSANDO a precedência de `base.ts` (`pastaDeConfiguracaoDoBrabo`,
  extraída e nunca copiada) — e isso não reabre a porta do ADR 0104 Onda 2:
  `device-key.ts` continua lendo só do `cwd` que o chamador passar, e quem
  aponta para lá é o `--dir` da unit de máquina. `stdout` carrega UM valor numa
  linha (a pública no `create`, o caminho no `finish`) e todo o resto é
  `stderr` — é o contrato do `$(...)` do instalador. Sobrescrever chave
  COMPLETA é recusado, sem `--force`. Desde a
  RN-544 (ADR 0154) `--project` é opcional por um SEGUNDO caminho, e só por
  ele: o agente de MÁQUINA roda SEM `--project`, consulta
  `GET /runner/projects` e abre **UMA conexão por projeto** listado, cada uma
  em `<base>/<workspaceDirName>` pelas guardas de sempre
  (`resolverPastaDoProjetoNaBase` + RN-434/435 — nenhuma régua nova). Ele exige
  as DUAS coisas, credencial de MÁQUINA e BASE consentida, e sem base rodar sem
  `--project` continua caindo em `uso()`; o modo com `--project` fica BYTE A
  BYTE. Nada no engine muda (tópico, socket id e ticket descrevem uma CONEXÃO),
  e o espelho/`workspace_create` também não — os dois já viajavam na concessão
  do `join` DAQUELA conexão, que é o que os torna corretos com N. O que MUDA de
  comportamento é o laço: o teto de tentativas e a recusa de join deixam de ser
  do PROCESSO e passam a ser do PROJETO — um projeto que recusa ou esgota
  encerra sozinho e NOMEADO, os demais seguem, e só quando NENHUM sobra o
  processo sai com 1, listando o desfecho de cada um. A lista é consultada UMA
  vez, no start — MAS só COM conexão viva (RN-550, ADR 0155 ponto 5): a regra é
  ASSIMÉTRICA de propósito. Com conexão de pé, repesquisar faria uma lista que
  volta MENOR (apagado? convertido? 500 transitório?) derrubar conexão VIVA por
  ambiguidade; com ZERO conexões não há nada a derrubar nem ambiguidade
  nenhuma, então lista VAZIA deixou de SAIR com 0 e passou a ESPERAR —
  reconsulta a 15s/30s/60s (o último se repete), PARA na primeira lista
  não-vazia, sem teto de espera e com teto de DEZ falhas seguidas (saída 1
  nomeando o número; qualquer resposta, vazia inclusive, zera o contador). É o
  caso da instalação nova, e o argumento do `exit 0` caiu junto com a premissa
  dele ("um serviço ativo que não faz nada"): ele reconsulta e DIZ isso, com
  batimento a cada 30 consultas. `Restart=on-abnormal` NÃO muda em unit nenhuma
  (ele nunca olhou código de saída) — o efeito é a unit de MÁQUINA ficar
  `active (running)` de verdade. Exceção declarada: lista NÃO-vazia com TODOS
  os projetos recusados continua saindo com 1, porque ali cada recusa nomeia um
  defeito local com conserto próprio. N conexões exigem N
  `EstadoDoRunner`, e o motivo é medido: quatro campos dele são POR PROJETO
  (`dir`, `canalAtual`, `containerAtivo`, `destinoDoEspelho`) mais o
  `gerenciadorPty`, que nasce de `dir` — um estado compartilhado faria o
  `docker exec` de um projeto rodar no container de OUTRO; `docker` e `base`
  são da MÁQUINA e entram como o MESMO valor em todos, nunca cópias. E o runner
  NÃO adivinha a espécie da própria chave (em disco as duas são o mesmo
  arquivo, uma JWK com `kid`): quem sabe é o SERVIDOR, e o 403 dele é repassado
  NOMEADO, com o conserto. Desde a
  RN-543 (ADR 0154) essa chave tem DUAS espécies, numa tabela só:
  `runner_device_keys.project_id` preenchido é a chave de PROJETO do fluxo
  acima, e NULO é a chave de MÁQUINA, que vale para qualquer projeto em que
  o DONO dela alcance o papel que a rota já exige. A comparação que impede
  a chave do projeto A servir o projeto B NÃO foi apagada — ela some SÓ
  para `null`, onde não há o que comparar, e aí o papel se resolve contra
  o projeto PEDIDO. Nenhum teto novo, nenhum afrouxado: a chave de máquina
  não dá ao runner nada que o dono dela já não tivesse. `user_id` continua
  `NOT NULL` (o ADR recusa chave que atravesse usuários), e `GET
  runner/projects` — a PRIMEIRA rota de credencial de dispositivo SEM
  `:projectId` no caminho, e por isso exclusiva da espécie de máquina — é
  como o agente DESCOBRE os projetos que atende, em vez de adivinhar por
  nome de pasta. Nada no engine mudou: o tópico, o socket id e o ticket
  descrevem uma CONEXÃO, e N conexões os satisfazem byte a byte. O `id` do
  registro vai gravado DENTRO da JWK privada, no `kid` (RN-475): é o único
  vínculo entre o arquivo em disco e a pública do servidor, e a cadeia
  inteira só o REPASSA — o runner lê `jwk.kid`, o JWT de ticket o leva no
  header, o `PatAuthGuard` acha a pública por ele. Ninguém deriva esse id
  de outra coisa. E o CLI distingue chave AUSENTE (caminho normal de quem
  usa flags, cai no bloco de uso) de chave PRESENTE e recusada (mensagem
  própria, nomeando arquivo e motivo) — colapsar os dois é o que fez um
  bug de uma linha custar uma caçada. Docker mora atrás de uma PORTA de
  CINCO operações (`brabo-contracts:packages/docker-port`, ADR 0130 — ela NASCEU em
  `src/` e MOVEU quando o broker virou o segundo consumidor:
  `start`/`stop`/`remove`/`inspect`/`exec`), implementada sobre
  `execFile('docker', …)` do `node:child_process`
  — ZERO dependência nova, e por decisão medida, não por gosto (ADR 0128):
  `dockerode` foi instalado e provado contra os artefatos, e o
  `bun build --compile` reprovou resolvendo o `.node` de `cpu-features`, que
  a árvore SSH de `docker-modem` arrasta mesmo quando só se fala com o
  socket unix. O broker NÃO herdou a escolha por herança técnica (ele nunca
  vira binário) e sim por decisão: um mecanismo, não dois. A contenção é o
  TIPO: sem campo para `privileged`/`cap_add`, rede é a união
  `'none' | 'egress'`, e o bind é UMA pasta de tipo MARCADO com destino
  constante — não há lista de mounts. O `docker run` composto por `DockerViaCli` leva `--init` como CONSTANTE (RN-738):
  o `sleep infinity` de espera (ou, com `comandoDoApp`, o supervisor do ADR 0228 — o runner ainda NÃO liga esses campos, que ficam ausentes e byte a byte) é PID 1 e não recebe SIGTERM sem init, e `stop`
  levava 10 s até o kill (`Exited (137)`); e `--restart unless-stopped`, também
  CONSTANTE (RN-820): daemon reiniciado religa o container, `stop` explícito não —
  nunca `always`. `pidsLimit` entrou na spec no ADR 0130,
  porque o artefato do Arquiteto sempre teve três números e descartar um faria
  ele prometer um teto que o container não recebe. Do lado do RUNNER, essa
  porta deixou de ser só provada por `--self-test-docker` (ADR 0112/0128) e
  ganhou uso real:
  `container_start`/`container_stop`/`container_remove` (ADR 0137,
  RN-497), três pares novos no canal Phoenix (mesmo molde de
  `exec`/`exec_result`), fazem `DockerViaCli.start/stop/exec` de
  verdade, com o Docker do PRÓPRIO usuário — para projeto
  `mounted`/`runner`, que o broker nunca alcança (a pasta mora numa
  máquina que o servidor não enxerga). Desde a RN-507 (ADR 0145), Docker é
  PRÉ-REQUISITO real do modo `runner` — sem container `running`
  REGISTRADO, `TerminalExecutor` recusa e nem chega a mandar comando pro
  canal — e o par `exec`/`exec_result` ganha um campo `env` opcional
  (`Record<string,string>`) para a credencial de git (ADR 0056) viajar
  no ambiente do processo filho que `src/exec.ts` spawna no
  HOST do usuário: mesclado sobre `process.env` (nunca substitui —
  perderia PATH), nunca repassado ao `docker exec` (a porta de Docker não
  ganhou campo de `env`, de propósito) e nunca logado. Desde o ADR 0193
  (RN-676, decisão do dono) o git CREDENCIADO roda no HOST e o código no
  container: o engine marca o `git fetch` autenticado de `RunnerGit` com
  `gitCredenciado: true` — por UM ponto, `RunnerRouter.exec_git_credenciado/5`
  — e o runner, com a marca E `env` não vazio, roda o comando no host mesmo
  com container ativo (a mesma pasta: `estado.dir` é o bind-mount de `/work`).
  O discriminador é a MARCA, nunca o `env`: `env` sem a marca, com container
  ativo, segue RECUSADO pela RN-558 (`MARCA_DE_CREDENCIAL_NAO_ENTREGUE`, par
  de protocolo com `Engine.Runners.CredencialDeGit`, guarda em
  `scripts/ci/marca-de-credencial-do-runner.spec.ts`) — senão o `env` viraria
  a porta de saída do container. Na prática essa recusa só aparece com runner
  ANTERIOR ao ADR 0193. Quem decide host×container continua sendo o RUNNER
  (`containerAtivo` nasce `null` a cada execução): não suba isso para
  `RunnerReadiness`, que fica byte a byte, e não dê `env` à `DockerPort`

## Documentação é parte da definição de pronto (permanente)
- A doc deste repo mora em `docs/` e é em pt-BR por padrão (decisão do dono, 06/11/2026, ADR 0266, que reverte o ADR 0260 e a AT-745; sem `docs/i18n/` nem campo `idioma_original`). Ao alterar código, atualize a doc da área NA MESMA mudança e mostre o diff dela junto com o do código. Não pergunte se deve: faça. NUNCA crie `website/docs/`: o site é agregado pelo `brabo`, que lê a `docs/` de cada repositório.
- Mudança de comportamento observável → entrada em `CHANGELOG.md` (Unreleased). Versão própria a partir da 1.0.0, e toda tag nasce de workflow (nunca versionar à mão).
- Regra de negócio nova → RN-XXX com `caminho:N` (`símbolo`) e o teste que a cobre, na `docs/business-rules*` deste repo; a numeração é UMA só no produto (nunca reinicie), a âncora `{#rn-NNN}` é o contrato e não muda quando a RN muda de arquivo. Aloque o número varrendo as branches locais e o remoto (colide com frente paralela).
- Mudança estrutural (fronteira de camada, banco, modelo de consistência, dependência pesada) → ADR novo com o próximo número; ADR aceito NUNCA é editado (o novo o referencia). Os ADRs moram no repo `brabo` (a porta de entrada do produto).
- Nunca inventar conteúdo de doc: sem informação suficiente, use `> **TODO(humano):** <pergunta específica>.`. Diagramas em Mermaid no próprio Markdown, nunca imagem.
- Este arquivo também é doc: toda mudança verifica se ele precisa mudar (Stack, convenções, "O que NÃO fazer"). Ele é lido em toda sessão e não passa de 40 mil caracteres (`wc -m`, nunca `wc -c`); o que só vale para uma área sai daqui para `.claude/rules/` com `paths:`.

## Estado, decisões abertas e lacunas que são DESTE repo
- `guard.ts` do runner é best-effort por invariante, não lacuna
- Release do runner (AT-794): a Release da tag nasce RASCUNHO e o job `checksums` a publica só com os três alvos anexados; faltando algum o run fica vermelho e a Release segue rascunho (completar = `workflow_dispatch` com a tag). O `macos-14` deixou de ser suportado pelo GitHub (v1.1.0 saiu sem `darwin-arm64`); o alvo usa `macos-15`. Teste: `src/release-completo.spec.ts`.
- Binário standalone: TRÊS alvos na matriz desde o ADR 0187, os três PROVADOS
  em ensaio, e DOIS chegando à Release. `v4.0.1` e `v5.0.0` anexam
  `brabo-runner-linux-x64` e `-linux-arm64` (medido com `gh release view`) — a
  corrida com o `release.yml` que derrubava o anexo na `v4.0.0` FOI corrigida,
  com espera de teto 600s em `build-runner-binaries.yml`. O `darwin-arm64`
  CONSTRÓI e passa o smoke em ensaio (`workflow_dispatch` com tag vazia, runs
  36779817686 e 36805241339): o que o derrubava era o oven-sh/bun#25822, MEDIDO —
  sob o Bun o `tty.ReadStream` com que o `node-pty` lê o PTY morre no primeiro
  `EAGAIN` do fd não-bloqueante, e o terminal do binário parava depois do
  primeiro pedaço nas três plataformas Unix (o Linux passava na prova por sorte
  de tempo). Sob o Bun o runner lê o PTY com leitor próprio
  (`src/leitor-de-pty.ts`, RN-688), e o `--self-test-pty` faz uma
  segunda volta depois de uma pausa, que reprova o leitor antigo também no
  Linux — falta só uma TAG para ele chegar à Release. O `win32-x64` SAIU por
  decisão do mantenedor (ADR 0187, AT-343), no molde do Mac Intel: quatro
  ensaios (36775746724, 36779817686, 36780804339, 36781729045) o levaram até
  carregar o `node-pty` (o caminho virtual `B:/~BUN/root/`, também sem os
  dois-pontos, reconhecido em `src/binario-compilado.ts` — fica,
  é o ponto de partida da volta), e a SONDA do auto-teste mediu que sob o Bun
  o pipe de saída do ConPTY termina depois do primeiro pedaço: até
  `cmd.exe /c echo` morre com 0xC000013A. O `darwin-x64` (Mac Intel) saiu antes
  (ADR 0174, AT-065): `macos-13` não tem runner e no `macos-15-intel` é esse
  bug do Bun que reprova, com a MESMA prova passando sob Node — e ali só com
  `chmod +x` no `spawn-helper`, que o `node-pty@1.1.0` traz em `0644`; desde a
  AT-114 o runner acrescenta esse bit sozinho ao carregar o `node-pty` sob Node
  (`src/spawn-helper.ts`, só darwin, erro nomeado se falta ou o
  `chmod` é recusado), provado por teste e NUNCA num macOS real. Mac Intel e
  Windows não têm instalação (o npm saiu na AT-774): o proxy recusa os dois com 400
  próprio (`SEM_BINARIO_POR_DECISAO`, nome e ADR por plataforma), o `install.sh`
  diz isso sem baixar no Mac Intel e, no Windows, na recusa que ele já fazia da
  instalação inteira (ADR 0150). Os TRÊS lugares que enumeram alvos (matriz,
  `PLATAFORMAS` da api, o `case` do `install.sh` — a lista do web saiu com o
  fluxo do navegador, ADR 0203) são amarrados por
  `scripts/ci/alvos-do-runner.spec.ts` — religar o Mac Intel ou o Windows é ADR
  novo, depois de o Bun corrigir, nunca só devolver as linhas da matriz

## O que NÃO fazer
- Não instalar libs sem justificar no plano. Não refatorar código de fase concluída sem pedido explícito.

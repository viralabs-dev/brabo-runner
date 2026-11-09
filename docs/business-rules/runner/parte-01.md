---
id: rn-runner-parte-01
title: 'Regras de negócio — Runner — parte 1 (desde RN-423)'
sidebar_label: 'Runner — parte 1 (desde RN-423)'
description: 'As RNs hospedadas na raiz runner.'
keywords: [regras de negócio, runner]
---

# Runner — parte 1 (desde RN-423)

## Onda 1 do ADR 0104 — `execution_mode` em três valores, workspace verificado pelo runner

<a id="rn-423"></a>

### RN-423 — O runner CONFIRMA o caminho; sem confirmação, o comando é recusado — nunca cai no container {#rn-423}

O runner é a **fonte da verdade** do caminho de um projeto `runner`, não o
que foi digitado no wizard. Logo depois do canal Phoenix conectar
(`terminal:<projectId>`, papel `:runner`), `apps/runner/src/index.ts`
empurra `workspace_confirm` com o `--dir` que recebeu na linha de comando.
O engine repassa (`Engine.Sessions.EngineApiClient.confirm_workspace/4`)
para `POST /internal/projects/:projectId/workspace-verification`
(`ConfirmProjectWorkspaceUseCase`), que:

1. Recusa com `400` se o projeto não estiver no modo `runner`;
2. Revalida o caminho pelo MESMO predicado léxico da criação
   ([RN-422](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-422)) — mesmo vindo do runner, raiz de sistema e
   sobreposição com o Brabo continuam proibidas;
3. **SOBRESCREVE** `workspacePath` com o caminho normalizado e grava
   `workspaceVerifiedAt = now()` — sem exigir igualdade com o que foi
   digitado na criação: o runner manda;
4. É IDEMPOTENTE — reconectar reportando o MESMO caminho não regrava nada
   (`changed: false`); um caminho DIFERENTE regrava, porque o runner
   continua sendo a fonte da verdade a cada reconexão;
5. Sem sessão no projeto ainda (`ProjectSession.latest_id/1` devolve
   `nil`): o `UPDATE` acontece do mesmo jeito, só o evento
   `project.workspace_verified` (e a evidência do gate
   `workspace-verificado`) fica ausente — a MESMA degradação que
   `pty_open`/`pty_close` já aceitam (RN-108/RN-420). Lacuna aceita e
   declarada, não silenciosa.

`Engine.Actions.TerminalExecutor.decisao_de_execucao/1` ganhou QUATRO
saídas, não duas: `runner` com `workspace_verified_at: nil` recusa
(`:recusar_nao_verificado`); `runner` verificado sem runner conectado
recusa (`:recusar_runner_desconectado`); `runner` verificado e conectado
roteia (`:rotear_runner`); qualquer outro modo segue o caminho de sempre
(`:caminho_de_sempre`). As duas recusas NUNCA caem no `System.cmd` — um
projeto `runner` não tem bind-mount, e "cair pro caminho de sempre" seria
executar às cegas numa pasta que o processo do engine não enxerga. A
mesma recusa vale na corrida (`Registry` dizia conectado no início de
`run/3`, mas o runner caiu antes do dispatch responder).

- **Onde:** `apps/api/src/application/use-cases/iam/confirm-project-workspace.use-case.ts`,
  `apps/api/src/interfaces/http/internal/internal-projects.controller.ts`
  (`POST :projectId/workspace-verification`),
  `apps/engine/lib/engine/actions/terminal_executor.ex`
  (`decisao_de_execucao/1`), `apps/engine/lib/engine_web/channels/terminal_channel.ex`
  (`handle_in("workspace_confirm", ...)`), `apps/engine/lib/engine/sessions/engine_api_client.ex`
  (`confirm_workspace/4`), `apps/runner/src/channel.ts`
  (`enviarWorkspaceConfirm`), `apps/runner/src/index.ts`
- **Teste:** `apps/api/test/application/use-cases/iam/confirm-project-workspace.use-case.spec.ts`,
  `apps/engine/test/engine/actions/terminal_executor_test.exs`
  (describe "roteamento pro runner local"),
  `apps/engine/test/engine_web/channels/terminal_channel_test.exs`
  (describe "workspace_confirm"), `apps/runner/src/channel.spec.ts`
  (`enviarWorkspaceConfirm` depois do join)
- **Borda:** o `apps/api/config/gates.yml` registra `workspace-verificado` como
  `severidade: warn` — quem trava de verdade é a recusa explícita do
  engine, o gate é só o registro/evidência.
- **Decisão arquitetural:**
  [ADR 0104](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0104-execution-mode-tres-valores-e-workspace-verificado-pelo-runner.md)
- **Origem:** reconciliação do ADR 0104, decisão confirmada com o dono do
  produto (o runner é a fonte da verdade; sem sessão, o UPDATE acontece
  mesmo assim; comando recusado explicitamente sem verificação/conexão)

---

<a id="rn-429"></a>

### RN-429 — Navegação de pasta local é relay puro pelo Runner, nunca a api enumerando o container {#rn-429}

O canal `terminal:<projectId>` ganha dois eventos, no MESMO desenho de relay
do PTY: `fs_list_dir`/`fs_home_dir` (`:web` pede, engine faz relay DIRETO
pro pid do runner registrado, erro imediato quando não há runner conectado
— nunca fica esperando uma resposta que não vem) e
`fs_list_dir_reply`/`fs_home_dir_reply` (`:runner` responde, broadcast
filtrado só pra `:web`, correlacionado por `ref` gerado pelo cliente). A api
NÃO ganha rota nova nenhuma — ela continua sem enumerar filesystem, o
argumento que a ADR 0072 já tinha fixado contra um seletor de pasta continua
de pé. `apps/runner/src/guard.ts` (que restringe `cwd` de comando já
aprovado à raiz do projeto) de propósito NÃO se aplica à navegação — listar
diretório é leitura livre pela máquina do usuário, com os privilégios que
ele já tem, e uma entrada sem permissão é pulada, não aborta a listagem
inteira.

Gap declarado: o ticket do canal é emitido POR PROJETO já existente — na
tela de criação de projeto (`NewProjectWizard.tsx`), o projeto só nasce na
confirmação, então `FolderBrowserModal` recebe `projectId: null` ali e
mostra o estado declarado em vez de tentar uma conexão impossível; o campo
de texto livre continua sendo o caminho manual, como antes.

- **Onde:** `apps/engine/lib/engine_web/channels/terminal_channel.ex`;
  `apps/runner/src/fs-browser.ts`, `apps/runner/src/channel.ts`,
  `apps/runner/src/index.ts`; `apps/web/src/lib/fs-browser-channel.ts`,
  `apps/web/src/components/FolderBrowserModal.tsx`,
  `apps/web/src/components/RunnerOnboardingPanel.tsx`,
  `apps/web/src/routes/NewProjectWizard.tsx`,
  `apps/web/src/routes/code/TerminalPanel.tsx`
- **Teste:** `terminal_channel_test.exs` (relay puro web↔runner, erro
  imediato sem runner, papel errado ignorado); `fs-browser.spec.ts`
  (ordenação, pasta vazia/inexistente/arquivo, permissão por entrada);
  `FolderBrowserModal.test.tsx` (projectId nulo, navegação, seleção, sem
  runner); `NewProjectWizard.test.tsx` (botão "Procurar pasta...")
- **ADR:** [0107](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0107-navegacao-de-pasta-local-via-o-runner.md), revisa
  a [0072](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0072-projeto-local-ou-container.md) sem editá-la
- **Origem:** pedido do dono do produto — "não consegui linkar com uma
  pasta do usuário"

---

## Terminal do runner local preso em "Abrindo terminal..." para sempre (RN-433)

<a id="rn-434"></a>

### RN-434 — No Linux, `--dir` do runner local só é aceito dentro do `$HOME` do usuário {#rn-434}

O CLI `brabo-runner` (modo `runner`, ADR 0103/0104) validava só que
`--dir` existe e é uma pasta — sem restrição nenhuma de ONDE essa pasta
podia estar no sistema de arquivos. `lerArgumentos()`
(`apps/runner/src/index.ts`) passou a chamar
`validarDirDentroDoHomeNoLinux(dir, process.platform, homedir())`
(`apps/runner/src/guard.ts`) logo depois da checagem de existência: no
Linux (`process.platform === 'linux'`), `--dir` só é aceito dentro de
`os.homedir()` — o próprio `$HOME` ou qualquer subpasta dele; um caminho
fora dessa árvore (`/etc`, `/root`, `/`, ou até outra conta em `/home`)
é recusado com `process.exit(2)` e mensagem explicando o motivo e
mostrando o home esperado. Fora do Linux (macOS, Windows) o
comportamento não muda — a restrição é só para Linux.

A checagem reusa `dentroDoEscopo`/`semBarraFinal`, os mesmos primitivos
de comparação de caminho que `validarCwdDentroDaRaiz` já usa no mesmo
módulo, mas é deliberadamente mais simples que ela: sem `realpath` nem
proteção a TOCTOU/symlink, porque não protege contra um SERVIDOR
malicioso (aquele é o papel de `validarCwdDentroDaRaiz`, exercido a cada
`exec`) — é uma checagem de STARTUP do próprio CLI local, orientando o
usuário que digitou um caminho errado ao subir o runner.

- **Onde:** `apps/runner/src/guard.ts`
  (`DirForaDoHomeError`/`validarDirDentroDoHomeNoLinux`),
  `apps/runner/src/index.ts` (`lerArgumentos`)
- **Teste:** `apps/runner/src/guard.spec.ts`
  (`describe('validarDirDentroDoHomeNoLinux', …)` — aceita o próprio
  home e subpasta dele no Linux, recusa caminho fora do home e outra
  conta dentro de `/home` no Linux, e confirma que a restrição NÃO se
  aplica fora do Linux)
- **ADR:** [0104](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0104-execution-mode-tres-valores-e-workspace-verificado-pelo-runner.md)
  (extensão aditiva — o runner já era declarado "fonte da verdade do
  caminho"; esta regra só estreita o que ele aceita como `--dir` no
  Linux)
- **Origem:** pedido explícito do dono do produto, durante um teste real
  de criação de projeto (tentativa de apontar `--dir` para um caminho
  fora do home, `/home/dev/exp001`, que não existia na máquina — levou
  à decisão de travar caminhos fora do `$HOME` no Linux)

---

<a id="rn-435"></a>

### RN-435 — `--dir` do runner local inexistente é criado, não recusado {#rn-435}

O CLI `brabo-runner` (modo `runner`, ADR 0103/0104) recusava com
`process.exit(2)` qualquer `--dir` que ainda não existisse no disco — a
pasta do projeto tinha de ser criada manualmente antes de subir o CLI.
`garantirDiretorio()` (`apps/runner/src/guard.ts`) passou a criar a pasta
automaticamente (`mkdirSync(dir, { recursive: true })`) quando ela não
existe, e `lerArgumentos()` (`apps/runner/src/index.ts`) chama essa função
LOGO DEPOIS de `validarDirDentroDoHomeNoLinux` (RN-434) — a ORDEM é a
regra: a checagem do `$HOME` funciona em caminho que ainda não existe (só
`resolve()`, sem tocar disco), então roda primeiro e continua recusando
`--dir` fora do home no Linux mesmo quando ele ainda não existe, ANTES de
qualquer tentativa de criação — criar primeiro reabriria a brecha que a
RN-434 tinha acabado de fechar. `--dir` apontando para um ARQUIVO já
existente continua erro real (`DirNaoEUmaPastaError`, `process.exit(2)`,
sem tentar criar nada) — este CLI nunca sobrescreve um arquivo
silenciosamente. Falha na criação em si (permissão negada, disco cheio,
etc.) também recusa (`NaoConsegiuCriarDiretorioError`), com a mensagem do
erro original embutida.

- **Onde:** `apps/runner/src/guard.ts`
  (`garantirDiretorio`/`DirNaoEUmaPastaError`/`NaoConsegiuCriarDiretorioError`),
  `apps/runner/src/index.ts` (`lerArgumentos`)
- **Teste:** `apps/runner/src/guard.spec.ts`
  (`describe('garantirDiretorio', …)` — não faz nada quando a pasta já
  existe, cria recursivamente quando não existe, recusa sem criar quando o
  caminho já existe e é um arquivo, e embrulha falha de `mkdir` em
  `NaoConsegiuCriarDiretorioError`; e um caso a mais em
  `describe('validarDirDentroDoHomeNoLinux', …)` provando que um `--dir`
  fora do home e AINDA INEXISTENTE continua recusado, confirmando que a
  ordem das duas checagens não abre brecha)
- **ADR:** [0104](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0104-execution-mode-tres-valores-e-workspace-verificado-pelo-runner.md)
  (extensão aditiva — não muda o desenho do runner como fonte da verdade
  do caminho, só reduz o atrito de subir um projeto novo)
- **Origem:** pedido do dono do produto, ao notar que a pasta de um
  projeto novo no modo `runner` não existia na máquina e precisava ser
  criada manualmente antes de rodar o CLI — o mesmo cenário que motivou a
  RN-434 (`/home/dev/exp001` inexistente), agora resolvido criando a
  pasta em vez de só recusar

---

## O explorador de pasta do Runner vira três colunas, e a criação de um projeto `runner` deixa de esperar o passo final (RN-436/436)

<a id="rn-452"></a>

### RN-452 — `node-pty` resolvido por injeção, não import estático — e a lacuna que isso abriu no smoke do npm foi fechada no mesmo commit {#rn-452}

`pty.ts` deixou de fazer `import * as nodePty from 'node-pty'` estático no
topo do módulo — passou a receber o módulo já resolvido por injeção no
construtor de `GerenciadorDePty`, resolvido uma vez em `main()`
(`src/index.ts`) via `native-pty-loader.ts#carregarNodePty()`. A mudança
existe para o binário standalone (ADR 0112): o caminho compilado precisa
extrair os arquivos embutidos pra um diretório real ANTES de resolver
`node-pty`, o que exige uma chamada assíncrona — incompatível com um
`import` estático hoisted. Fora do binário compilado, o comportamento é
idêntico a antes (`await import('node-pty')`, resolvido do `node_modules`
de quem instalou o pacote).

**A lacuna que a mudança abriu, fechada no MESMO commit**: a ADR 0106 já
registrava que o `import` estático de `node-pty`, por ser hoisted antes de
qualquer parsing de argumento, fazia `smoke-dist.mjs` provar que o binding
nativo carregava só por IMPORTAR `dist/index.cjs` — mesmo no caminho de
`uso()` (zero argumentos), que nunca chega a `main()`. Mover a resolução
pra dentro de `main()` quebrou essa garantia em silêncio, porque
`smoke-dist.mjs` só exercitava o caminho de `uso()`. `smoke-dist.mjs`
ganhou uma terceira checagem — roda o CLI com argumentos válidos (mas sem
api/engine reais do outro lado) e espera a linha `node-pty carregado com
sucesso` no stdout antes de matar o processo — fechando a lacuna que a
própria mudança abriu, em vez de deixá-la como perda de cobertura
silenciosa.

- **Onde:** `apps/runner/src/pty.ts` (`GerenciadorDePty`, injeção de
  `NodePtyModule`); `apps/runner/src/native-pty-loader.ts`
  (`carregarNodePty`); `apps/runner/src/index.ts` (`main`, resolve uma vez);
  `apps/runner/scripts/smoke-dist.mjs` (terceira checagem,
  `verificarNodePtyCarrega`)
- **Teste:** `apps/runner/scripts/smoke-dist.mjs` (caminho npm/tsup) e
  `apps/runner/scripts/smoke-bin.mjs` (caminho binário, RN-451) — os dois
  únicos lugares que exercitam o artefato empacotado de verdade, nenhum
  teste unitário substitui
- **ADR:** [0112](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0112-binario-standalone-do-runner-via-bun-build-compile.md)
- **Origem:** necessidade técnica do binário standalone; a lacuna no smoke
  do npm foi achada por auditoria própria da mudança, não por execução real
  reportando falha

## Configuração do runner pelo navegador (RN-464..466, ADR 0118)

<a id="rn-466"></a>

### RN-466 — `brabo-runner` roda sem `--project`/`--dir`/`--token` quando a pasta tem config local gravada pelo navegador {#rn-466}

> **Revisada pela [RN-687](https://github.com/viralabs-dev/brabo-web/blob/dev/docs/business-rules/web.md#rn-687) ([ADR 0203](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0203-aposenta-o-fluxo-do-runner-pelo-navegador.md), 01/10):**
> o navegador não grava mais esses arquivos — o fluxo foi aposentado. A
> LEITURA continua inteira: uma pasta configurada antes do ADR 0203 segue
> funcionando, e é também por `--dir` apontando para
> `$XDG_CONFIG_HOME/brabo/` que a unit de máquina acha a chave criada no
> terminal (RN-551).

`apps/runner/src/device-key.ts` (módulo NOVO, separado de propósito de
`auth.ts`) lê — nunca escreve — `brabo-runner.config.json`
(`{projectId, apiUrl}`) e `brabo-runner-device-key.jwk.json` do `cwd()`
atual; ausência de qualquer um dos dois devolve `null`, nunca lança, porque
essa ausência é o caso NORMAL de quem ainda usa flags explícitas. Em
`lerArgumentos` (`apps/runner/src/index.ts`), a regra é a MESMA três vezes —
flag explícita sempre vence o arquivo local: `--project` vence
`configLocal.projectId`; `--dir` ausente cai para `.` (a própria pasta onde
o comando roda) quando havia config local, em vez do erro de uso de antes;
`--token`/`BRABO_ACCOUNT_TOKEN` vence a chave de dispositivo local quando
ambos existem. Sem NENHUMA credencial (nem token, nem chave local), o CLI
continua recusando com a mensagem de uso — nada aqui torna a autenticação
opcional, só qual das duas formas é usada.

- **Onde:** `apps/runner/src/device-key.ts` (`lerConfigLocal`,
  `lerChaveDeDispositivo`), `apps/runner/src/index.ts:95-206`
  (`lerArgumentos`)
- **Teste:** `apps/runner/src/device-key.spec.ts` (caminho feliz de cada
  leitura; `null` sem lançar para arquivo ausente/JSON inválido/campo
  faltando; respeita o `cwd` recebido; módulo não importa
  `writeFileSync`/`mkdirSync`)
- **ADR:** [0118](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0118-configuracao-automatica-do-runner-pelo-navegador.md)
- **Origem:** pedido do dono do produto

## O artefato de decisão dos conversacionais (RN-505)

<a id="rn-507"></a>

### RN-507 — Docker vira pré-requisito real do modo `runner`: os TRÊS modos de execução exigem o MESMO predicado {#rn-507}

Até aqui, `Engine.Actions.TerminalExecutor.decisao_de_execucao/1` checava só
DUAS pré-condições para rotear terminal a um projeto `execution_mode: runner`
— workspace CONFIRMADO e runner CONECTADO agora — e roteava incondicionalmente
assim que as duas batiam, sem checar se havia container `running` REGISTRADO
(`Engine.Containers.ProjectContainerLifecycle.running?/1`), o mesmo predicado
que `container`/`mounted` já exigiam desde a RN-502 (ADR 0143). O runner do
lado de lá decidia sozinho se o comando rodava dentro do container que ele
subiu (ADR 0137) ou caía no HOST puro — e sem Docker de pé na máquina do
usuário, caía sempre no host, silenciosamente: o isolamento que o ADR 0134
buscou criar para `container` nunca valeu para `runner`.

**A correção unifica os três modos sob a MESMA pergunta.** `runner` ganha uma
TERCEIRA pré-condição, na mesma ordem que as outras duas: verificado →
conectado → container `running`. As três recusas nomeadas (workspace não
verificado, runner desconectado, sem container) vivem hoje em
`Engine.Runners.RunnerReadiness` — extraído porque um SEGUNDO consumidor
nasceu no mesmo PR (`Engine.Actions.Workspace.RunnerGit`, abaixo): "não são
duas derivações, é esta função com dois consumidores", o mesmo raciocínio do
moduledoc de `ProjectContainerLifecycle`.

**A materialização do worktree do dev agent muda de mecanismo, não de
resultado.** `Engine.Actions.Workspace.ensure!/4` tentava `File.mkdir_p!`/
`System.cmd("git", ...)` LOCAL contra o caminho do HOST, mesmo em modo
`runner` — a lacuna que a RN-478 registrou e deixou ABERTA de propósito ("o
working tree do dev agent não tem onde nascer", já que o processo do engine
não tem bind-mount nenhum para uma pasta que mora na máquina do usuário). A
correção não é "melhorar a mensagem de erro" de novo: `ensure!/4` passa a
bifurcar por `execution_mode` — LOCAL para `container`/`mounted` (inalterado:
`mounted` já enxerga sua pasta via `BRABO_PROJECTS_BASE`, bind-mount por
identidade no engine desde o ADR 0141), via `Engine.Actions.Workspace.
RunnerGit` para `runner`. `RunnerGit` faz `git init`/`remote add`/`fetch`/
`checkout` (e os equivalentes de `File.dir?`/`ls`/`rm_rf` que
`Engine.Dev.WorktreeManager` precisa) como comandos de shell NORMAIS,
entregues pelo MESMO canal Phoenix que já executa terminal aprovado
(`Engine.Runners.RunnerRouter.exec/5`) — nunca um mecanismo novo, e sempre
depois de `RunnerReadiness.verificar/1` confirmar as três pré-condições
(levanta com mensagem nomeada antes de tentar qualquer I/O, nunca um `exec`
às cegas). `Engine.Dev.WorktreeManager` (`create/3`, `remove/2`, `list/1`,
`cleanup_orphans/2`) bifurca pelo mesmo critério.

**O job periódico de limpeza PULA em silêncio, nunca falha.**
`Engine.Dev.WorktreeCleanup.run/0` varria `File.dir?(work_dir)` para decidir
se podava — sempre `false` para `runner` (o caminho é do HOST, o engine não
o enxerga), então `runner` nunca era podado de verdade nem testado por essa
via. O gate vira por MODO: `File.dir?` continua para `container`/`mounted`;
para `runner`, `RunnerReadiness.pronto?/1` decide — sem runner conectado ou
sem container `running` AGORA, o projeto é pulado NESTA rodada (`"não dá pra
saber agora"`, nunca um erro, nunca um worktree tratado como órfão por
engano), e `Enum.each/2` continua para os projetos seguintes sem exceção
nenhuma atravessar.

**O protocolo `exec`/`exec_result` ganha um campo NOVO: `env` (ADR 0056).** O
`git fetch` autenticado de `RunnerGit` precisa da credencial do provider —
que só pode viajar no AMBIENTE do processo filho (nunca argv, nunca
`.git/config`, mesma disciplina de `Engine.Actions.GitAuth` local). Como o
processo filho agora nasce na máquina do usuário, o campo `env` (opcional,
`Record<string,string>`) entra no payload que `RunnerRouter.exec/5`
despacha — presente só quando há credencial de verdade (provider `local`
nunca o carrega). Do lado do runner: `apps/runner/src/exec.ts` MESCLA (nunca
substitui) `opts.env` em cima de `process.env` antes do `spawn` — `env`
definido sem merge descartaria PATH e quebraria a resolução do próprio
binário `git`/`sh`. `apps/runner/src/index.ts` repassa `msg.env` só para o
caminho HOST (`executarComando`) — o container (`docker exec`, via
`packages/docker-port`) não ganhou suporte a `env` (fora de escopo desta
entrega: a operação `exec` da porta continua sem esse campo, de propósito,
ADR 0130). Nenhum log do runner imprime `env` em ponto nenhum — auditado por
grep, `console.log`/`console.warn`/`console.error` seguem citando só
`ref`/`command`/`cwd`/`exitCode`.

- **Onde:** `apps/engine/lib/engine/actions/terminal_executor.ex`
  (`decisao_de_execucao/1`); `apps/engine/lib/engine/runners/
  runner_readiness.ex` (novo); `apps/engine/lib/engine/actions/workspace.ex`
  (`ensure!/4`); `apps/engine/lib/engine/actions/workspace/runner_git.ex`
  (novo); `apps/engine/lib/engine/dev/worktree_manager.ex`;
  `apps/engine/lib/engine/dev/worktree_cleanup.ex`;
  `apps/engine/lib/engine/projects/project.ex` (`all_workspace_dirs/0` ganha
  `execution_mode`); `apps/engine/lib/engine/runners/runner_router.ex`
  (`exec/5`); `apps/engine/lib/engine_web/channels/terminal_channel.ex`;
  `apps/runner/src/channel.ts` (`ExecMessage.env`); `apps/runner/src/exec.ts`;
  `apps/runner/src/index.ts`
- **Teste:** `apps/engine/test/engine/actions/terminal_executor_test.exs`,
  `apps/engine/test/engine/actions/workspace_runner_test.exs`,
  `apps/engine/test/engine/dev/worktree_manager_test.exs`,
  `apps/engine/test/engine/dev/worktree_cleanup_test.exs`,
  `apps/runner/src/channel.spec.ts`
- **ADR:** [0145](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0145-docker-pre-requisito-do-runner.md)
- **Origem:** decisão do dono do produto — Docker vira pré-requisito real do
  modo `runner`, sem fallback pro host

## O espelho copia o trabalho para a pasta do usuário (RN-516)

<a id="rn-516"></a>

### RN-516 — O destino do espelho viaja na CONCESSÃO do join, o espelho copia a lista do git numa direção só e nunca apaga, e o gatilho é um momento nomeado — nunca um watcher {#rn-516}

A metade B da sessão 6 da FASE 28: a capacidade `espelho`
([RN-514](https://github.com/viralabs-dev/brabo-engine/blob/dev/docs/business-rules/engine.md#rn-514), [ADR 0147](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0147-agente-local-com-capacidades.md))
passa a EXISTIR. A [RN-515](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-515) decidiu **onde o destino mora** e não
copiou arquivo nenhum; esta decide **como ele chega ao agente local, o que é
copiado e quando**.

**O destino viaja na concessão do `join`, nunca em configuração do runner.**
A resposta do `join` do canal `terminal:<projectId>` deixou de ser vazia para
o papel `:runner`: quando o projeto tem destino declarado
(`projects.mirror_path`) **e** a capacidade `espelho` foi concedida, ela
carrega `%{espelho: %{destino: "<caminho>"}}`. O runner guarda isso em
`estado.destinoDoEspelho`, que morre junto com a conexão, e **recusa
`mirror_sync` para destino que não lhe foi concedido naquela conexão** (ADR
0147, ponto 4). Nunca variável de ambiente, nunca arquivo local: um destino
global faria o artefato do projeto B aterrissar na pasta do projeto A, e o
usuário descobriria isso **pelo conteúdo, não por um erro**.

Consequência declarada, e ela é o preço: **trocar o destino com o runner
conectado exige reconectá-lo.** A concessão é do join, e um destino novo
chegando por outra porta seria exatamente a configuração global que a regra
recusa.

**`mirror_path` não-nulo passa a EXIGIR a capacidade.** Ela não entra no mapa
por `execution_mode` — quem a exige é um DADO do projeto, não o modo (e
`mounted` e `runner` podem ter destino enquanto `container` não pode). Este é
o **primeiro caso REAL** do mecanismo de recusa que a RN-514 deixou
implementado e sem nenhum disparo: um `brabo-runner` anterior a esta versão
conectado a um projeto com destino **deixa de conectar**, com recusa nomeada
(`JoinRecusadoError`, fatal e sem retry). É **opt-in** — só acontece onde
alguém configurou um destino — e o custo está declarado no próprio ADR 0147.

**As TRÊS recusas da guarda, e a passada de `realpath` não é redundante.**
`apps/runner/src/espelho-guard.ts` é **irmão de `guard.ts`, não uma extensão
dele**: reusa `semBarraFinal`/`dentroDoEscopo`/`realpathMaisProximo` e a dupla
passada léxica-depois-`realpath` de `validarCwdDentroDaRaiz`, e herda por
escrito a mesma ressalva de **TOCTOU** — é best-effort, não fronteira de
segurança. Ele recusa (1) symlink que escape do destino, (2) destino que
**contenha** o workspace e (3) destino **dentro** do workspace; (2) e (3) são
o mesmo laço em sentidos opostos, e com o bind por identidade do
[ADR 0141](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0141-base-unica-dos-projetos-montados.md) escrever o espelho
dentro da origem faz o espelho copiar o próprio espelho. A api já recusou a
metade **léxica** ([RN-515](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-515)) e diz, no próprio código, que é só o
léxico — ela não tem disco onde resolver um symlink do computador do usuário.
`destino/atalho -> /caminho/do/projeto` passa por lá sem ser visto, e é aqui
que ele é resolvido.

Uma diferença de mecanismo, achada implementando: `realpathMaisProximo` cai no
primeiro ancestral que existe, e o destino do espelho quase nunca existe (é o
`mkdir -p` desta rodada que o cria). Colapsar os dois lados no ancestral faria
`/base-outra` e `/base` virarem ambos `/`, e a guarda recusaria toda pasta
irmã. Por isso a segunda passada resolve o ancestral e **recoloca o sufixo** —
symlink só pode morar num segmento que existe, então o que sobra nunca esconde
link nenhum. A recusa (1) tem ainda uma segunda metade, **por arquivo**
(`caminhoNoDestino`): um `destino/sub` que é link para `/etc` faria a cópia de
`sub/passwd` escrever fora, com o destino em si perfeitamente válido.

**Uma direção, e NUNCA apaga.** Workspace → destino. Nunca `--delete`, nunca
`unlink`, nunca `rm`. **Arquivo apagado no workspace permanece no destino**, e
isso é decisão, não descuido: a pasta do usuário não é réplica, é acúmulo — um
agente que apaga arquivo na pasta pessoal de alguém por causa de um `git clean`
do outro lado é a surpresa que o produto existe para não produzir.
Sobrescrever arquivo que mudou é esperado; remover nunca é. O preço, declarado
no ADR: o destino só cresce, e nenhum mecanismo automático o limpa.

**O que se copia é a LISTA DO GIT, e nada mais.** Os arquivos **rastreados**
(`git ls-files`) mais os **não-rastreados que não são ignorados**
(`git ls-files --others --exclude-standard`), com `-z` (o git aspeia e escapa
caminho com espaço ou acento sem ele). Isso é exatamente "o trabalho": pula
`node_modules`, `dist`, saída de build e o próprio `.git` **sem manter lista de
exclusão nenhuma**, que envelheceria a cada stack nova — o `.gitignore` do
projeto já é a lista, mantida por quem mantém o projeto. O workspace é
repositório git **por construção** (o produto provisiona Gitflow nele e o
materializa com `git init`/`fetch`/`checkout`), então a pré-condição é do
PRODUTO, não uma suposição sobre a máquina. Git que falha ou pasta que não é
repositório **falham com motivo nomeado** — nunca um `cp -r` de tudo como
plano B, que é como `node_modules` inteiro acabaria na pasta pessoal de alguém.

Duas propriedades verificadas e declaradas, não escondidas: repositório git
**aninhado** volta como UMA entrada de diretório e não é descido — o worktree
de cada dev agent (`<workspace>/.worktrees/<agent_id>`) é um desses, então o
espelho mostra o **checkout principal**, nunca o trabalho ainda isolado num
worktree; e **symlink na origem é pulado**, porque seguir o link traria
conteúdo de fora do projeto para dentro da pasta pessoal. O que fica de fora é
CONTADO (`pulados`/`recusados`), nunca engolido. E não há heurística de
"mudou?": copiar sempre custa bytes já iguais, enquanto pular por tamanho+mtime
faria o espelho, em silêncio, não copiar um arquivo que mudou.

**Predicado PRÓPRIO, e o espelho não exige Docker.**
`Engine.Runners.RunnerReadiness` fica **byte a byte como está** (ADR 0147,
ponto 3) — `Engine.Runners.Espelho` não o chama, não o estende e não recebe
nada dele. O espelho tem DUAS pré-condições, workspace confirmado e runner
conectado, e não a terceira que a [RN-507](#rn-507) acrescentou (container
REGISTRADO `running`). Um `RunnerReadiness` com flag "pula container" é
precisamente o mecanismo pelo qual essa terceira cai por acidente para o `exec`
numa refatoração futura, e o
[ADR 0145](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0145-docker-pre-requisito-do-runner.md) existe para
ela não cair. E o espelho legitimamente não precisa dela: a terceira existe
porque havia duas execuções possíveis e a errada era invisível; cópia de
arquivo na máquina do usuário não tem container de onde cair. Ele também não
pergunta o `execution_mode` — quem já decidiu isso foi a api ao gravar o
destino ([RN-515](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-515) recusa `container`), e repetir a decisão seria a
segunda fonte da mesma regra.

**Gatilho por MOMENTO NOMEADO, nunca watcher.** O engine empurra `mirror_sync`
de um ponto do código que tem nome — hoje o **commit bem-sucedido**
(`EngineWeb.ActionCommandController`, `git_commit`). Nunca `fs.watch`: watcher
é trabalho ilimitado disparado por qualquer coisa — uma instalação de
dependências, um build, e pior, pelas escritas do próprio espelho, que é laço —
e rodaria continuamente na máquina do usuário sem ninguém ter pedido, que é o
oposto do que "agente local" deve significar. O empurrão é **fire-and-forget**:
sem `from`, sem `pending_execs` e sem `mirror_sync_result`, porque quem
disparou está no meio de outra coisa e a telemetria da sincronização é o ponto
7 do ADR, de outra sessão. Falha do espelho vira log local, nunca exceção que
derruba o runner e nunca silêncio.

**Ele NÃO é `proposed_action`, e não deve virar uma.** A escrita do espelho é
configuração que o usuário declarou, não um agente pedindo para agir — o ADR
0147 é explícito disso, e sincronizar por comando de terminal cairia no escopo
do [ADR 0055](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0055-escopo-de-caminho-na-politica-de-terminal.md) e viraria
fila de aprovações rotineiras, corroendo o teto que dá sentido ao clique.

- **Onde:** `apps/runner/src/espelho-guard.ts` (as três recusas, a dupla
  passada com sufixo preservado, a ressalva de TOCTOU herdada);
  `apps/runner/src/espelho.ts` (a lista do git, a cópia numa direção, o
  `mkdir -p` só DEPOIS da guarda); `apps/runner/src/guard.ts` (os três
  helpers passam a ser exportados — uma fonte só de comparação de caminho);
  `apps/runner/src/channel.ts` (`CAPACIDADES_DO_RUNNER` ganha `espelho`,
  `MirrorSyncMessage`, `EspelhoConcedido`, `espelhoConcedidoDaResposta`);
  `apps/runner/src/index.ts` (`EstadoDoRunner.destinoDoEspelho`,
  `tratarMirrorSync` — a recusa do destino não concedido);
  `apps/engine/lib/engine/runners/capacidades.ex` (`exigidas/2`/`conceder/3`
  e `destino?/1` — o destino, não o modo, é quem exige);
  `apps/engine/lib/engine/runners/espelho.ex` (o predicado próprio, o
  `destino/1` do join e o `sincronizar/2` fire-and-forget);
  `apps/engine/lib/engine/projects/project.ex` (`mirror_path` no schema de
  leitura); `apps/engine/lib/engine_web/channels/terminal_channel.ex` (a
  concessão na resposta do join e o `dispatch_mirror_sync`);
  `apps/engine/lib/engine_web/controllers/action_command_controller.ex` (o
  gatilho do commit)
- **Teste:** `apps/runner/src/espelho-guard.spec.ts` (destino dentro,
  destino contendo, symlink de verdade em `tmp` escapando pelo próprio
  destino e por um segmento do meio, `/base-outra` vs `/base`, o alvo por
  arquivo, `lstat` vs `stat`); `apps/runner/src/espelho.spec.ts` (repositório
  git de verdade: rastreado + não-rastreado-não-ignorado, ignorado de fora,
  **arquivo apagado na origem permanece no destino**, repositório aninhado
  pulado, symlink da origem pulado, symlink do destino recusado, guarda antes
  do `mkdir`, pasta sem git falhando nomeada);
  `apps/runner/src/channel.spec.ts` (o destino vindo na resposta do join, as
  três capacidades declaradas, `mirror_sync` chegando ao handler);
  `apps/runner/src/index-handlers.spec.ts` (`describe "tratarMirrorSync"` — o
  destino não concedido recusado, a conexão sem concessão, a falha que não
  lança, e o canal sem push nenhum de volta);
  `apps/engine/test/engine/runners/capacidades_test.exs` (o destino exigindo
  a capacidade, o binário legado recusado, `destino?/1`);
  `apps/engine/test/engine/runners/espelho_test.exs` (as DUAS pré-condições
  e a AUSÊNCIA da terceira — `:pronto` sem container nenhum registrado);
  `apps/engine/test/engine_web/channels/terminal_channel_test.exs`
  (`describe "o destino do espelho na concessão do join"` — a concessão, as
  duas recusas e o push de `mirror_sync`);
  `apps/engine/test/engine_web/controllers/action_command_controller_test.exs`
  (o gatilho: commit bem-sucedido dispara, commit que falha não dispara)
- **ADR:** [0147](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0147-agente-local-com-capacidades.md), pontos 2, 3, 4 e 8
- **Origem:** FASE 28, sessão 6 (metade B). Ficou declarado e **não** ligado o
  segundo momento nomeado do ponto 8, "fim de turno de agente": o engine tem
  duas coisas disjuntas com esse nome e nenhuma é um enganche não-ambíguo —
  `Engine.Agents.TurnoAssincrono.finalizar/1` fecha o turno dos seis
  conversacionais, que não têm ferramenta de escrita no workspace, e também
  dispara em crash e em cancelamento; `Engine.Dev.AgentIo.finish_task/3` não é
  fronteira de ociosidade (reivindica a próxima task na mesma chamada) e o que
  o dev agent escreve mora no worktree, que o espelho deliberadamente não
  desce. Escolher um seria inventar produto onde o ADR nomeou um momento sem
  nomear uma função

---

## O agente local vira serviço de USUÁRIO, e `status` não colapsa estado (RN-518)

<a id="rn-518"></a>

### RN-518 — `brabo-runner service install|uninstall|status` instala nível de USUÁRIO e nunca root; `uninstall` limpa a pasta que a UNIT registra; `status` responde quatro estados sem colapsar nenhum; Windows é recusa nomeada {#rn-518}

A sessão 7 da FASE 28 e o **ponto 5** do
[ADR 0147](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0147-agente-local-com-capacidades.md). Até aqui o agente local
era **só primeiro plano**: um processo encerrado por SIGINT/SIGTERM, que morre
com o terminal e não volta com a sessão do usuário. Não havia precedente
nenhum — nenhuma menção a `systemd`, `launchd` ou `LaunchAgent` em
`apps/runner/`.

**Nível de usuário, SEMPRE — e root é RECUSA, não aviso.** `systemd --user`
no Linux, `LaunchAgent` no macOS. Isso não é preferência de empacotamento: o
docblock de `apps/runner/src/guard.ts:9-31` declara *"o runner roda NA máquina
do usuário, com os privilégios DELE"* como a premissa em que as três fronteiras
reais do produto se apoiam (autenticação, pipeline de aprovação,
consentimento) — e a guarda de `cwd` é best-effort **por escrito**, justamente
porque não é ela que segura nada. Um serviço de sistema rodando como root
quebraria o invariante e deixaria a guarda best-effort como única coisa entre
um comando aprovado e o disco da máquina. Por isso `install` com `uid` 0
**recusa nomeando o motivo**, sem escrever arquivo nenhum e sem rodar comando
nenhum: instalar-e-avisar deixaria a instalação errada de pé, e o aviso seria
lido uma vez só.

**Windows fica FORA DE ESCOPO, e a recusa é nomeada.** A matriz de build já
produz o binário de Windows ([ADR 0112](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0112-binario-standalone-do-runner-via-bun-build-compile.md)),
mas serviço de usuário ali é um **terceiro mecanismo** (Serviços do SO com
conta de usuário, ou Agendador de Tarefas no logon) — não uma variação dos
dois. Os três subcomandos respondem nomeando a plataforma, dizendo que a
decisão é declarada, e apontando o caminho que continua funcionando (rodar em
primeiro plano). Nunca falha muda, nunca um "instalado" que não instalou nada.
Qualquer outra plataforma cai na mesma recusa.

**Uma unit POR PROJETO, nomeada pelo `projectId`** — `brabo-runner-<id>.service`
/ `dev.brabo.runner.<id>` — porque o servidor **já impõe um runner por
projeto**: um segundo `join` no mesmo `terminal:<projectId>` é recusado pelo
`Engine.Runners.Registry`. Nomear pela PASTA permitiria instalar duas units que
nunca podem estar de pé ao mesmo tempo, e a segunda apareceria como falha de
conexão em vez de erro de instalação. Instalar de novo, de outra pasta,
**sobrescreve**. `uninstall` e `status` alcançam exatamente a mesma unit porque
derivam o nome do MESMO `projectId`, resolvido pelas MESMAS duas fontes na
mesma ordem do CLI de sempre (`--project`, senão `brabo-runner.config.json`), e
a pasta sai de `resolverDir` de `guard.ts` — nunca uma segunda régua. No Linux
o arquivo vai para onde o systemd **procura**, com a precedência dele:
`$XDG_CONFIG_HOME/systemd/user` quando a variável está posta, `~/.config/systemd/user`
quando não — escolher só o segundo faria a unit nascer onde o gerenciador nunca
olha, e a falha apareceria como *"unit file does not exist"* no `enable`,
visível mas pelo motivo errado.

**O `projectId` vira NOME DE ARQUIVO, então ele é validado aqui.** Ele chega de
duas fontes que não são o servidor (uma flag digitada e um arquivo da pasta), e
um `--project ../../etc/systemd` escreveria fora do diretório de units. Só
letras, dígitos, `.`, `-` e `_`, até 64 caracteres — UUID, o formato real de
todo projeto do produto, passa inteiro. Caminho do runner e pasta com aspa
dupla ou quebra de linha também são recusa nomeada: quebra de linha num arquivo
de unit é injeção de diretiva, não caso de borda.

**Um serviço autentica por CHAVE DE DISPOSITIVO, nunca por token.** `install`
exige `brabo-runner-device-key.jwk.json` válido na pasta e recusa sem ele,
ignorando `--token`/`BRABO_ACCOUNT_TOKEN` de propósito: gravar um token de
conta dentro de um arquivo de unit o deixaria em disco, legível por qualquer
processo do usuário e sobrevivendo ao shell que o exportou — e este CLI **nunca
gravou credencial em disco** (o docblock de `auth.ts` tem uma trava de teste
contra exatamente isso). A [RN-434](#rn-434) roda igual, pela MESMA função:
serviço apontando para fora do `$HOME` no Linux é recusado, porque fazer por
unit o que a CLI recusa fazer por flag seria contornar a regra pela porta dos
fundos.

**`Restart=on-abnormal`, e nunca `on-failure`** (no plist, `KeepAlive` com
`Crashed`, e nunca `SuccessfulExit`). O runner sai com 1 quando o join foi
**RECUSADO** — ticket inválido, outro runner no projeto, capacidade que falta
([RN-514](https://github.com/viralabs-dev/brabo-engine/blob/dev/docs/business-rules/engine.md#rn-514)) — ou quando esgotou o próprio teto de tentativas, e as duas
coisas são "pare e chame um humano". `on-failure` reiniciaria uma recusa fatal
em laço, que é exatamente o que o CLI recusa fazer sozinho. Sinal, OOM e
watchdog — o que `on-abnormal` cobre — são a única falha que reiniciar
conserta. O `PATH` vai **congelado** na unit, com o custo declarado no próprio
arquivo: os dois gerenciadores dão ao serviço um PATH mínimo, e o runner chama
`git` (o espelho, [RN-516](#rn-516)) e `docker` ([ADR 0137](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0137-o-runner-sobe-o-container-do-projeto.md));
sem isso o serviço subiria perfeitamente e as duas funções falhariam com "não
encontrado". É um retrato, e muda só reinstalando.

**As DUAS metades do arquivo de unit NÃO têm a mesma sintaxe, e o
`WorkingDirectory=` vai SEM aspas.** `ExecStart=` é parseado com *unquoting* e
separação em palavras — por isso cada argumento vai entre aspas —, e
`WorkingDirectory=` **não é**: o systemd toma o resto da linha inteiro como
caminho. Tratar as duas como se fossem iguais custou uma release inteira: com
aspas o valor deixa de começar com `/`, a unit é recusada na carga
(`Loaded: bad-setting`, `WorkingDirectory= path is not absolute`) e **nunca
inicia** — nas duas espécies, em instalação nenhuma. A suíte estava verde o
tempo todo, porque cada asserção pedia de volta exatamente a forma errada: por
isso a prova agora é feita contra `systemd-analyze --user verify`, o validador
de verdade, e não contra texto. O que SOBRA para escapar é **um** caractere, e
não é o espaço (a linha vai inteira, então `/home/eu/pasta com espaço` funciona
literal): é o `%`, porque essa diretiva passa por **expansão de
especificador** — `/home/dan/50%off` vira `/home/dan/50<id-do-os-release>ff`
sem erro nenhum, e o serviço sobe na pasta errada. `%%` é a forma de dizer `%`
literal. A leitura de volta aceita as **duas** formas, e isso é dívida
deliberada com quem já tem uma unit quebrada no disco: `status` e `uninstall`
precisam continuar alcançando a pasta dela. Quem está nesse estado conserta
**reinstalando** — `install` sobrescreve o arquivo inteiro.

**E há uma TERCEIRA sintaxe no mesmo arquivo: `Environment=` (AT-095).** Ela é
uma LISTA de atribuições separadas por espaço, com *unquoting* e escape estilo
C, e também expande especificador. Escrita crua — como saía o
`XDG_CONFIG_HOME` da unit de MÁQUINA e o `PATH` das duas espécies —,
`Environment=XDG_CONFIG_HOME=/home/dan/50%off com espaco` chegava ao serviço
como `/home/dan/50popff`: `%o` expandido e `com`/`espaco` descartados pela
separação em palavras. A unit carrega, `verify` aprova, o serviço sobe — e o
agente procura a base e a chave numa pasta que não existe, calado. Por isso a
atribuição INTEIRA vai entre aspas (`Environment="VAR=valor"`), com `\` e `"`
escapados por barra e `%` como `%%`; `$` não se escapa ali (`Environment=` não
expande variável). O `--dir` do `ExecStart=` tinha a mesma classe e foi junto:
cada argumento continua entre aspas, e agora `\` vira `\\`, `%` vira `%%` e `$`
vira `$$` (a substituição de variável do `ExecStart=`). Quebra de linha em
`PATH`/`XDG_CONFIG_HOME` é RECUSADA antes de escrever — num arquivo de unit ela
é diretiva nova, não valor. Nada disso muda a LEITURA de volta: ela só lê o
`WorkingDirectory=`, e nenhum dos dois valores de ambiente é lido do disco. A
prova é o VALOR EFETIVO, não o `verify` (que aprova a forma quebrada): o
próprio `systemd --test --user --unit=<u>`, sobre uma pasta de units
temporária, despeja a configuração resolvida, e o teste compara o que o
systemd ENTENDEU com o que foi gravado.

**Ativação que falha NÃO apaga o arquivo, e não diz "instalado".** Escrever a
unit e ativá-la são dois passos, e o gerenciador pode não estar lá
(`systemctl` fora do PATH, `launchd` recusando). O arquivo **fica** — é o que a
pessoa precisa para terminar à mão — e a resposta é um terceiro desfecho, que
nomeia o comando pendente e o motivo. Apagar o arquivo transformaria "não
consegui ativar" em "não aconteceu nada", que é falso.

**`uninstall` remove os TRÊS, e a pasta sai da UNIT — nunca do `cwd`.** O ADR é
explícito: o arquivo de unit, o `brabo-runner.config.json` e o
`brabo-runner-device-key.jwk.json`. Os dois últimos moram na pasta do runner, e
a pasta que interessa é a que foi **INSTALADA**, não a de onde a pessoa por
acaso digitou o comando — por isso o `WorkingDirectory` é lido de volta do
próprio arquivo da unit, que é o registro do que foi instalado. **Sem unit não
há registro**: os dois arquivos só são removidos com `--dir` explícito, e a
mensagem diz por quê. Adivinhar pelo `cwd` apagaria a chave de um projeto que
ninguém pediu para remover. Desativar que falha vira **aviso** e o arquivo é
removido assim mesmo — uma unit que o gerenciador não reconhece mais não é
motivo para deixar o arquivo para trás.

**E `uninstall` DIZ o que ele não fez: a chave saiu do disco, não do
servidor.** A pública correspondente continua em `runner_device_keys`, e
revogá-la é outra coisa (`DELETE /projects/:projectId/runner-device-keys/:deviceKeyId`,
[ADR 0147](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0147-agente-local-com-capacidades.md) ponto 6). Um "removido"
que deixasse a pessoa achar que revogou seria pior que não remover nada. O log
do LaunchAgent também **não** é apagado: ele é o registro do usuário sobre o
que aconteceu, e apagá-lo não foi pedido.

**`status` responde QUATRO estados, e eles não colapsam** ([RN-088](https://github.com/viralabs-dev/brabo-web/blob/dev/docs/business-rules/web.md#rn-088)):
*não instalado*, *instalado e rodando*, *instalado e parado*, e *instalado e
não consegui perguntar*. A primeira resposta vem do **DISCO** — há arquivo de
unit? —, e é por isso que ela continua certa numa máquina onde o gerenciador
não existe; só depois se pergunta ao gerenciador. `spawn` que falhou (binário
ausente do PATH) **nunca** vira "o gerenciador disse não": são respostas
diferentes, separadas na fonte, e uma palavra que este CLI não sabe interpretar
também cai em "não consegui perguntar" em vez de virar "parado" por chute.
Cada estado tem **frase própria** e **código de saída próprio** (0 / 3 / 4 / 5,
com 1 e 2 fora porque já significam falha genérica e erro de uso neste CLI):
um `exit(1)` único para os três "não está rodando" colapsaria pelo código
exatamente o que a frase separa.

**Nada aqui é `proposed_action`.** É o usuário rodando um comando na própria
máquina, sobre o próprio serviço — não um agente pedindo para agir. `service`
é despachado **antes** de `lerArgumentos`, porque nenhum dos três subcomandos
conecta a nada e o que mais importa (`status`) precisa funcionar numa pasta
cuja configuração está quebrada, que é justamente quando alguém pergunta.

- **Onde:** `apps/runner/src/servico.ts` (novo — o vocabulário, as duas
  plataformas como respostas às MESMAS cinco perguntas, as recusas, os quatro
  estados e `CODIGO_POR_ESTADO`); `apps/runner/src/servico-sistema.ts` (novo —
  o adaptador real de disco e de `systemctl`/`launchctl`, separado para que a
  garantia "`servico.ts` não toca `node:fs`/`node:child_process`" continue
  verificável); `apps/runner/src/index.ts` (`comandoDoRunnerParaServico`,
  `rodarSubcomandoDeServico`, o despacho de `service` em `main()` antes de
  `lerArgumentos`, e a linha nova em `uso()`)
- **Teste:** `apps/runner/src/servico.spec.ts` (novo — caminho feliz nas duas
  plataformas com o conteúdo real da unit/plist; root recusado sem escrever
  nada; Windows nomeado; sem chave de dispositivo; `projectId` que viraria
  caminho; `systemctl` ausente deixando o arquivo e dizendo que não ativou; a
  RN-434 repassada; `uninstall` lendo a pasta da unit e não do `cwd`, sem unit
  e sem `--dir` não tocando em arquivo nenhum, e o `disable` que falha virando
  aviso; os QUATRO estados de `status` mais a palavra desconhecida e os três
  desfechos do `launchctl`; e os quatro códigos de saída distintos);
  `apps/runner/src/index.spec.ts`
  (`describe "brabo-runner service é despachado antes de exigir credencial"` —
  processo de VERDADE numa pasta sem credencial nenhuma: `status` responde 4 em
  vez do bloco de uso, e subcomando desconhecido cai no uso de `service`);
  `apps/runner/src/servico-systemd.spec.ts` (a unit GERADA perguntada ao
  `systemd-analyze --user verify` de verdade, nas duas espécies, com pasta que
  tem espaço e pasta que tem `%` — mais a forma ANTIGA, entre aspas, sendo
  REPROVADA pelo mesmo validador; sem systemd na máquina o arquivo PULA
  nomeando o motivo, nunca passa em silêncio nem reprova por ambiente) — e,
  desde a AT-095, `describe "o valor EFETIVO de Environment= é o valor
  gravado"` e `describe "o --dir do ExecStart= e o WorkingDirectory= também
  chegam intactos"`, que perguntam ao despejo de `systemd --test --user` o
  valor RESOLVIDO de `XDG_CONFIG_HOME`, `PATH`, `WorkingDirectory` e do `--dir`
  com `%`, espaço, aspas, barra invertida e `$`, e fixam a forma antiga do
  `Environment=` como entregando OUTRO valor; `servico.spec.ts` ganhou as duas
  recusas de quebra de linha e a unit de projeto sem `XDG_CONFIG_HOME`
- **ADR:** [0147](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0147-agente-local-com-capacidades.md), ponto 5
- **Origem:** FASE 28, sessão 7. Fica declarado e NÃO feito: **BRB-031** (o
  `chmod +x` manual do fluxo do [ADR 0118](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0118-configuracao-automatica-do-runner-pelo-navegador.md))
  **não** morre aqui — quem roda `brabo-runner service install` já precisou
  tornar o binário executável para chegar até o comando, e o ADR 0147 amarra
  esse efeito colateral à instalação vir do bootstrap versionado do
  [ADR 0146](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0146-base-consentida-no-bootstrap.md), que esta entrega não
  toca. Também fora: qualquer subcomando de `start`/`stop`/`restart` (quem
  gerencia o ciclo de vida é o gerenciador de serviços do SO, e duplicá-lo no
  CLI criaria uma segunda fonte de verdade sobre o estado) e Windows, acima

---

## A flag que liga um agente tem de CHEGAR ao processo (RN-540)

<a id="rn-529"></a>

### RN-529 — O `brabo-runner` nasce com uma BASE local, cada projeto é uma subpasta dela, e a base NUNCA invalida `--dir` {#rn-529}

O agente local não tinha noção de base. A única raiz era `--dir`, resolvida por
`resolverDir` contra `INIT_CWD ?? process.cwd()`; sem a flag, a raiz era o
próprio `cwd`. `estado.dir` é **um** caminho, singular — o do projeto daquela
conexão —, e não existia constante, variável nem campo que dissesse onde os
projetos moram naquela máquina. A palavra "base" só aparecia em comentário.

**A base é LOCAL, e nunca chega pela rede.** É o desenho do broker
([ADR 0144](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0144-a-segunda-raiz-do-broker.md)) aplicado ao agente local:
quem tem a raiz é quem executa, e o que atravessa a rede é o **segmento
relativo**. Não existe campo de base vindo do servidor, e
`resolverPastaDoProjetoNaBase` recusa um segmento ABSOLUTO por léxico — nunca o
"aceita e reinterpreta".

**Duas fontes, e a flag vence.** `--base <caminho>` na linha de comando, e
`$XDG_CONFIG_HOME/brabo/runner.json` (senão `~/.config/brabo/runner.json`), que
é onde o instalador ([ADR 0150](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0150-instalador-de-uma-linha.md)) a grava. O
arquivo é de USUÁRIO e não de projeto de propósito: a base é **uma** para N
projetos, e guardá-la no `brabo-runner.config.json` — que é por projeto, vive
DENTRO da pasta do projeto e é escrito pelo NAVEGADOR — daria N cópias do mesmo
valor com N chances de divergir. Variável de ambiente foi recusada por duas
razões: `BRABO_PROJECTS_BASE` já existe e é a base dos projetos `mounted` do
lado SERVIDOR ([RN-500](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-500)), a colisão de namespace que o
[ADR 0141](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0141-base-unica-dos-projetos-montados.md) recusou por escrito; e
sob `systemd --user`/LaunchAgent ([RN-518](#rn-518)) o ambiente é o da unit, não
o do shell de quem instalou. Só a flag também não bastaria: a base entraria no
`ExecStart` de cada unit, e trocá-la exigiria reescrever todas.

**`--dir` continua significando exatamente o que sempre significou, e a base
NÃO entra na validação dele.** Isto é a proibição da api transposta:
`project-workspaces-root.ts` proíbe por escrito que a regra da base desça para
`caminhoDeWorkspaceLocalValido`, porque aquele predicado roda em toda LEITURA e
um projeto legado fora da base explodiria ao ser lido — *"a base é regra de
CRIAÇÃO e CONVERSÃO; o léxico é para sempre"* ([RN-501](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-501)). Deste lado
vale igual: `--dir` segue validado por `validarDirDentroDoHomeNoLinux` +
`garantirDiretorio` ([RN-434](#rn-434)/[RN-435](#rn-435)), e estar FORA da base
não o invalida. Sem isso a base seria `breaking/` sem ganho, contra o binário
legado da [RN-514](https://github.com/viralabs-dev/brabo-engine/blob/dev/docs/business-rules/engine.md#rn-514). A base decide **só** onde uma pasta de projeto NOVA
nasce.

**A guarda reusa a régua; não nasce uma quarta cópia.** `base-guard.ts` é o
TERCEIRO irmão de `guard.ts`, ao lado de `espelho-guard.ts`: importa
`semBarraFinal`, `dentroDoEscopo` e `realpathMaisProximo` — os três helpers que
deixaram de ser privados justamente para isso ([RN-516](#rn-516)) —, repete a
**dupla passada** léxica-depois-`realpath` de `validarCwdDentroDaRaiz`, e reusa
`validarDirDentroDoHomeNoLinux` INTEIRA para exigir a base dentro do `$HOME` no
Linux (base dentro do `$HOME` implica toda subpasta dentro dele, então as duas
checagens continuam concordando). Da recusa de laço de `espelho-guard.ts` reusa
o que é régua — `dentroDoEscopo`, comparação por SEGMENTO e nunca `startsWith`
cru, para `/base-outra` não contar como dentro de `/base` — e **não** a função
`recusarLaco`, que lança `DestinoDeEspelhoInvalidoError` e reportaria uma base
malformada como problema de espelho. Mesma lição da [RN-515](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-515): reusa-se
a régua, não a mensagem.

**O laço aqui é ASSIMÉTRICO, e esse é o achado.** No espelho os dois sentidos
são defeito. Aqui a pasta do projeto DENTRO da base é o arranjo NORMAL — é
literalmente o que "cada projeto é uma subpasta dela" quer dizer. O sentido
contrário é que é laço: base dentro da raiz deste projeto (ou igual a ela) faria
todo projeto novo nascer dentro deste, com o git e o espelho deste passando a
varrer os outros. Só esse é recusado.

**Recusa tem disposição diferente por FONTE, e nenhuma é silenciosa.** Base
ausente é o estado NORMAL (`null`, o legado intacto). Base pela FLAG que não
passa na guarda sai com código 2 — é um pedido explícito digitado agora e
impossível de honrar, a mesma disposição de `--dir` recusado. Base pelo ARQUIVO
que não passa é dita em `stderr`, nomeia o que se perde ("não terá onde criar a
pasta de um projeto novo") e o runner **segue sem base**: derrubar um agente
local que atende um projeto por causa de uma configuração que ele ainda nem usa
seria desproporcional. Um arquivo que existe e não declara `base` é ausência, não
recusa — é configuração SEM base consentida, não configuração quebrada. E a
linha de startup diz a base nos DOIS estados, porque omitir "nenhuma" deixaria
alguém procurando por que a pasta não apareceu.

**Isto é BEST-EFFORT, e a ressalva de TOCTOU é herdada por escrito** de
`guard.ts` e `espelho-guard.ts`: symlink criado DEPOIS da checagem e ANTES do
`mkdir` não é coberto, nem link cujo alvo ainda não existe. A fronteira de
segurança continua sendo autenticação + pipeline de aprovação + o consentimento
de quem rodou o CLI.

Nada aqui CRIA pasta: a validação da base não exige que ela exista (quem a cria
é o instalador, e é o mesmo raciocínio do
[ADR 0142](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0142-validacao-de-workspace-montado-adiada.md) — validar disco onde
só o léxico é conhecível impediria consentir uma base antes de ela existir). A
única pergunta de disco é a que nunca é ambígua: um caminho que JÁ existe e não
é pasta nunca virará uma.

- **Onde:** `apps/runner/src/base.ts:69` (`caminhoDoArquivoDeBase`, a
  precedência XDG de `servico.ts`), `:106` (`lerBaseConsentida`, os quatro
  desfechos) e `:181` (`resolverBaseConsentida`, a ordem das fontes e a origem
  da recusa); `apps/runner/src/base-guard.ts:128`
  (`validarBaseDeProjetos`), `:209` (`recusarLacoComARaiz`, o laço assimétrico)
  e `:296` (`resolverPastaDoProjetoNaBase`, a subpasta e a dupla passada);
  `apps/runner/src/index.ts:321` (a resolução no `lerArgumentos`, DEPOIS de
  `garantirDiretorio` e sem tocar na validação de `--dir`) e `:452`
  (`EstadoDoRunner.base`)
- **Teste:** `apps/runner/src/base-guard.spec.ts` (caminho feliz com base que
  ainda não existe; a irmã com prefixo comum que NÃO é confundida; `..`, `/`,
  arquivo, `$HOME` no Linux; o laço nos dois sentidos, incluindo o construído
  por symlink REAL; o segmento absoluto, com `..`, o que aponta para a própria
  base e o que escapa por link no meio);
  `apps/runner/src/base.spec.ts` (a precedência XDG, os quatro desfechos da
  leitura, a flag vencendo o arquivo, e a recusa carregando a ORIGEM)
- **ADR:** [0151](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0151-base-consentida-no-runner.md) pontos 1 e 2
- **Origem:** FASE 29. O par `workspace_create`/`workspace_create_result` e a
  capacidade `workspace` (pontos 3 a 6 do ADR), declarados aqui como não
  feitos, FECHARAM na [RN-532](#rn-532) — a base passou a ter consumidor.
  Segue declarado e NÃO feito: o `install.sh`, que é quem vai gravar o arquivo
---

## A base do agente local ganha um consumidor: a pasta do projeto nasce pelo canal (RN-532)

<a id="rn-532"></a>

### RN-532 — `workspace_create` cria a pasta sob a base LOCAL, e quem GRAVA continua sendo o `workspace_confirm` que já existia {#rn-532}

A [RN-529](#rn-529) deu ao `brabo-runner` uma BASE e a validou, e declarou por
escrito que **nada a consumia**. Este é o consumidor: o par
`workspace_create`/`workspace_create_result`, a capacidade `workspace` e um
predicado próprio no engine.

**O par é de PEDIDO COM RESPOSTA, e não podia ser modelado no
`workspace_confirm`.** Aquele é UNIDIRECIONAL: `handle_in("workspace_confirm",
…)` responde `{:noreply, socket}` e não empurra nada de volta. Quem pede a
criação de uma pasta precisa saber se ela apareceu, e com que caminho — então o
molde é o de `exec`/`exec_result` (`despachar_pedido` + `pending_execs` +
`responder_pedido_pendente/3`), o mesmo dos três pares de container. Registro de
precisão, porque o nome circulou: **`workspace.verified` não existe** neste
repositório — o que existe é o evento `project.workspace_verified` e a coluna
`workspace_verified_at`.

**Só o SEGMENTO atravessa a rede.** A base é local e nunca vem do servidor
(RN-529); o engine manda `projectId` e o segmento RELATIVO, e é
`resolverPastaDoProjetoNaBase` — do lado do runner, que tem a raiz — quem os
junta. É o invariante do [ADR 0130](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0130-broker-de-container.md)/
[ADR 0144](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0144-a-segunda-raiz-do-broker.md) aplicado ao agente local: quem
tem a raiz é quem executa. Um segmento ABSOLUTO é recusado por LÉXICO, nunca
aceito e reinterpretado.

**A confirmação REUSA o `workspace_confirm`, e é o que economiza uma frente
inteira.** Tendo criado a pasta, o runner empurra o `workspace_confirm` que
existe desde a [RN-423](#rn-423) — e é ele que grava, pelo caminho já
construído: canal → engine → HTTP interno → `ConfirmProjectWorkspaceUseCase`,
que revalida o léxico, é idempotente e carimba `workspace_verified_at`.
**Nenhuma rota nova de gravação nasce**, o engine continua não escrevendo a
tabela, e o único caminho que carimba continua sendo um só. A ORDEM é o
mecanismo, não estética: os dois pushes chegam ao MESMO processo de canal, em
ordem, e o handler do `workspace_confirm` é síncrono — mandá-lo ANTES do
resultado é o que garante que o carimbo já existe quando o pedinte destrava do
`receive`.

**A capacidade `workspace` entra no vocabulário na sessão em que o código
entra**, dos dois lados ([ADR 0151](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0151-base-consentida-no-runner.md)
ponto 4). A [RN-514](https://github.com/viralabs-dev/brabo-engine/blob/dev/docs/business-rules/engine.md#rn-514) tinha feito a aposta oposta com `espelho` — nome
no servidor sem código do outro lado — e ela só se pagou porque alguém a
cobrou; repetir seria repetir o defeito silencioso que a negociação existe para
impedir.

**Ela é a única das quatro cuja declaração depende do ESTADO daquela execução,
e não da versão do binário.** O runner só a declara quando tem base consentida
(`capacidadesDoRunner`), e é por essa linha — e por mais nenhuma — que o
servidor SABE que existe base: o engine não lê o disco do usuário e não tem
tabela de bases. Ninguém a EXIGE no join, e isso é decisão: exigi-la em
`runner` faria todo binário sem base deixar de conectar, o que é `breaking/` e
MAJOR, por uma função que aquele projeto talvez nunca use. Ela é opt-in pela
outra ponta — quem tem base declara, e só quem declarou recebe a mensagem.

**Predicado PRÓPRIO, e `RunnerReadiness` fica byte a byte.**
`Engine.Runners.PastaDoProjeto` tem DUAS pré-condições — runner conectado, base
consentida — e o ADR adota literalmente a recusa que `Engine.Runners.Espelho` já
tinha escrito: uma função compartilhada com flag "pula container" é precisamente
o caminho pelo qual a terceira pré-condição cai POR ACIDENTE para o `exec` numa
refatoração futura ([RN-507](#rn-507)/[ADR 0145](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0145-docker-pre-requisito-do-runner.md)
existe para ela não cair). E aqui a terceira seria pior que desnecessária: é
**circular** — um projeto `runner` só chega a ter container `running`
REGISTRADO depois de o próprio runner o subir, e o container sobe sobre a pasta
que esta mensagem existe para criar.

Ele também NÃO pergunta `workspace_verified_at` (ao contrário do espelho: aqui
ele é o RESULTADO, e exigi-lo tornaria a mensagem inalcançável exatamente no
caso para o qual foi feita) nem o `execution_mode` (a segunda fonte da mesma
regra — quem tem base consentida é o agente local, e só existe agente local
onde ele existe).

**Onde cada pré-condição é respondida, e por que não são as duas no mesmo
lugar.** "Runner conectado" é do `Registry`, e o módulo a responde sozinho.
"Base consentida" é propriedade daquela CONEXÃO: ela vive em `socket.assigns` e
**nunca em tabela** (a régua do
[ADR 0147](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0147-agente-local-com-capacidades.md)), então quem a responde é o
despacho — o canal recusa ANTES de empurrar e devolve `motivo: "sem-base"` pelo
MESMO `ref`, no formato que o módulo já espera, exatamente como `dispatch_exec`
faz com o 126. Nunca um timeout, que é como o defeito silencioso apareceria. Os
dois motivos, as duas mensagens e a ordem em que se aplicam moram no módulo, e
em nenhum outro lugar.

**Erro NOMEADO, e cinco motivos que não colapsam.** `sem-base`, `segmento`,
`nao-e-pasta`, `mkdir` e `git` viajam como `motivo` ao lado do texto de `erro` —
separados de propósito: o texto é para um humano ler, o motivo é para o outro
lado DECIDIR, e colapsá-los obrigaria o engine a casar substring de pt-BR. Só
`sem-base` vira átomo próprio no engine (`:sem_base`), porque só ele tem
conserto próprio; os outros quatro são `:recusado` com a mensagem do runner. O
`init`/clone que falha é erro nomeado e **nunca um plano B**: uma pasta sem
`.git` quebraria o worktree do dev agent, o espelho e o próprio versionamento do
usuário num lugar longe da causa.

**Idempotente, e os três desfechos não colapsam.** `mkdir -p` já é idempotente;
o que precisou de decisão foi o repositório — uma pasta que JÁ é repositório
volta como SUCESSO, com o modo `ja-era-repositorio`, nunca um `init` por cima
(que mentiria sobre o que aconteceu) nem um clone (que falharia por pasta
não-vazia e transformaria "já estava pronto" em erro). É a mesma disposição de
`ConfirmProjectWorkspaceUseCase`, e pelo mesmo motivo: a mensagem pode chegar
duas vezes.

**`estado.dir` NÃO muda.** A pasta criada é a do projeto do ponto de vista do
SERVIDOR — e é o `workspace_confirm` que a grava lá. A raiz que `guard.ts` usa
para conter comando aprovado continua sendo a desta execução: trocá-la em
runtime moveria uma fronteira de contenção por causa de uma mensagem de rede, e
este CLI nunca faz isso.

**Isto NÃO é `proposed_action`, e nenhum teto ganha exceção.** Criar a pasta do
projeto que o usuário acabou de pedir é configuração CONSENTIDA, não um agente
pedindo para agir — a mesma linha que o espelho já estabeleceu
([RN-516](#rn-516)). Fazê-la por comando de terminal cairia no escopo do
[ADR 0055](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0055-escopo-de-caminho-na-politica-de-terminal.md) e viraria
fila de aprovações rotineiras, corroendo o teto que dá sentido ao clique.

- **Onde:** `apps/runner/src/pasta-do-projeto.ts:132` (`criarPastaDoProjeto` —
  a ordem guarda→disco→versionamento e os cinco motivos);
  `apps/runner/src/channel.ts:173` (`WorkspaceCreateMessage`), `:194`
  (`WorkspaceCreateResultMessage`), `:476` (`CAPACIDADE_DE_WORKSPACE` e
  `capacidadesDoRunner`); `apps/runner/src/index.ts:1034`
  (`tratarWorkspaceCreate` — a ordem `workspace_confirm` antes do resultado);
  `apps/engine/lib/engine/runners/pasta_do_projeto.ex:107` (`verificar/1`) e
  `:134` (`criar/3`); `apps/engine/lib/engine/runners/runner_router.ex:181`
  (`create_workspace/3`); `apps/engine/lib/engine/runners/capacidades.ex:95`
  (`workspace` no vocabulário, e fora do legado);
  `apps/engine/lib/engine_web/channels/terminal_channel.ex:666`
  (`handle_info({:dispatch_workspace_create, …})`, a recusa nomeada) e `:380`
  (`handle_in("workspace_create_result", …)`)
- **Teste:** `apps/runner/src/pasta-do-projeto.spec.ts` (caminho feliz com
  `init` e com clone; a idempotência provada com o binário de versionamento de
  VERDADE; os cinco motivos, com textos distintos, e a pasta que NÃO nasce fora
  da base); `apps/runner/src/index-handlers.spec.ts` (a ORDEM
  `workspace_confirm` → `workspace_create_result`; sem base, nenhum confirm;
  conexão caída não empurra nada); `apps/runner/src/channel.spec.ts`
  (`workspace` só declarada com base; payload sem `segmento`/`projectId`
  descartado; `env` malformado virando `undefined`);
  `apps/engine/test/engine/runners/pasta_do_projeto_test.exs` (as duas
  pré-condições SEM banco — a asserção é o `ExUnit.Case` puro —, o payload
  exato, os quatro motivos e o sucesso sem caminho que não vira sucesso);
  `apps/engine/test/engine/runners/runner_router_test.exs` (o roundtrip e o
  timeout); `apps/engine/test/engine/runners/capacidades_test.exs`
  (`workspace` declarável, nunca no legado, nunca exigida);
  `apps/engine/test/engine_web/channels/terminal_channel_test.exs` (a recusa
  nomeada pelo mesmo `ref`, e nada empurrado ao runner)
- **ADR:** [0151](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0151-base-consentida-no-runner.md) pontos 3 a 6
- **Origem:** FASE 29, sessão 8. Fica declarado e NÃO feito: quem CHAMA
  `PastaDoProjeto.criar/3` — o caminho web→api→engine é da sessão 9 —, e o
  `install.sh` que grava o arquivo da base, que é de outra frente

---

## O agente local abre N conexões, uma por projeto (RN-544, FASE 30)

<a id="rn-544"></a>

### RN-544 — O agente local abre N conexões, uma por projeto descoberto pela rota — e o teto de tentativas e a recusa de join deixam de ser do PROCESSO {#rn-544}

A [RN-543](https://github.com/viralabs-dev/brabo/blob/dev/docs/business-rules/produto.md#rn-543) abriu `GET runner/projects` e ficou sem chamador. O
`brabo-runner` continuava exigindo `--project`: `index.ts` tinha
`if (!projectId) uso()`, e não existia execução sem projeto. Esta RN é o
consumidor — e é a metade do [ADR 0154](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0154-chave-de-dispositivo-de-maquina.md)
que prova a descoberta dele: *"um único processo que abra N conexões — uma por
projeto que ele atende — satisfaz os itens 1, 2 e 3 byte a byte"*. **Nada no
engine muda**: o tópico `terminal:<projectId>`, o socket id e o ticket
descrevem uma CONEXÃO, e N conexões continuam sendo N conexões. A recusa de
segundo runner no mesmo projeto fica intacta, e é garantia real, não acidente.

**Dois modos, e o antigo fica byte a byte.** `--project`/`--dir` com
credencial de projeto — inclusive o fluxo do navegador
([ADR 0118](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0118-configuracao-automatica-do-runner-pelo-navegador.md),
[RN-464](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-464)) — é o caminho de sempre: UMA conexão, e o desfecho dela
continua sendo o do processo. O modo novo exige as DUAS coisas, e por motivos
diferentes: credencial de MÁQUINA, porque é ela que a rota aceita; e **base
consentida** ([RN-529](#rn-529)), porque sem ela não há de onde derivar a pasta
de cada projeto, e inventar uma seria escrever no disco do usuário um caminho
que ele não consentiu. Sem base, rodar sem `--project` segue caindo em `uso()`,
dizendo qual das duas faltou.

**O runner não sabe de que espécie é a própria chave, e isso é decisão.** Em
disco, chave de máquina e chave de projeto são o MESMO arquivo: uma JWK privada
com um `kid` ([RN-475](https://github.com/viralabs-dev/brabo-web/blob/dev/docs/business-rules/web.md#rn-475)). Quem sabe é o SERVIDOR, que acha a pública
por esse `kid`. Então o CLI pergunta, e o 403 nomeado do `PatAuthGuard` vira
`CredencialNaoEDeMaquinaError`, com as palavras da api e o conserto
(`--project`) — nunca um "falha na conexão" genérico. Um palpite local seria
uma segunda fonte de verdade sobre a mesma coisa, e a local seria a errada. O
JWT dessa chamada vai **sem** o claim `projectId`, porque o guard compara
`payload.projectId !== request.params.projectId` e numa rota sem projeto os
dois precisam ser `undefined`.

**N conexões exigem N estados.** Quatro campos de `EstadoDoRunner` são POR
PROJETO — `dir`, `canalAtual`, `containerAtivo`, `destinoDoEspelho` — mais o
`gerenciadorPty`, que nasce de `dir`. Um estado compartilhado faria o
`docker exec` de um projeto rodar no container de OUTRO, e o PTY de um abrir na
pasta de outro. `docker` e `base` são da MÁQUINA e entram como o MESMO valor em
todos, nunca cópias que possam divergir. O tipo não mudou, e os handlers
(`tratarExec`, `tratarMirrorSync`, `tratarWorkspaceCreate`…) não mudaram uma
linha: o espelho ([RN-516](#rn-516)) e o `workspace_create`
([RN-532](#rn-532)) já eram por projeto e já viajavam na concessão do `join`
daquela conexão, que é exatamente o que os torna corretos com N.

**O teto e a recusa viram do PROJETO.** Eram do processo: recusa de join dava
`process.exit(1)`, e `TETO_DE_TENTATIVAS_SEGUIDAS` esgotado também. Com N
conexões, matar tudo por causa de uma derrubaria o agente de todos os projetos
que estão funcionando. Então cada projeto tem seu laço e seu contador; um
projeto que recusa ou esgota **encerra sozinho, NOMEADO**, e os demais seguem —
e só quando NENHUM sobra o processo sai com 1, com um resumo dizendo o desfecho
de cada um. Todo log do laço é prefixado pelo nome do projeto: com N laços
intercalados, "falha na conexão" sem dono é a forma que o silêncio toma quando
há N de algo. No modo `projeto` a disposição antiga fica idêntica, e pelo mesmo
raciocínio invertido: com UMA conexão, não sobra nada a atender.

**A lista é consultada UMA vez, no start.** Repesquisar periodicamente foi
considerado e recusado: custa chamada recorrente por um evento raro, e o preço
real não é tráfego — é que uma lista que volta MENOR é ambígua (projeto
apagado, convertido de modo, papel revogado, ou um 500 transitório se
disfarçando dos três), e derrubar conexão VIVA por causa dessa ambiguidade
trocaria um estado certo por um palpite. O processo **DIZ** isso ao subir, e o
gesto para pegar projeto novo é reconectar o agente — um comando só, com o
serviço de usuário da [RN-518](#rn-518).

**Lista VAZIA é estado NORMAL, e a saída é 0.** É o estado de toda máquina
recém-instalada: o instalador sobe o agente antes de existir projeto nenhum
([ADR 0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md)). Não é erro, então
não é código de erro — e `Restart=on-abnormal` ([RN-518](#rn-518)) não o
reergue, que é o certo: não há o que reerguer. Ficar de pé com zero conexões
seria um serviço "ativo" que não faz nada, e o `status` da unit passaria a
mentir.

**A pasta de cada projeto é `<base>/<workspaceDirName>`, pelas guardas que já
existem.** `resolverPastaDoProjetoNaBase` (a MESMA que `workspace_create` usa,
e pelo mesmo motivo: o nome veio pela rede), mais
`validarDirDentroDoHomeNoLinux` ([RN-434](#rn-434)) e `garantirDiretorio`
([RN-435](#rn-435)) — nenhuma quarta cópia de régua nasce. Criar a pasta é a
RN-435 aplicada a um caminho DERIVADO em vez de digitado; o que NÃO acontece
aqui é `git init`/clone, que continua sendo `workspace_create`
([RN-532](#rn-532)). Um projeto cuja pasta é recusada sai do plano nomeado e
não derruba os outros. `OpcoesDaBase.raizDoProjeto` aceita `null` no modo de
máquina: sem `--project` não há `--dir`, a recusa de laço fica **sem sujeito**
(toda raiz é derivada da base, então "a base dentro da raiz de um projeto" não
tem como ser construída), e passar a própria base ali seria pior —
`dentroDoEscopo(base, base)` é verdadeiro e toda base seria recusada.

- **Código:** `apps/runner/src/index.ts` (o portão em `lerArgumentos`,
  `lerArgumentosDeMaquina`, `manterConexaoDoProjeto`, `criarEstado`,
  `rodarComoAgenteDeMaquina`); `apps/runner/src/projetos.ts`
  (`listarProjetosDoRunner`, `planejarConexoes`,
  `CredencialNaoEDeMaquinaError`); `apps/runner/src/auth.ts`
  (`assinarDescobertaComChaveDeDispositivo` — o JWT sem o claim `projectId`);
  `apps/runner/src/base-guard.ts` (`OpcoesDaBase.raizDoProjeto` nulo)
- **Teste:** `apps/runner/src/projetos.spec.ts` — caminho feliz da rota e do
  plano, o 403 virando erro PRÓPRIO, resposta fora do contrato, e o segmento
  que escapa da base sendo recusado SEM derrubar o vizinho (inclusive por
  symlink, na segunda passada); `apps/runner/src/index.spec.ts` — o PORTÃO no
  processo de verdade (sem base, `uso()` com o motivo; com base, a recusa passa
  a ser da credencial); `apps/runner/src/base-guard.spec.ts` — `raizDoProjeto`
  nulo não afrouxa nenhuma outra recusa
- **Lacuna DECLARADA, FECHADA depois pela [RN-552](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-552):** quando esta RN
  fechou, ninguém CRIAVA chave de máquina (era o `install.sh`, ADR 0155 ponto
  4), então o modo novo só era exercitável com uma chave registrada à mão — a
  metade que a RN-543 já declarava. A `apiUrl` no modo de
  máquina vem de `--api-url`/`BRABO_API_URL`/default, e **não** do
  `brabo-runner.config.json`, que é por PROJETO: uma instalação em porta ou
  host diferentes precisa da flag no `ExecStart`, e quem a escreve é a unit por
  máquina, que é a sessão 4 desta fase. E a unit continua sendo POR PROJETO —
  este PR muda o PROCESSO, não o serviço
- **ADR:** [0154](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0154-chave-de-dispositivo-de-maquina.md)
- **Origem:** FASE 30, sessão 3 —
  [o recorte da fase](https://github.com/viralabs-dev/brabo/blob/dev/docs/explanation/fase-30-runner-por-maquina.md)

## A unit de MÁQUINA, convivendo com as por projeto (RN-545)

<a id="rn-545"></a>

### RN-545 — `service install --machine` instala UMA unit para a máquina, e as duas espécies não se sobrepõem {#rn-545}

A [RN-544](#rn-544) fez o agente de máquina existir como PROCESSO — N conexões,
uma por projeto descoberto pela rota — e declarou por escrito o que faltava:
*"a unit continua sendo POR PROJETO; este PR muda o PROCESSO, não o serviço"*.
Esta RN é a outra metade, e é o quinto e último dos cinco acoplamentos que o
[ADR 0154](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0154-chave-de-dispositivo-de-maquina.md) mediu
(`apps/runner/src/servico.ts:264,391`). Os outros quatro já estão fechados ou
declarados intocáveis: os itens 1, 2 e 3 descrevem uma CONEXÃO e N conexões os
satisfazem byte a byte, e o item 4 fechou na [RN-543](https://github.com/viralabs-dev/brabo/blob/dev/docs/business-rules/produto.md#rn-543).

**O nome da unit de máquina não pode colidir com `projectId` nenhum, e não
colide por construção.** `brabo-runner.service` / `dev.brabo.runner`, sem
sufixo, contra `brabo-runner-<projectId>.service` /
`dev.brabo.runner.<projectId>`. `PROJECT_ID_VALIDO` exige **ao menos um
caractere**, então o nome de projeto sempre tem um `-` (ou um `.` de separação,
no launchd) onde o de máquina termina — os dois nunca produzem a mesma string.
É travado por teste, e não por leitura da regex.

**A camada de plataforma passa a ser chaveada por ESPÉCIE, não por
`projectId`.** Seis dos oito membros de `PlataformaDeServico` recebiam
`projectId: string`; eles passam a receber `AlvoDaUnidade`, um tipo discriminado
(`{especie:'projeto', projectId}` | `{especie:'maquina'}`) — e nunca
`projectId: string | null`, porque com o nulo cada membro decidiria sozinho o
que fazer com ele e o compilador não cobraria nenhum. `PlanoDeInstalacao` vira
união pelo mesmo motivo: os três campos do plano de projeto perdem sentido na
máquina, onde não há projeto, não há `--dir` (cada raiz sai da base) e a api não
pode vir de um arquivo que é por projeto. `caminhoDaUnidade` DESCEU de membro
para função, porque as duas plataformas respondiam a mesma coisa — pasta mais
nome — e manter duas implementações idênticas era a chance de elas divergirem
quando a segunda espécie chegasse.

**O discriminador é a flag `--machine`, e NUNCA a ausência de `--project`.** O
ADR 0154 ponto 5 escreveu *"`service install` sem `--project` instala a unit de
máquina"*, e isso foi medido nesta sessão e **não** pôde ser implementado ao pé
da letra: `resolverProjeto` tem DUAS fontes, e o caminho normal de hoje é rodar
`install` sem flag nenhuma de dentro da pasta que o navegador configurou — é o
`brabo-runner.config.json` que responde. Tratar "sem `--project`" como "máquina"
converteria em silêncio a instalação de quem já usa o produto, que é exatamente
o que o ponto 5 do mesmo ADR promete não fazer. Então a espécie nova é **opt-in
explícito**, as duas fontes de projeto ficam byte a byte, e `--machine` junto de
`--project` é recusa nomeada em vez de precedência inventada.

**`install --machine` recusa mais que a metade de projeto, e as duas recusas
próprias são medidas.** A primeira: a pasta não pode ter
`brabo-runner.config.json`. `lerArgumentos` resolve o `projectId` por esse
arquivo quando `--project` falta, e o modo de máquina é justamente "sem
`projectId`" — uma unit de máquina cujo `WorkingDirectory` tenha esse arquivo
subiria o processo em modo de PROJETO, em silêncio, atendendo UM projeto e
chamando-se agente da máquina. A segunda: sem **base consentida**
([RN-529](#rn-529)) o agente de máquina sai em `uso()` no primeiro boot
([RN-544](#rn-544)), e gravar um serviço que nunca sobe é a "instalação errada
de pé" que este módulo recusa em toda parte — a base entra INJETADA
(`DependenciasDeInstalacao.resolverBase`), como as outras quatro dependências,
para que `servico.ts` continue sem ler disco nem ambiente por conta própria.

**A unit congela `XDG_CONFIG_HOME`, e nunca o VALOR da base.** É a mesma decisão
do `PATH` da [RN-518](#rn-518), com uma consequência maior: é essa variável que
decide ONDE o arquivo da base mora (`base.ts`), e `systemd --user` não repassa o
ambiente do shell de quem instalou — sem ela, um usuário com a variável apontada
para fora de `~/.config` teria o serviço lendo a base errada, ou nenhuma. O
valor da base fica fora de propósito: trocá-la continua sendo editar o arquivo e
reiniciar, nunca reinstalar, que é o que o docblock de `base.ts` já defendia ao
rejeitar "só a flag `--base`".

**A `apiUrl` da unit de máquina lê `BRABO_API_URL`, e a de projeto não.** A
precedência do plano de PROJETO fica byte a byte (`--api-url` › config daquela
pasta › default), porque lá existe um arquivo respondendo. No de máquina esse
arquivo é por projeto e não serve, então sem a variável a única alternativa a
`--api-url` seria o default `localhost` — instalar de um shell com
`BRABO_API_URL` posta geraria em silêncio uma unit apontando para o lugar
errado. Ela entra no `ContextoDoServico` (`apiUrlDoAmbiente`), nunca lida
diretamente do `process.env`.

**`install` RECUSA quando a outra espécie já está instalada, e nada é
removido.** O agente de máquina atende TODO projeto em modo `runner` do dono da
chave; somar a ele uma unit por projeto (ou o contrário) põe dois processos
disputando o mesmo `terminal:<projectId>`, e o servidor nega um dos dois —
provavelmente o que a pessoa acabou de instalar, que é a pior ordem possível
para descobrir o problema. É recusa pelo MESMO critério da recusa de root que já
mora nesse arquivo: *"instalar e avisar deixaria a instalação errada de pé, e a
mensagem seria lida uma vez só"*. A unit que já existe fica intacta, a mensagem
nomeia o `uninstall` de cada uma, e **não há `--force`** — uma flag que derruba
uma guarda cujo sintoma é silencioso devolve o sintoma silencioso. Isto NÃO
contradiz o ponto 5 do ADR: o que ele garante é que unit por projeto já
instalada continua funcionando, e ela continua, byte a byte; o que se recusa é
criar a sobreposição AGORA.

**`status` responde sobre a espécie perguntada, e os quatro estados não viram
oito.** O código de saída continua sendo o da unit PERGUNTADA
([RN-088](https://github.com/viralabs-dev/brabo-web/blob/dev/docs/business-rules/web.md#rn-088)) — somar as duas apagaria qual delas está pedindo atenção, do
mesmo jeito que somar as cinco filas de decisão apagaria qual fila é qual. A
coexistência aparece em TEXTO, e é resposta do **DISCO**: as units da outra
espécie são listadas pelo nome, sem perguntar o estado de cada uma ao
gerenciador, e a saída DIZ que não perguntou. É o ponto 5 do ADR 0154 cumprido —
*"deixar seis processos disputando três projetos em silêncio"* é o defeito que
esse bloco existe para impedir. Sem `--machine` e sem projeto resolvível, o
principal é a unit de **máquina** (a única cujo nome não precisa de argumento) e
a saída nomeia `--project` para quem queria a outra; antes desta RN a mesma
entrada respondia "precisa saber QUAL projeto", que é uma pergunta e não uma
resposta para quem tem exatamente a instalação que o instalador produz.

**`uninstall` NÃO herda esse default, e a assimetria é deliberada.** Ler a
espécie errada custa uma linha errada; remover a espécie errada custa um serviço
e uma chave de dispositivo. Sem `--machine` e sem projeto resolvível ele RECUSA,
listando o que existe no disco com o comando exato de cada um — e nunca remove
as duas, que seria remover mais do que foi pedido.

**`Restart=on-abnormal` fica byte a byte, nas duas espécies.** Exit 1 é recusa
fatal de join ou teto de tentativas esgotado, e reiniciar seria o laço que o CLI
recusa fazer sozinho ([RN-514](https://github.com/viralabs-dev/brabo-engine/blob/dev/docs/business-rules/engine.md#rn-514)). Mais: a RN-544 fez **lista vazia sair
com 0** justamente para que `on-abnormal` não reerga o serviço numa instalação
nova, onde não há o que atender — trocar por `on-failure` desfaria as duas
decisões de uma vez.

- **Código:** `apps/runner/src/servico.ts` (`AlvoDaUnidade`, `ALVO_DE_MAQUINA`,
  `alvoDeProjeto`, `resolverEspecie`, `PlanoDeInstalacao` como união,
  `caminhoDaUnidade`/`projetosInstalados`/`maquinaInstalada`,
  `prepararPlanoDeProjeto`/`prepararPlanoDeMaquina`, `recusaDeSobreposicao`,
  `linhasDoQueExiste`/`linhasDeCoexistencia`,
  `ContextoDoServico.apiUrlDoAmbiente`,
  `DependenciasDeInstalacao.resolverBase`, `SistemaDeServico.listarPasta`);
  `apps/runner/src/servico-sistema.ts` (`listarPasta` sobre `readdirSync`);
  `apps/runner/src/index.ts` (o adaptador de `resolverBase` sobre
  `resolverBaseConsentida`, `apiUrlDoAmbiente`, o texto de uso)
- **Teste:** `apps/runner/src/servico.spec.ts` — `service install --machine` (a
  unit sem `--project`/`--dir`, a ausência de colisão de nome, o congelamento de
  `XDG_CONFIG_HOME` sem o valor da base, o Label e o log do launchd, o
  `BRABO_API_URL`) e as cinco recusas próprias (config de projeto na pasta, sem
  base, base inválida, sem chave, `--machine` com `--project`); e as duas
  espécies não se sobrepondo (recusa nos DOIS sentidos sem remover nada, o
  `status` de cada lado dizendo da outra sem somar código nem perguntar ao
  gerenciador, o `status` sem argumento caindo na máquina, o
  `uninstall --machine` deixando a de projeto intacta, e o `uninstall` sem
  espécie recusando e listando as duas)
- **Lacuna DECLARADA:** o `install --machine` **não sabe** se a chave daquela
  pasta é mesmo de máquina — em disco as duas espécies são o mesmo arquivo, uma
  JWK com `kid` ([RN-475](https://github.com/viralabs-dev/brabo-web/blob/dev/docs/business-rules/web.md#rn-475)), e quem sabe é o SERVIDOR
  ([RN-544](#rn-544)). Uma pasta com chave de PROJETO instala a unit sem erro, e
  a recusa aparece só no primeiro boot, como `CredencialNaoEDeMaquinaError`.
  Verificar no `install` exigiria uma chamada de rede num subcomando que hoje
  não faz nenhuma, e inventar um palpite local produziria a segunda fonte de
  verdade que a RN-544 recusou. E, à época desta RN, ninguém CRIAVA chave de
  máquina: quem registra é o `install.sh`
  ([ADR 0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md) ponto 4), na
  sessão 6 — esta sessão entrega o subcomando que ele vai chamar, e a rota que
  ele chama chegou na [RN-552](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-552)
- **ADR:** [0154](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0154-chave-de-dispositivo-de-maquina.md)
- **Origem:** FASE 30, sessão 4 —

---

---
id: rn-runner-parte-02
title: 'Regras de negócio — Runner — parte 2 (desde RN-550)'
sidebar_label: 'Runner — parte 2 (desde RN-550)'
description: 'As RNs hospedadas na raiz runner.'
keywords: [regras de negócio, runner]
---

# Runner — parte 2 (desde RN-550)

## O agente de máquina espera o primeiro projeto, e a chave nasce no terminal (RN-550/551, FASE 30)

<a id="rn-550"></a>

### RN-550 — Com ZERO conexões o agente local NÃO sai: ele espera e reconsulta a lista; com conexão viva a consulta continua sendo só no start {#rn-550}

Sessão 8 da [FASE 30](https://github.com/viralabs-dev/brabo/blob/dev/docs/explanation/fase-30-runner-por-maquina.md). A
[RN-544](parte-01.md#rn-544) fez lista vazia ser estado NORMAL e o processo sair com **0**,
dizendo *"crie um projeto em modo Runner e suba o agente de novo — a lista é
consultada só no start"*. Isso contradizia, por escrito, o
[ADR 0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md) ponto 5 — *"ele
**espera**… quando a pessoa criar o primeiro projeto na web, o agente já está
lá"* — e quebrava exatamente o caso que a fase persegue: a instalação nova, que
é a instalação com ZERO projetos. O instalador subia o agente, o agente
descobria que não havia nada e ia embora, e a pessoa que criasse o primeiro
projeto minutos depois voltaria ao terminal sem nunca ter sido avisada disso.

**A regra é ASSIMÉTRICA, e a assimetria é o desenho:**

```
conexões > 0  →  a lista é consultada SÓ no start   (a RN-544 fica byte a byte)
conexões = 0  →  reconsulta, com cadência declarada
```

**E ela NÃO desfaz a decisão da RN-544.** O argumento daquela sessão continua
inteiro: uma lista que volta **MENOR** é ambígua — projeto apagado, convertido
de modo, papel revogado, ou um 500 transitório se disfarçando dos três —, e
derrubar uma conexão **VIVA** por causa dessa ambiguidade trocaria um estado
certo por um palpite. Com **zero** conexões não há nada a derrubar e não há
ambiguidade nenhuma: qualquer projeto que apareça é ganho puro, e nenhuma
decisão é tomada sobre o que sumiu. A reconsulta **PARA** no instante em que a
primeira lista não-vazia chega, e daí em diante o comportamento é byte a byte o
de hoje — o módulo da espera não é chamado de novo enquanto o processo viver.

**O argumento do `exit 0` caiu porque a premissa dele caiu.** A RN-544 escreveu
que *"ficar de pé com zero conexões seria um serviço 'ativo' que não faz nada, e
o `status` da unit passaria a mentir"* — e isso dependia de o processo não fazer
nada. É essa premissa que esta RN remove: ele reconsulta, com cadência
declarada, e DIZ que está fazendo isso. `active (running)` passa a ser
verdadeiro, e quem mentia era a saída com 0, que deixava a instalação nova sem
agente justamente no minuto em que a pessoa ia criar o primeiro projeto.

**A cadência escalona e ESTABILIZA: 15s, 30s, 60s, e o último se repete para
sempre.** Os dois degraus curtos existem porque o caso a atender é o de alguém
criando o primeiro projeto AGORA; um teto de minutos faria o agente aparecer
depois de a pessoa desistir de olhar. O platô de 60s é o preço em regime — UMA
requisição por minuto, de uma instalação, contra uma rota que devolve a lista do
próprio dono da credencial. Crescer além disso economizaria tráfego que ninguém
está pagando e pioraria a única coisa que a espera entrega.

**Há teto, e ele é de FALHAS, nunca de espera.** Esperar não tem limite —
esperar é o estado normal de uma instalação nova, e pode durar dias. O que tem
teto são as falhas **SEGUIDAS** da consulta: dez, e então o processo sai com 1
NOMEANDO o número, como o laço de conexão já faz com
`TETO_DE_TENTATIVAS_SEGUIDAS` e pelo mesmo motivo (não martelar a api para
sempre quando o problema não é transitório). Uma consulta que RESPONDE zera o
contador — inclusive quando responde VAZIO, que é sucesso, porque a lista vazia
é a resposta certa. A constante é SEPARADA de propósito, com o mesmo valor: uma
conta falhas de CONECTAR e a outra, falhas de LISTAR, e amarrá-las faria uma
mudança de cadência de conexão mexer, sem ninguém pedir, no tempo que uma
instalação nova espera antes de desistir. `CredencialNaoEDeMaquinaError` (o 403
por espécie de chave, [RN-544](parte-01.md#rn-544)) **não** entra no teto: ela é fatal na
hora, porque uma chave de projeto não vira chave de máquina por esperar mais um
minuto.

**Ficar de pé em silêncio seria pior que sair.** "Esperando" e "travado" são a
mesma imagem para quem lê `journalctl`, então o processo diz a cadência ao
entrar na espera, diz quando o primeiro projeto aparece, e bate um BATIMENTO a
cada 30 consultas (meia hora, no platô) informando **quantas** consultas já
houve. Nem toda consulta vira linha, também de propósito: um log por minuto,
para sempre, é o ruído que enterra as linhas que importam.

**`Restart=on-abnormal` fica byte a byte, nas DUAS espécies de unit
([RN-545](parte-01.md#rn-545)), e nada nelas muda.** Medido: `on-abnormal` reergue por
SINAL, watchdog ou timeout — nunca por código de saída, nem 0 nem 1. A saída
com 0 nunca foi o que impedia o serviço de ser reerguido; o que impedia é que
`on-abnormal` não olha código nenhum. O efeito real da mudança é o oposto do
temido: a unit de MÁQUINA, que é a que roda este modo, passa a ficar
`active (running)` de verdade em vez de terminar em `inactive (dead)` segundos
depois de subir — e `service status --machine` passa a responder `rodando` (0)
onde antes respondia `parado` (3) numa instalação nova. A unit por PROJETO não
é afetada em linha nenhuma: ela roda o modo `projeto`, que nunca chega aqui.

**Uma exceção, declarada: lista NÃO-vazia cujos projetos são todos recusados
continua saindo com 1.** Também são zero conexões, e mesmo assim não espera —
porque ali cada recusa nomeia um defeito local concreto (segmento que escapa da
base, pasta que é um arquivo) com conserto próprio, e reconsultar repetiria as
mesmas recusas indefinidamente, enterrando no log a linha que diz o que
consertar. A espera é para *"ainda não existe projeto"*, nunca para *"existe e
eu não consigo atendê-lo"*.

- **Código:** `apps/runner/src/espera-de-projetos.ts:127`
  (`esperarPrimeiroProjeto`), `:60` (`CADENCIA_DA_ESPERA_MS`), `:75`
  (`TETO_DE_FALHAS_DE_CONSULTA`), `:88` (`CONSULTAS_POR_BATIMENTO`);
  `apps/runner/src/index.ts:1465` (a espera dentro de
  `rodarComoAgenteDeMaquina`, e a exceção dos recusados logo abaixo)
- **Teste:** `apps/runner/src/espera-de-projetos.spec.ts` — o caminho feliz
  (espera, reconsulta, devolve a primeira lista não-vazia e PARA ali), a
  cadência que estabiliza, o batimento a cada N consultas, o teto de falhas
  seguidas com o número na mensagem, a resposta no meio ZERANDO o contador, o
  403 de espécie subindo intacto e o SIGTERM devolvendo `parado`;
  `apps/runner/src/index.spec.ts` — a JUNÇÃO no PROCESSO de verdade, contra uma
  api de mentira que devolve `[]`: o processo DIZ que fica de pé e **não
  termina**, que era o defeito
- **ADR:** [0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md) ponto 5
- **Origem:** FASE 30, sessão 8 —
  [o recorte da fase](https://github.com/viralabs-dev/brabo/blob/dev/docs/explanation/fase-30-runner-por-maquina.md)

<a id="rn-551"></a>

### RN-551 — `brabo-runner device-key create`/`finish`: o par Ed25519 nasce NA MÁQUINA, a privada nunca viaja, e o arquivo que o runner lê nunca existe sem `kid` {#rn-551}

Sessão 8 da [FASE 30](https://github.com/viralabs-dev/brabo/blob/dev/docs/explanation/fase-30-runner-por-maquina.md), a outra
metade. Até aqui, **só o navegador** gerava par de chaves de dispositivo
(`apps/web/src/lib/runner-bootstrap.ts`, [ADR 0118](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0118-configuracao-automatica-do-runner-pelo-navegador.md),
[RN-464](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-464)); o CLI só sabia **ler** o que alguém tinha posto na pasta
(`device-key.ts`). O [ADR 0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md)
ponto 4 pede o outro lado: *"o par é gerado **na máquina**; a privada nunca
viaja… mantém verdadeira a frase que a RN-519 usa para recusar a visão de
`maintainer`: 'a privada de uma chave de dispositivo nunca sai do navegador' —
passa a ser 'nunca sai da máquina'"*. Sem isso, a [RN-543](https://github.com/viralabs-dev/brabo/blob/dev/docs/business-rules/produto.md#rn-543), a
[RN-544](parte-01.md#rn-544) e a [RN-545](parte-01.md#rn-545) continuavam todas com a mesma lacuna
declarada: **ninguém cria chave de máquina**.

**São DOIS passos, e o motivo é o `kid`.** O `kid` gravado dentro da JWK privada
É o id do registro no servidor ([RN-475](https://github.com/viralabs-dev/brabo-web/blob/dev/docs/business-rules/web.md#rn-475)) — a cadeia inteira só o
REPASSA (o runner lê `jwk.kid`, o JWT o leva no header, o `PatAuthGuard` acha a
pública por ele), e ninguém o deriva de outra coisa. Ele só existe **depois** de
a pública ser registrada, e uma privada gravada antes disso nasce inútil, que é
literalmente o defeito que a RN-475 custou uma caçada para achar. O navegador
resolve mantendo o par em MEMÓRIA entre o registro e a gravação; o CLI resolve
com um arquivo **PARCIAL**:

```sh
PUB=$(brabo-runner device-key create)          # gera aqui, imprime a PÚBLICA
ID=$(… registra PUB na api …  | jq -r .id)     # quem registra é o instalador
brabo-runner device-key finish --id "$ID"      # carimba o kid e grava
```

**Em nenhum instante existe um `brabo-runner-device-key.jwk.json` sem `kid`.** O
`create` grava em `…jwk.json.parcial`, um nome que `lerChaveDeDispositivo` não
procura; o `finish` carimba e grava o nome de verdade. O arquivo que o runner LÊ
ou está completo ou não existe, e uma interrupção entre os dois passos deixa um
`.parcial` que o runner IGNORA e que o próximo `create` NOMEIA — dizendo que o
registro daquela tentativa pode ter ficado ÓRFÃO, que é inerte e aparece na
listagem da [RN-519](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-519).

**O CLI NÃO fala com a api, e a razão é de SEGREDO, não técnica.** Quem registra
a chave de máquina é o instalador, autenticado pelo `BRABO_SERVICE_TOKEN` que
ele acabou de gerar ([ADR 0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md)
ponto 1). Fazer o `brabo-runner` chamar a rota exigiria pôr esse token na mão
dele — um segredo de INSTALAÇÃO, que abre rotas internas, entregue a um processo
que hoje só vê credencial de dispositivo e que fica de pé para sempre na máquina
do usuário. O corte é o oposto: **cada lado guarda exatamente um segredo, e
nenhum vê o do outro**. O que atravessa a fronteira entre eles é a JWK PÚBLICA e
o id — nada que precise ser protegido.

**O destino padrão é a pasta de configuração da máquina, e a precedência é
REUSADA.** `$XDG_CONFIG_HOME/brabo/` (senão `~/.config/brabo/`), ao lado do
`runner.json` da [RN-529](parte-01.md#rn-529) e pelo mesmo motivo — é configuração da
MÁQUINA, e uma chave de máquina não tem pasta de projeto onde morar.
`pastaDeConfiguracaoDoBrabo` foi EXTRAÍDA de `caminhoDoArquivoDeBase` quando
ganhou o segundo consumidor, nunca copiada. Isso **não** reabre a porta que a
Onda 2 do [ADR 0104](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0104-execution-mode-tres-valores-e-workspace-verificado-pelo-runner.md)
fechou (credencial em caminho global e IMPLÍCITO): `device-key.ts` continua lendo só do `cwd` que o chamador
passar, e quem aponta para esta pasta é o `--dir` da unit de máquina
([RN-545](parte-01.md#rn-545)), explicitamente, escrito no serviço. `--dir` existe e serve
também a uma pasta de projeto — em disco as duas espécies são o mesmo arquivo, e
quem sabe a diferença é o SERVIDOR ([RN-544](parte-01.md#rn-544)): este comando não afirma
espécie nenhuma.

**A privada é gravada com modo 600, explícito, e nunca deixado ao `umask`.** A
pasta nasce 700 quando é ESTE comando que a cria; uma pasta que já existia é do
usuário (pode ser a que o navegador configurou) e não é reapertada. O `--dir`
passa pela MESMA `validarDirDentroDoHomeNoLinux` da [RN-434](parte-01.md#rn-434), reusada
inteira: o que se grava é um segredo do usuário, e uma pasta fora do `$HOME`
dele não é onde o `systemd --user` dele vai procurar.

**O stdout carrega UM valor, numa linha, e todo o resto é stderr.** É esse o
contrato de que o `install.sh` depende (`PUB=$(…)`): misturar as duas coisas
obrigaria o script a filtrar saída de humano, que é como um contrato se quebra
sem ninguém perceber. No `create` o stdout é a JWK pública; no `finish`, o
CAMINHO do arquivo — o valor que o passo seguinte (`service install --machine
--dir <pasta>`) precisa.

**Sobrescrever chave completa é RECUSADO, e não há `--force`.** Trocar a chave
de uma máquina já pareada trocaria a identidade de um agente que pode estar de
pé AGORA, em silêncio: a pública continuaria registrada e o processo passaria a
assinar com uma chave que ninguém conhece. A recusa nomeia o gesto (revogar,
apagar, recriar), e uma flag que derruba uma guarda cujo sintoma é silencioso
devolveria o sintoma silencioso.

- **Código:** `apps/runner/src/criar-chave-de-dispositivo.ts:202`
  (`criarChaveDeDispositivo`), `:275` (`finalizarChaveDeDispositivo`), `:82`
  (`SUFIXO_PARCIAL`), `:177` (`resolverDestino`); `apps/runner/src/base.ts:85`
  (`pastaDeConfiguracaoDoBrabo`, extraída);
  `apps/runner/src/index.ts:1280` (o despacho antes de `lerArgumentos`, e a
  separação stdout/stderr)
- **Teste:** `apps/runner/src/criar-chave-de-dispositivo.spec.ts` — o caminho
  feliz ponta a ponta (a pública no stdout, o parcial em 600, o `finish`
  carimbando, e a chave resultante lida por `lerChaveDeDispositivo` e ASSINANDO
  um JWT de ticket de verdade), o `--dir`, e as recusas: `finish` sem `create`,
  sem `--id`, com `--id` colado do JSON inteiro, chave completa já no lugar
  (nos dois comandos), parcial que não é a JWK, subcomando desconhecido e o
  aviso de órfão; `apps/runner/src/index.spec.ts` — a JUNÇÃO no processo de
  verdade: `device-key create` roda numa pasta SEM credencial nenhuma, e o
  stdout contém só a JWK pública
- **Lacuna DECLARADA, e FECHADA nas duas metades:** quem REGISTRA a pública
  não existia neste repositório quando esta RN fechou — a rota chegou na
  [RN-552](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-552) e o `install.sh` que encadeia os dois comandos, na
  [RN-547](https://github.com/viralabs-dev/brabo/blob/dev/docs/business-rules/produto.md#rn-547). O contrato que este comando assume é o que a rota de
  chave de PROJETO já tem (`{ name, publicKeyJwk }`, com `publicKeyJwk` sendo o
  JSON da JWK pública Ed25519 — `kty` "OKP", `crv` "Ed25519", `x` — e resposta
  com `id`), e é isso que o stdout do `create` produz: uma linha nesse formato.
  O comando também **não** escolhe o `name` do dispositivo, de propósito — ele é
  campo do registro, e quem nomeia é quem registra
- **ADR:** [0155](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0155-a-primeira-conta-nasce-no-terminal.md) ponto 4
- **Origem:** FASE 30, sessão 8 —
  [o recorte da fase](https://github.com/viralabs-dev/brabo/blob/dev/docs/explanation/fase-30-runner-por-maquina.md)

---

## A credencial que não atravessa o container do agente local (RN-558)

<a id="rn-558"></a>

### RN-558 — Credencial no `exec` com container ativo é RECUSADA pelo runner, com desfecho nomeado e origem `politica` {#rn-558}

Lacuna declarada por escrito ao fechar a [RN-507](parte-01.md#rn-507)/[RN-508](https://github.com/viralabs-dev/brabo-api/blob/dev/docs/business-rules/api.md#rn-508)
([ADR 0145](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0145-docker-pre-requisito-do-runner.md)) e medida de novo aqui,
elo por elo, antes de qualquer linha ser escrita.

**A cadeia, medida.** `Engine.Runners.RunnerReadiness.verificar/1`
(`runner_readiness.ex:52`) exige container `running` REGISTRADO antes de
QUALQUER operação de `Engine.Actions.Workspace.RunnerGit` — inclusive o
`git fetch` autenticado inicial, que sai de `fetch!/3`
(`runner_git.ex:226`, via `exec/4` em `:288`). A ÚNICA forma de esse registro
existir num projeto `runner` é o MESMO runner ter subido o próprio container
([ADR 0137](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0137-o-runner-sobe-o-container-do-projeto.md)), e é esse mesmo
sucesso que marca `estado.containerAtivo` nele
(`apps/runner/src/index.ts:822`, em `tratarContainerStart`). Com
`containerAtivo` setado, `tratarExec` rota o comando para dentro do container
(`index.ts:728`–`730`, e a recusa nova em `:693`), e a operação `exec` de
`packages/docker-port` **não tem campo de `env`** — de propósito ([ADR 0130](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0130-broker-de-container.md):
sem `-e` livre nenhum). O campo `env` que a RN-507 acrescentou ao par
`exec`/`exec_result` (`RunnerRouter.exec/5`, `runner_router.ex:50`;
`ExecMessage.env`, `apps/runner/src/channel.ts:62`) só é aplicado no caminho
HOST, onde `apps/runner/src/exec.ts:94` o MESCLA sobre `process.env`.

Resultado: no instante em que a RN-507 deixa o `fetch` autenticado rodar, o
container quase sempre já está de pé no MESMO runner — e era aí que a
credencial ([ADR 0056](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0056-o-engine-trabalha-em-repositorio-remoto.md),
`GitAuth.env_de_auth/1`) era descartada, **em silêncio, sem erro**. O `git`
rodava com o helper efêmero instalado por `-c` e as duas variáveis VAZIAS, e
saía com falha de autenticação — indistinguível de token inválido, permissão
errada ou rede fora. A pessoa caçava a coisa errada, e o produto não dizia
nada.

**A correção é o desfecho NOMEADO, não a entrega da credencial.** O `docker
exec` continua sem campo de `env` — mexer nisso é mudar a porta de contenção,
e é decisão de ADR, não recorte (ver a lacuna declarada abaixo). O que muda é
que o par (`env` presente, container ativo) deixa de ser executado e passa a
ser **recusado**, com marca, mensagem e origem.

**Quem recusa é o RUNNER, e só ele pode.** É o único processo que sabe as duas
metades ao mesmo tempo: que o comando carrega credencial e que ele vai para
dentro do container. O engine não sabe a segunda, e isso foi MEDIDO:
`estado.containerAtivo` nasce `null` a cada execução do runner
(`index.ts:1449`) e só é setado por `tratarContainerStart`, então um container
`running` REGISTRADO no banco **não implica** container ativo naquele processo
— um runner reiniciado com o container de pé roteia pro HOST, e ali a
credencial chega normalmente. Subir a checagem para `RunnerReadiness` ou para
`RunnerGit` recusaria um caminho que funciona. E `RunnerReadiness` fica BYTE A
BYTE como está: ela não ganha flag nem quarta pré-condição — é a mesma regra
que a [RN-516](parte-01.md#rn-516) já enunciou sobre não lhe pendurar uma flag "pula
container".

**A MARCA é constante de PROTOCOLO, não detalhe de mensagem.**
`MARCA_DE_CREDENCIAL_NAO_ENTREGUE` (`index.ts`) e `@marca`
(`credencial_de_git.ex`) carregam o MESMO token, e é por ele — não pela frase —
que o engine reconhece a recusa depois de ela ter atravessado um `rescue` e
virado string solta. Mudar um lado só não quebra compilação de nada: a recusa
continua acontecendo e só a CLASSIFICAÇÃO volta a errar, que é a forma exata do
defeito que esta RN fecha. Nenhuma das duas suítes alcança a outra linguagem
(ExUnit não lê TypeScript, o vitest do runner não lê Elixir), então a guarda
mora em `scripts/ci/`, com os outros testes que leem o repositório inteiro como
texto.

**A origem é `politica`, e a escolha aponta AÇÃO.** As quatro do
[ADR 0020](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0020-destravar-gates-qa-secops.md) não distribuem culpa, dizem o que
fazer. Isto não é cláusula que ninguém escreveu (`codigo`) nem rede que caiu
(`infra`): é a contenção do ADR 0130 funcionando como desenhada, contra um caso
que ela não previu. Quem lê `politica` sabe que não há bug para caçar — há uma
decisão de produto pendente. `Engine.Runners.CredencialDeGit.desfecho/1`
acrescenta UM caso e não reclassifica nenhum outro: qualquer outra falha de
worktree mantém byte a byte `{"falha ao preparar o worktree", "codigo"}`, nos
DOIS dev agents (o real e o Noop, que existe para exercitar ESTE caminho e não
uma cópia dele).

**A recusa de CONTENÇÃO vence, e a ordem é decisão.** Ela entra DEPOIS de
`validarCwdDentroDaRaiz` (`guard.ts`): um comando apontado para fora da raiz
precisa ouvir **isso**, porque ali há uma fronteira de contenção sendo
recusada, enquanto aqui há uma capacidade que falta. Colapsar as duas faria um
comando fora do escopo parecer problema de credencial — o mesmo defeito de
diagnóstico, com outro sinal.

**O `env` nunca aparece na recusa — só a CONTAGEM.** A invariante da RN-507 é
que `msg.env` não vai para log nenhum, e esta saída vai para o event log do
produto: a recusa diz "2 variável(is) de ambiente", jamais um nome ou um valor.
O número já diz o que se precisa saber ali.

**O que NÃO é afetado, confirmado por leitura:** repositório `local` (provider
sem token) — `GitAuth.env_de_auth/1` devolve `[]`, `fetch!/3` converte para
`nil`, o campo nem entra no payload, e a recusa não dispara; os modos
`container` e `mounted` — nunca passam por `RunnerGit` (`Workspace.ensure!/4`
bifurca por `execution_mode` e só `runner` vai para lá), e o container deles
sobe pelo broker, do outro lado da rede; e comando de terminal comum, que nunca
carregou `env`. `workspace_create` também carrega `env`, e também não é afetado:
ele roda no HOST (`criarPastaDoProjeto`), não no container.

- **Código:** `apps/runner/src/index.ts` (`MARCA_DE_CREDENCIAL_NAO_ENTREGUE` e
  a recusa em `tratarExec`, depois da
  validação de `cwd`), `apps/runner/src/channel.ts`
  (o docblock de `ExecMessage.env`, que prometia "roda só sem a credencial"),
  `apps/engine/lib/engine/runners/credencial_de_git.ex` (novo — a marca,
  `recusada?/1`, `mensagem/2` e `desfecho/1`),
  `apps/engine/lib/engine/actions/workspace/runner_git.ex` (a cláusula nova em
  `fetch!/3`, antes da genérica, e o moduledoc),
  `apps/engine/lib/engine/dev/dev_agent_server.ex` e
  `apps/engine/lib/engine/dev/noop_dev_agent_server.ex` (o desfecho de
  `{:error, reason}` na criação do worktree)
- **Teste:** `apps/runner/src/index-handlers.spec.ts`, bloco *"a credencial não
  atravessa o docker exec (RN-558)"* — o caminho feliz (sem container, o `env`
  chega ao host e nada é recusado), o caso de falha (com container, recusa
  nomeada e `docker.exec` NÃO chamado), a prova negativa de que nome e valor
  das variáveis não vazam na saída, `env` vazio não virando recusa, e a recusa
  de contenção de `guard.ts` vencendo esta quando o `cwd` está fora da raiz;
  `apps/engine/test/engine/actions/workspace_runner_test.exs` (os dois testes
  `RN-558`: a recusa que vira mensagem nomeada com origem `politica`, e a falha
  REAL do fetch que mantém a mensagem de sempre com origem `codigo` — o par
  negativo que prova que a cláusula nova não sequestrou a antiga);
  `apps/engine/test/engine_web/channels/credencial_no_runner_test.exs` (AT-111,
  a CORRENTE inteira pelo `TerminalChannel` real: o `env` chega ao canal só no
  `fetch`, a resposta do runner é a fixture
  `apps/runner/fixtures/exec-result-recusa-de-credencial.json` — que o spec do
  runner compara byte a byte com a saída real de `tratarExec` —, `RunnerGit`
  devolve a mensagem nomeada, e o `DevAgentServer` grava `dev.blocked` com origem
  `politica`; mais o ramo sem container ativo, em que o `fetch` responde 0, e a
  falha real, que segue `codigo`. NÃO prova a ponte entre linguagens por
  execução: nenhum processo `node` sobe no ExUnit, e o par que a fecha é a
  fixture comum. Verificado por mutação: cortar o `env` no canal, no
  `RunnerGit`, o reconhecimento da recusa, o `desfecho/1` ou o uso dele no dev
  agent reprova o teste; desligar a recusa em `tratarExec` reprova o spec do
  runner);
  `scripts/ci/marca-de-credencial-do-runner.spec.ts` (a marca idêntica nos dois
  lados). Verificado por mutação: neutralizar a cláusula de `fetch!/3` reprova
  o teste do engine com a mensagem antiga à vista
- **Lacuna DECLARADA, que é a METADE que continua aberta — FECHADA pela
  [RN-676](#rn-676) ([ADR 0193](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0193-git-credenciado-no-host-do-runner.md),
  decisão do dono de 01/10):** o fetch credenciado vai MARCADO pelo engine e
  roda no HOST do runner mesmo com container ativo; esta recusa encolheu para o
  `env` SEM a marca (na prática, um runner anterior ao ADR 0193). O texto
  abaixo é o de quando ela fechou a metade do silêncio: a credencial
  continua **não atravessando** o `docker exec`. Clone/fetch de repositório
  remoto AUTENTICADO em modo `runner` segue impossível com o container de pé —
  o que mudou é que agora ele falha DIZENDO isso, em vez de parecer erro de
  token. Fechar exige decidir COMO uma operação credenciada fala com um `docker
  exec` sem campo de `env`, e as opções conhecidas mexem todas na porta de
  contenção do ADR 0130 (dar `env` à operação; um arquivo de credencial montado
  e apagado; rodar o `fetch` no host mesmo com container ativo, o que quebraria
  o invariante de que o trabalho acontece dentro do container). É ADR, nunca
  correção de passagem. A ADJACÊNCIA que esta entrega também declarou — a
  recusa acontecia DEPOIS de `init_from_bare!/5` já ter feito `git init`, e o
  `git_dir?/2` de `ensure!/5` marcava o workspace pronto na tentativa seguinte
  por encontrar o `.git`, de modo que a segunda tentativa falhava adiante no
  `worktree add` em vez de repetir a recusa — **FECHOU no AT-112**: a
  inicialização que falha (qualquer passo, não só o `fetch` credenciado)
  DESFAZ o `.git` que ela mesma criou (`inicializar_ou_desfazer!` em
  `Engine.Actions.Workspace` e em `RunnerGit`) e relança a exceção original,
  então a tentativa seguinte repete a MESMA causa. O desfazer só roda no ramo em
  que NÃO havia `.git` — o de "workspace de antes da marca" (que tem `.git` e
  não se re-inicializa) segue intacto, então não apaga trabalho de ninguém. Do
  lado `runner` o `rm -rf` é best-effort (o runner pode ter caído, uma das
  causas da falha). Sinais considerados e recusados: marcador de "em
  andamento" (segundo arquivo a manter, e órfão se o processo morrer entre os
  dois passos) e checar a ref esperada (o repositório vazio, sem
  `origin/<branch>`, é um estado LEGÍTIMO e cairia como falha)
- **ADR:** nenhum novo — a entrega não move fronteira nenhuma. Ela CONSOME o
  [0130](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0130-broker-de-container.md) (a porta sem `env`), o
  [0137](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0137-o-runner-sobe-o-container-do-projeto.md) (o container na
  máquina do usuário), o [0145](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0145-docker-pre-requisito-do-runner.md) (a
  pré-condição e o campo `env`) e o [0020](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0020-destravar-gates-qa-secops.md) (as
  quatro origens)
- **Origem:** `AT-053` — a lacuna que o ADR 0145 deixou declarada por escrito

---

## O git credenciado roda no host do runner (RN-676)

<a id="rn-676"></a>

### RN-676 — Com container ativo, o `git fetch` credenciado de `RunnerGit` roda no HOST do runner, marcado pelo engine; o código continua no container {#rn-676}

Decisão do dono (01/10), registrada no
[ADR 0193](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0193-git-credenciado-no-host-do-runner.md): operação de git
CREDENCIADA roda no HOST do runner, e o código roda no container. Fecha a
metade que a [RN-558](#rn-558) deixou aberta — o fetch autenticado em modo
`runner` com o container de pé, que é o caminho comum, terminava sempre na
recusa nomeada.

1. **Quem marca é o engine, e só num ponto.** `RunnerGit.fetch!/3` despacha o
   fetch com credencial por `RunnerRouter.exec_git_credenciado/5`, que põe
   `gitCredenciado: true` no payload `exec` e exige `env` não vazio por
   guarda. O comando de terminal do dev agent passa por `RunnerRouter.exec/4` e
   nunca leva a marca. Sem credencial (provider `local`), o fetch vai sem marca.
2. **O runner roda no host só com a CONJUNÇÃO**: a marca `true` literal **e**
   `env` não vazio. Aí o comando vai a `executarComando` (o `env` mesclado sobre
   `process.env`), mesmo com container ativo. A pasta é a mesma: `estado.dir` é
   o bind-mount de `/work`.
3. **`env` sem a marca não ganha o host.** Com container ativo, esse par segue
   RECUSADO com a marca da RN-558 e origem `politica`. Hoje nenhum chamador do
   engine o produz; na prática ele chega de um `brabo-runner` anterior ao ADR
   0193, que não lê a marca — e a mensagem do engine diz para atualizá-lo. A
   marca sem `env` também não muda nada: o comando vai ao container.
4. **Nenhuma contenção muda**: `DockerPort.exec` segue sem `env` (ADR 0130), e
   `RunnerReadiness` (RN-507) fica byte a byte — a marca decide ONDE o runner
   executa, nunca SE o engine despacha.
5. **O log nunca traz nome nem valor de variável do `env`**: a recusa dá a
   contagem, e o log do caminho host acrescenta só `[git credenciado, no host]`.

- **Código:** `apps/runner/src/index.ts:701` (`gitCredenciadoNoHost`), `:666`
  (`tratarExec`); `apps/runner/src/channel.ts:71` (`gitCredenciado`), `:627`
  (`gitCredenciado`); `apps/engine/lib/engine/runners/runner_router.ex:93`
  (`exec_git_credenciado`), `:98` (`despachar_exec`);
  `apps/engine/lib/engine/actions/workspace/runner_git.ex:357` (`exec`), `:443`
  (`despachar`); `apps/engine/lib/engine_web/channels/terminal_channel.ex:609`
  (`git_credenciado`); `apps/engine/lib/engine/runners/credencial_de_git.ex:93`
  (`mensagem`)
- **Teste:** `apps/runner/src/index-handlers.spec.ts:366` (o helper real do
  `git` recebe a credencial no host com container ativo — caminho feliz),
  `:391` (um `git fetch origin` real sucede no host), `:430` (`env` sem a marca
  segue recusado — caso de falha); `apps/runner/src/channel.spec.ts:208`;
  `apps/engine/test/engine/actions/workspace_runner_test.exs:451`, `:466`,
  `:476`; `apps/engine/test/engine_web/channels/credencial_no_runner_test.exs:149`
  (AT-111: a corrente pelo `TerminalChannel` real termina em `{:ok, _}`), `:177`.
  Os testes ExUnit não rodaram no ambiente desta entrega (`repo.hex.pm` 403); o
  CI os prova.
- **Origem:** AT-116 (prova: AT-111), decisão do dono de 01/10

## A Anamnese religada: sujeito elegível e fato do perfil (RN-680)

<a id="rn-688"></a>

### RN-688 — O binário do runner lê o PTY com leitor próprio sob o Bun, e o auto-teste prova a SEGUNDA leitura {#rn-688}

Sob o Bun (o binário do `bun build --compile`, [ADR 0112](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0112-binario-standalone-do-runner-via-bun-build-compile.md)),
o `tty.ReadStream` com que o `node-pty` lê o lado mestre do PTY é um
`fs.ReadStream`, e a primeira leitura sem dados do fd não-bloqueante SOBE como
`EAGAIN`: o stream se destrói, fecha o fd, e nenhum `onData` chega depois disso
(oven-sh/bun#25822). O terminal interativo do binário parava depois do primeiro
pedaço de saída nas TRÊS plataformas Unix; o Linux passava na prova só porque a
primeira leitura já trazia o eco e a resposta juntos.

**A regra:** sob o Bun e fora do Windows, o `spawn` do `node-pty` roda com o
`tty.ReadStream` trocado por um leitor próprio que lê o MESMO fd com `fs.read`
e, no `EAGAIN`, ESPERA e tenta de novo (de 4 ms, dobrando até 32 ms, voltando
ao mínimo a cada dado); `EIO` ou zero bytes é fim. A troca vale só DURANTE o
`spawn` e é restaurada mesmo quando ele lança; sob o Node o módulo volta
INTACTO. O fd e o processo filho continuam os de verdade — nada simula saída.
E o `--self-test-pty` faz DUAS voltas, a segunda depois de uma pausa sem nada a
ler: é a pausa que força a leitura a passar por um `EAGAIN`, e é por ela que o
leitor antigo reprova também no Linux. Quando reprova, o auto-teste diz por quê
(pedaços, saída do filho, uma sonda num segundo PTY e os eventos do stream) — o
veredito não muda.

Foi a sonda que mediu o Windows: lá o lado de leitura é o pipe nomeado do
ConPTY, aberto pelo `node-pty` como `net.Socket`, sem fd que o leitor possa
assumir, e o pipe termina depois do primeiro pedaço — por isso o `win32-x64`
saiu da matriz ([ADR 0187](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0187-runner-sem-binario-win32-x64.md)) em vez de
ganhar contorno.

- **Onde:** `apps/runner/src/leitor-de-pty.ts:60` (`precisaDoLeitorProprio`),
  `:70` (`LeitorDeFdNaoBloqueante`), `:115` (`agendar`), `:152`
  (`comLeitorDePtyProprio`); `apps/runner/src/native-pty-loader.ts:114`
  (`comLeitorDePtyProprio`); `apps/runner/src/index.ts:1263`
  (`PAUSA_ENTRE_VOLTAS_MS`), `:1298` (`sondarPty`), `:1353`
  (`rodarAutoTestePty`)
- **Teste:** `apps/runner/src/leitor-de-pty.spec.ts:14` (só sob o Bun e fora do
  Windows), `:23` (fora dele, o MESMO módulo), `:28` (troca só durante o
  `spawn`, restaura quando ele lança — caso de falha), `:48` (as duas voltas de
  um `cat` real, com `EAGAIN` entre elas); a prova de ponta a ponta é o
  `smoke:bin` da matriz, verde em `darwin-arm64`, `linux-x64` e `linux-arm64`
  no ensaio `36779817686`
- **ADR:** [0112](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0112-binario-standalone-do-runner-via-bun-build-compile.md),
  [0187](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0187-runner-sem-binario-win32-x64.md)
- **Origem:** AT-342, AT-343

## AT-770 — o brabo-contracts chega por pacote do GitHub Packages

<a id="rn-1040"></a>

### RN-1040 — O runner publicado não declara `@viralabs-dev/*` em `dependencies` {#rn-1040}

O `@brabo/docker-port` chega do GitHub Packages (`npm:@viralabs-dev/brabo-docker-port@X.Y.Z`,
alias do pnpm) e é **devDependency**: o `tsup` e o `bun build` o embutem, então o
artefato do runner não o carrega em runtime. Um pacote que dependesse do GitHub
Packages exigiria `.npmrc` e token de quem instala, e isso é proibido.

**A regra:** `dependencies` do `package.json` não tem nenhum `@viralabs-dev/*` nem
`@brabo/docker-port`; o alias fica em `devDependencies`, na versão exata (sem `^`).
O `.npmrc` do repo traz só a linha do registry do escopo, sem token (o token vive no
CI, pelo `GITHUB_TOKEN`, ou no `~/.npmrc` do dev).

- **Onde:** `package.json` (`devDependencies`), `.npmrc`, `.github/workflows/ci.yml`,
  `.github/workflows/build-runner-binaries.yml` (`packages: read`)
- **Teste:** `src/contratos-por-pacote.spec.ts:11` (`dependencies` sem
  `@viralabs-dev/*`), `:16` (alias exato em `devDependencies`), `:20` (`.npmrc` sem token)
- **Origem:** AT-770

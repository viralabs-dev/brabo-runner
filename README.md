# `brabo-runner`

CLI que roda **na máquina do próprio usuário** e se conecta ao engine do Brabo
por um canal Phoenix autenticado com ticket de uso único (ADR 0102/0103). Serve
aos projetos em modo `runner` (ADR 0104): a pasta do código fica na sua máquina,
sem bind mount. Com os privilégios de quem o executa, ele:

- executa os comandos dos agentes que o pipeline de `proposed_action` já
  **aprovou** (`exec`), confirmando o caminho real da pasta;
- abre um terminal interativo de verdade (PTY) para a aba **Terminal** da web;
- navega pelas pastas locais (`fs_list_dir`/`fs_home_dir`) para o seletor
  "Procurar pasta..." da criação e adoção de projeto;
- sobe o container do projeto (`container_start`) pela porta de Docker do
  `@brabo/docker-port` (ADR 0128/0130) e cria pastas de projeto
  (`workspace_create`) quando há uma base consentida.

Ele não decide política: só faz o que o produto já aprovou. O desenho de cada
parte está nos docblocks de `src/channel.ts`, `src/exec.ts`, `src/pty.ts`,
`src/guard.ts` e `src/fs-browser.ts`. As regras de negócio estão em
[`docs/business-rules/runner.md`](docs/business-rules/runner.md).

## Repositórios do Brabo

O Brabo é dividido em repositórios por camada
([ADR 0252](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0252-o-brabo-vira-um-conjunto-de-repositorios.md)),
e a documentação central está no [brabo](https://github.com/viralabs-dev/brabo)
e em https://viralabs-dev.github.io/brabo/prd/.

- **Depende de:** [brabo-contracts](https://github.com/viralabs-dev/brabo-contracts)
  (o `@brabo/docker-port`, instalado do GitHub Packages na versão `1.2.0`, pelo alias `npm:@viralabs-dev/brabo-docker-port@1.2.0`) e
  [brabo-ci](https://github.com/viralabs-dev/brabo-ci) (política de PR e release
  por tag).
- **É usado por:** [brabo](https://github.com/viralabs-dev/brabo) (o
  `install.sh` baixa o binário da Release do runner) e
  [brabo-infra](https://github.com/viralabs-dev/brabo-infra) (aferições
  cruzadas e manifesto da Release do produto).

| Repositório | Papel |
|---|---|
| [brabo](https://github.com/viralabs-dev/brabo) | Porta de entrada: documentação central, ADRs, instalador e release do produto |
| [brabo-api](https://github.com/viralabs-dev/brabo-api) | API (NestJS, Drizzle, PostgreSQL com pgvector) |
| [brabo-engine](https://github.com/viralabs-dev/brabo-engine) | Engine (Elixir/OTP, Phoenix, Oban): agentes, gates, sessões e runners |
| [brabo-web](https://github.com/viralabs-dev/brabo-web) | Interface web (React, Vite, TanStack, Tailwind) |
| [brabo-runner](https://github.com/viralabs-dev/brabo-runner) | Este repositório: a CLI que roda na máquina do usuário |
| [brabo-broker](https://github.com/viralabs-dev/brabo-broker) | Broker de containers, o único processo que fala com o Docker do servidor |
| [brabo-contracts](https://github.com/viralabs-dev/brabo-contracts) | Contratos compartilhados (shared, docker-port, contracts) |
| [brabo-infra](https://github.com/viralabs-dev/brabo-infra) | Infraestrutura: composes, Kubernetes, backup e restore, docker-bake |
| [brabo-ci](https://github.com/viralabs-dev/brabo-ci) | Workflows reutilizáveis de política de PR, aprovação, promoção e versão |
| [brabo-qa](https://github.com/viralabs-dev/brabo-qa) | Testes entre repositórios: E2E, golden-sets e instrumentos de medição |
| [brabo-workspace](https://github.com/viralabs-dev/brabo-workspace) | Pasta-mãe que reúne os clones dos repositórios lado a lado |

## Instalação

### Pelo instalador (recomendado)

É o mesmo comando que a tela do projeto (modo `runner`) mostra:

```sh
curl -fsSLO https://github.com/viralabs-dev/brabo/releases/latest/download/install.sh && bash install.sh
```

O `install.sh` vem da Release do `brabo`; o binário do runner vem da Release do
`viralabs-dev/brabo-runner` na tag que o instalador fixa. Ele confere o binário
contra o `checksums.txt` assinado dessa Release, instala já executável
(`install -m 0755`), pareia a máquina pelo terminal (`device-key create`/`finish`,
abaixo) e instala o agente de máquina como serviço (RN-547).

O antigo **modo automático pelo navegador** (ADR 0118), que gravava binário,
`brabo-runner.config.json` e chave de dispositivo numa pasta, foi aposentado no
ADR 0203. Uma pasta configurada assim **continua funcionando**: a CLI ainda lê a
config e a chave da pasta de onde é executada, e uma flag explícita sempre vence
o arquivo local.

### Binário standalone (sem Node nem npm)

O runner é distribuído só como binário da Release (AT-774); não há pacote no npm.

Baixe o executável da sua plataforma na
[Release do brabo-runner](https://github.com/viralabs-dev/brabo-runner/releases):

| Plataforma | Arquivo |
|---|---|
| Linux x64 | `brabo-runner-linux-x64` |
| Linux ARM64 | `brabo-runner-linux-arm64` |
| macOS Apple Silicon | `brabo-runner-darwin-arm64` |

```sh
chmod +x ./brabo-runner-<plataforma>
./brabo-runner-<plataforma> --project <projectId> --dir <caminho-absoluto> --token brb_...
```

- **macOS Intel não tem binário, por decisão** (ADR 0174): no `macos-15-intel`
  o binário compila mas reprova o `--self-test-pty`, por um bug do Bun com o
  `node-pty` (oven-sh/bun#25822). A mesma prova passa no Node, então ali não
  há instalação, e o `install.sh` diz isso e aponta onde pedir.
- **Windows não tem binário, por decisão** (ADR 0187): sob Bun o pipe de saída
  do ConPTY termina depois do primeiro pedaço. O
  `install.sh` já recusa Windows (ADR 0150).

O binário é um arquivo só, com o addon nativo `node-pty` embutido (ADR 0112) e
extraído para um diretório temporário na primeira execução. Ainda não é
assinado nem notarizado (Gatekeeper e SmartScreen avisam no primeiro uso):
pendência do ADR 0112 que depende de o dono obter uma identidade de assinatura.

## Uso

```sh
brabo-runner --project <projectId> --dir <caminho-absoluto> --token brb_... [--api-url <url>] [--base <pasta>]
```

Todas as flags são opcionais quando a pasta corrente tem
`brabo-runner.config.json`/`brabo-runner-device-key.jwk.json`; a flag explícita
sempre vence o arquivo local.

- `--project`: o id do projeto, com `execution_mode` = `runner`. Só **um** runner
  por projeto no cluster (`Engine.Runners.Registry`): um segundo é recusado no
  join. Sem `--project`, a CLI só segue como **agente de máquina** (abaixo).
- `--dir`: a pasta absoluta do código do projeto nesta máquina, raiz do `exec`
  e do PTY. Sem ela, vale a pasta corrente. Se não existir, é **criada**
  (`mkdir -p`); se apontar para um arquivo, é erro (RN-435). No **Linux**, só é
  aceita dentro do `$HOME`, conferido antes da criação (RN-434). A navegação de
  pastas **não** fica presa a ela, de propósito (`src/fs-browser.ts`).
- `--token`: um Personal Access Token (`brb_...`), gerado em **Configurações do
  projeto -> Tokens de acesso**, ou a variável `BRABO_ACCOUNT_TOKEN`. Nunca é
  gravado em disco. Sem token, autentica pela chave de dispositivo local (JWT
  EdDSA curto, assinado a cada tentativa de conexão).
- `--api-url`: flag -> `BRABO_API_URL` -> `apiUrl` do
  `brabo-runner.config.json` -> `http://localhost:3000`.
- `--base`: a **base de projetos** desta máquina, sob a qual cada projeto é uma
  subpasta (ADR 0151, RN-529). Sem a flag, é lida de
  `$XDG_CONFIG_HOME/brabo/runner.json` (senão `~/.config/brabo/runner.json`),
  onde o instalador a grava. Sem flag e sem arquivo, o runner roda sem base.

### Base e `--dir` são coisas diferentes

`--dir` é a raiz **deste** projeto; a base é onde nasce a pasta de um projeto
**novo**. Um projeto fora da base continua válido: a base é regra de
**criação**, e a validação do `--dir` não a consulta. A base é **local** e
nunca chega pela rede; o servidor manda só o **segmento relativo** (ADR
0130/0144). A base é recusada, com motivo nomeado, quando é relativa, tem `..`,
é `/`, é um arquivo, está fora do `$HOME` no Linux ou fica dentro da pasta deste
projeto (ou é igual a ela). Recusa vinda da **flag** encerra com código 2; vinda
do **arquivo**, vai para o `stderr` e o runner segue sem base.

Com base consentida, o runner declara a capacidade `workspace` no `join` e
atende `workspace_create` (RN-532): `mkdir -p` e `git init`, ou clone quando o
pedido traz URL de repositório (a credencial vai em `env` e o clone roda no
**host**, ADR 0145). No sucesso, ele empurra o `workspace_confirm`, a única
mensagem que grava `workspace_verified_at`. Os erros são nomeados (`sem-base`,
`segmento`, `nao-e-pasta`, `mkdir`, `git`). O `estado.dir` **não muda**: trocar
a raiz de contenção do `guard.ts` por uma mensagem de rede seria mover uma
fronteira.

### A credencial de git não entra no container (RN-558, RN-676)

Com o container do projeto de pé, todo comando vai por `docker exec`, e a porta
de Docker **não tem campo `env`**, de propósito (ADR 0130). Por isso:

- o `git fetch` autenticado, marcado pelo engine com `gitCredenciado: true` e
  com `env` não vazio, roda no **host**, na mesma pasta (é o bind mount de
  `/work`) (ADR 0193);
- um `env` **sem** a marca, com container ativo, é **recusado** antes de
  executar qualquer coisa, com uma saída que diz o que houve e que nada foi
  executado, sem citar nomes nem valores das variáveis.

### Agente de MÁQUINA: sem `--project`, uma conexão por projeto (RN-544)

Com uma **chave de dispositivo de máquina** (ADR 0154, RN-543) e uma **base
consentida**, o runner roda sem `--project`: consulta `GET /runner/projects` e
abre uma conexão por projeto listado, cada uma em `<base>/<workspaceDirName>`.

```sh
# a base vem do instalador (~/.config/brabo/runner.json) ou de --base
brabo-runner --api-url https://brabo.exemplo
```

- Com ao menos uma conexão viva, a lista só é consultada na partida; projeto
  novo entra quando o agente reconecta.
- **Lista vazia é normal e o agente FICA DE PÉ** (RN-550): reconsulta a cada
  15s, 30s e depois 60s, para quando chega a primeira lista não vazia e imprime
  um batimento a cada 30 consultas vazias. **Dez falhas seguidas** da consulta
  encerram com 1.
- Lista não vazia com todos os projetos recusados encerra com 1.
- Teto de tentativas e recusa de join são **por projeto**: o recusado termina
  nomeado e os outros seguem. Todo log leva o nome do projeto como prefixo.
- Credencial presa a um projeto é recusada com 403, e a CLI repassa a mensagem
  nomeando a correção (`--project`). `--api-url` vem da flag, de
  `BRABO_API_URL` ou do padrão; o `brabo-runner.config.json` é por projeto e não
  entra.

## Importar chaves de API locais (`credentials import`)

Subcomando INTERATIVO (AT-611, RN-927): sem TTY, sai com 2 sem ler nada. Acha as
chaves de API de LLM que Claude Code, Codex, OpenCode, Kilo e Hermes já guardam,
lista cada uma (ferramenta, origem, provider do Brabo, 4 últimos dígitos) e
pergunta, item a item, se importa. Cada sim vira um `POST /runner/llm-credentials`
com a chave de dispositivo de MÁQUINA (PAT e chave de projeto levam 403); no 409,
pergunta se substitui. Login por assinatura só é listado. O valor da chave nunca
é impresso.

```sh
brabo-runner credentials import
```

## Chave de dispositivo pelo terminal (`device-key create | finish`)

O par Ed25519 nasce **nesta máquina**, sem navegador (ADR 0155, RN-551); é assim
que o instalador pareia o agente. A metade privada **nunca viaja**.

```sh
# 1) gera o par e imprime a JWK PÚBLICA (uma linha, no stdout)
PUB=$(brabo-runner device-key create)

# 2) quem tem a credencial (o instalador) registra a pública na api
ID=$(… POST {"name": "…", "publicKeyJwk": '"$PUB"'} … | jq -r .id)

# 3) carimba o `kid` (o id do registro) e grava a chave de verdade
brabo-runner device-key finish --id "$ID"
```

- São dois passos por causa do `kid`, que só existe depois do registro
  (RN-475). O `create` grava em `brabo-runner-device-key.jwk.json.parcial`, nome
  que o runner não procura.
- Fica em `$XDG_CONFIG_HOME/brabo/` (senão `~/.config/brabo/`); `--dir <pasta>`
  muda o destino. Chave privada em modo 600, pasta criada em 700.
- stdout é para scripts, stderr é para gente.
- Sobrescrever uma chave completa é recusado, sem `--force`: revogue a atual,
  apague o arquivo e recomece do `create`.

## Serviço de usuário (`service install | uninstall | status`)

Para o runner subir com a sua sessão: `systemd --user` no Linux, `LaunchAgent` no
macOS (ADR 0147, RN-518).

```sh
# de dentro de uma pasta com brabo-runner.config.json
brabo-runner service install
brabo-runner service status
brabo-runner service uninstall

# ou o agente desta MÁQUINA (atende todos os seus projetos em modo runner)
brabo-runner service install --machine
brabo-runner service status --machine
brabo-runner service uninstall --machine
```

- **Sempre nível de usuário.** `service install` como root é recusado. Windows
  fica fora, por decisão: os três subcomandos recusam nomeando a plataforma.
- **Dois tipos de unit, que coexistem no disco** (ADR 0154, RN-545): a de
  **projeto** (`brabo-runner-<projectId>.service` /
  `dev.brabo.runner.<projectId>`) e a de **máquina** (`brabo-runner.service` /
  `dev.brabo.runner`). `--machine` é opt-in explícito; com `--project`, é
  recusa nomeada.
- `install --machine` exige base consentida e recusa uma pasta com
  `brabo-runner.config.json`. `install` recusa quando o OUTRO tipo já está
  instalado, sem `--force`.
- A credencial é só a chave de dispositivo; `--token`/`BRABO_ACCOUNT_TOKEN` são
  ignorados para não irem parar num arquivo de unit.
- `uninstall` remove a unit, o `brabo-runner.config.json` e a
  `brabo-runner-device-key.jwk.json` (a pasta vem da própria unit; sem unit,
  passe `--dir`). A chave **não** é revogada no servidor. Sem tipo nomeado,
  `uninstall` recusa e lista o que existe.
- `status` responde um de quatro estados: não instalado (`4`), rodando (`0`),
  parado (`3`) e gerenciador sem resposta (`5`).
- O `PATH` (e o `XDG_CONFIG_HOME`, quando definido) é congelado na unit: se
  mudou, rode `service install` de novo. Unit instalada por versão antiga com
  `WorkingDirectory=` entre aspas, ou com `%`/espaço no `PATH` ou no
  `XDG_CONFIG_HOME` (AT-095), também se resolve reinstalando. Confira o valor que
  o systemd entendeu com
  `systemctl --user show -p Environment brabo-runner.service`.

## Reconexão

Quando a conexão cai, o runner **pede um ticket NOVO** e tenta de novo com
espera de `1s, 2s, 5s, 10s, 30s` e teto de 10 tentativas seguidas sem sucesso.
Recusa de join (ticket inválido, outro runner no projeto) não é transitória:
encerra na hora, com a mensagem.

O auto-reconnect da lib `phoenix` fica **desligado** (`reconnectAfterMs`): o
ticket é de **uso único** (RN-108) e o reconnect da lib repete o ticket já
consumido. Uma versão antiga saiu com ele ligado e gerava recusa a cada ~5s e
**429 na tela web do dono da conta**. Se aparecer 429 sem explicação, confira se
o binário do runner está atualizado.

## macOS e o `spawn-helper` do `node-pty` (AT-114, AT-342)

O tarball do `node-pty@1.1.0` traz `prebuilds/darwin-<arch>/spawn-helper` sem o
bit de execução, e sem ele o terminal falha com `posix_spawnp failed`. Sob
**Node**, o runner confere e corrige esse bit ao carregar o `node-pty`
(`src/spawn-helper.ts`); se não conseguir, PARA com um erro que nomeia o caminho
e a correção (`chmod +x "<caminho>"`). O binário standalone já extrai o
`spawn-helper` com `0755` (`native-pty-loader.ts`).

Sob **Bun**, o `tty.ReadStream` que o `node-pty` usa morre no primeiro `EAGAIN`.
O runner troca esse leitor, só durante o `spawn`, por um leitor próprio do mesmo
fd que espera e tenta de novo (`leitor-de-pty.ts`). O `--self-test-pty` prova
isso com duas voltas e uma pausa entre elas.

## Segurança

A fronteira de segurança do runner **não é sandbox**: é a composição de três
coisas, a autenticação (o token ou a chave de dispositivo da sua conta), o
pipeline de aprovação de sempre (todo comando de agente nasce como ação
proposta, sujeita à política do projeto) e o seu consentimento em rodar este
binário na sua máquina, com os seus privilégios. `guard.ts` e
`espelho-guard.ts` são best-effort por desenho.

## Desenvolvimento

Exige Node.js 22.6 ou mais novo e pnpm (versão em `packageManager`). Branches
permanentes `dev` e `main`; tag só por workflow.

```sh
# precisa de ~/.npmrc com //npm.pkg.github.com/:_authToken=<PAT classic read:packages>
pnpm install
pnpm start -- --project <projectId> --dir <caminho-absoluto> --token brb_...
pnpm lint        # oxlint --deny-warnings em src/ e scripts/
pnpm typecheck
pnpm test
pnpm build       # dist/index.cjs (o que vai para o npm)
pnpm smoke       # exercita o dist/ empacotado
```

Esses são os passos do `ci.yml`. O binário standalone exige
[Bun](https://bun.sh) e só compila para a plataforma CORRENTE:

```sh
pnpm build:bin
pnpm smoke:bin
```

## Mais

As decisões de arquitetura do runner local estão nos ADRs do `brabo`:
[0103](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0103-runner-local-execucao-na-maquina-do-usuario.md)
(runner local),
[0104](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0104-execution-mode-tres-valores-e-workspace-verificado-pelo-runner.md)
(modo de execução),
[0105](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0105-personal-access-token-do-runner-escopado-por-construcao.md)
(token),
[0106](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0106-distribuicao-do-runner-via-tsup-e-npm-publish.md)
(distribuição pelo npm),
[0107](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0107-navegacao-de-pasta-local-via-o-runner.md)
(navegação de pastas) e
[0112](https://github.com/viralabs-dev/brabo/blob/main/docs/adr/0112-binario-standalone-do-runner-via-bun-build-compile.md)
(binário standalone).

## Apoie

Se o projeto te ajuda, você pode [pagar um café no Ko-fi](https://ko-fi.com/daneiel).

## Licença

MIT. Os avisos de software de terceiros, com a oferta escrita para as
bibliotecas LGPL do runtime do Bun, estão em
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

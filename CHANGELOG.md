# Changelog

## Unreleased

- O `@brabo/docker-port` passa a vir do GitHub Packages (AT-770, RN-1040): alias `npm:@viralabs-dev/brabo-docker-port@1.2.0` em `devDependencies` no lugar da dependência git por TAG, `.npmrc` só com o registry do escopo, `packages: read` e `setup-node` com escopo no `ci.yml` e no `build-runner-binaries.yml` (token pelo `GITHUB_TOKEN`), check `contracts-alinhado` do `brabo-ci` (pin `4976af2`). Sai o `scripts/strip-node-modules.mjs` (o `dist` do pacote já é `.js`) e o `--import` do `start` e do `index.spec.ts`. Spec em `src/contratos-por-pacote.spec.ts`: `dependencies` sem `@viralabs-dev/*`.

- Release sem binário faltando (AT-794): a causa do v1.1.0 sem `darwin-arm64` foi o `macos-14` não ser mais suportado pelo GitHub (job cancelado em 1s, sem runner); o alvo passa a `macos-15`. A Release da tag nasce rascunho e o job `checksums` só a publica com os três alvos anexados; faltando algum, o run fica vermelho e a Release segue rascunho até um `workflow_dispatch` com a tag. Teste em `src/release-completo.spec.ts`.

- Check `refs` no PR (AT-782): o `refs.yml` chama o `refs-com-simbolo` do `brabo-ci` (pin `64a1e15`) e reprova a ref `caminho:N` (`símbolo`) de RN que o PR quebra; o artefato `refs-patch` traz a reancoragem. Não é check obrigatório.

- Doc: a decisão do dono de 06/11/2026 (volta ao pt-BR) passa a citar o número do ADR, 0266, no `CLAUDE.md` e no CHANGELOG (AT-783).

- Regressivo por funcionalidade (AT-769, B6): a regra do card entra no CLAUDE.md e o `analista.md` ganha o item do catálogo (`brabo-qa/funcionalidades.yml`). Este repo não tem gatilho do `brabo-qa` ainda: a PR do runner recebe `neutral` até existir a spec de `runner`.
- Vínculos nos runs (AT-773, B5): o `build-runner-binaries.yml` ganha `run-name` (`binários do runner {tag} ← tag do carimbo` na tag; `(ensaio)` no dispatch). O `publish-runner.yml` saiu antes (AT-774), então não há o `publish` do runner para ligar.

- CI: repina os reutilizáveis do `brabo-ci` em `13f3697` (merge da ci#17, que inclui a ci#16): `ubuntu-26.04`, `client-id` no lugar de `app-id`, rótulo de família criado antes de aplicar, linha `Carimbo:` na tag e helper `vinculos` (AT-772, AT-773).
- O runner passa a sair só como binário da Release: o `publish-runner.yml` (publicação no npmjs) foi removido e `npm install -g @brabo/runner` sai do README, do CLAUDE.md e dos avisos de terceiros; não há plano B por npm (AT-774).

- CI: todo `runs-on` fixa `ubuntu-26.04` no lugar de `ubuntu-latest`, e o `create-github-app-token` usa `client-id` no lugar do `app-id` obsoleto; os runs saem sem anotação de aviso (AT-772).

- Ko-fi do mantenedor: `.github/FUNDING.yml` (botão Sponsor) e seção Apoie no README (AT-768).

- `README.md` reescrito em pt-BR, atual e enxuto (AT-766): links para `viralabs-dev/brabo` e `viralabs-dev/brabo-runner`, instalador e binários nas Releases certas, desenvolvimento pelos scripts deste repo (sem `pnpm --filter`) e a seção "Repositórios do Brabo".
- `docs/business-rules/runner.md` volta a ser em pt-BR, sem `idioma_original` (decisão do dono de 06/11/2026, ADR 0266, que reverte o ADR 0260); as âncoras `{#rn-NNN}` não mudam. A passagem para o inglês da AT-745 (README e `docs/`) fica revertida.
- `politica.yml`: pins do `brabo-ci` sobem para `b030fbf` (dispensa da PR do bot, ADR 0255; AT-733).
- `THIRD_PARTY_NOTICES.md` próprio do runner (AT-727): binário (Bun 1.4.0 e as LGPL ligadas, com oferta escrita), pacotes embutidos e pacote npm; entra no `files` do `package.json` e é conferido por `src/third-party-notices.spec.ts`. Antes era cópia do aviso do produto.
- Release por tag (AT-704): `tag-release.yml` chama o reutilizável do `brabo-ci` (v1.0.0) com o token do GitHub App do bot; `build-runner-binaries.yml` cria a Release da tag e volta a anexar `THIRD_PARTY_NOTICES.md` (oferta de fonte) ao `checksums.txt` assinado.
- `Documentation=` da unit systemd aponta para `viralabs-dev/brabo-runner` (antes `daneiel/brabo/.../apps/runner`; a variável `BRABO_REPO` deixou de existir).

## v1.0.0

- Extraído do monorepo `daneiel/brabo` (AT-699, ADR 0252): `apps/runner/` vai para a raiz, com o histórico, mais `build-runner-binaries.yml` e `publish-runner.yml`.
- `@brabo/docker-port` passa a vir do `brabo-contracts#v1.0.0` (dependência git por tag).
- `build-runner-binaries.yml`: o `checksums.txt` assinado cobre só os binários do runner; `install.sh`, `THIRD_PARTY_NOTICES.md` e os assets `brabo-install-*` entram no manifesto da Release do produto, no `brabo-infra`.
- Saem para o `brabo-infra`, por serem aferições CRUZADAS: `scripts/ci/alvos-do-runner.spec.ts` (matriz × `PLATAFORMAS` da api × `case` do `install.sh`) e `scripts/ci/marca-de-credencial-do-runner.spec.ts` (runner × `credencial_de_git.ex` do engine).
- Sai também o teste `MAPA_DE_PROVIDERS` de `credenciais-locais.spec.ts` (lia `apps/api/src/domain/llm/llm-provider-names.ts`): aferição cruzada runner × api, vai para o `brabo-infra`.
- `scripts/strip-node-modules.mjs`: o Node não tira tipos de `.ts` dentro de `node_modules`, e o `docker-port` chega assim; o hook vale para `pnpm start` e para os specs que sobem o CLI (o `tsup` e o `bun build` embutem o pacote).
- Declarado, não resolvido aqui: o job `checksums` só ANEXA a uma Release existente (criada pelo `release.yml` do produto, ainda no monorepo/`brabo-infra`); `src/servico.ts` ainda cita `apps/runner` no `Documentation=` da unit (AT-691).

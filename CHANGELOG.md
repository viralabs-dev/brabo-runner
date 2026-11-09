# Changelog

## Unreleased

- CI: repina o brabo-ci na release final `v1.4.0` (`5320046`), para a promoção `dev → main` de 09/11/2026 (a `main` só aceita release final).

- Doc (AT-871): cada RN das partes `docs/business-rules/runner/parte-NN.md` ganha uma âncora `<a id="rn-NNN"></a>`, para o link `#rn-NNN` abrir a RN também no GitHub. Só acréscimo de linhas; o site não muda.
- Doc (AT-868): os 96 links das páginas de RN que apontavam para docs de outro repo (`../adr/…`, `api.md`) viram URL do arquivo no GitHub do repo dono, na `dev`. No site continuam relativos.
- Docs (AT-873): a tabela "Onde se encaixa" do README linka cada repo no GitHub (o do próprio README fica sem link), gerada pelo `mapa-dos-repos.ts` do brabo-ci repinado em `a571e82` (`v1.4.0-dev.28`, ci#63).

- Doc (AT-862, ADR 0287): a página de RN `docs/business-rules/runner.md` vira índice mais duas partes (`docs/business-rules/runner/parte-01.md`, desde RN-423, e `parte-02.md`, desde RN-550), com a grade `#rn-NNN` congelada: as 19 âncoras e os links antigos seguem valendo. A RN nova entra na última parte.

- Doc (AT-867): a linha de badges logo abaixo do título separa o CI (`ci.yml`) e a versão da `dev` (última tag `-dev`) e da `main` (release final), e mantém licença, documentação e Ko-fi.

- CI (AT-853): o `ci.yml` do job `runner` ganha `build:bin` e `smoke:bin` (linux-x64, `--self-test-pty`) na PR, com `oven-sh/setup-bun` pinado por SHA e Bun 1.4.0, para provar o binário publicável e não só o `dist`. O runner não tem regressivo do brabo-qa: a PR se atesta pelo próprio CI, e o contrato runner ↔ engine só é provado no TP-01 (decisão do dono, 08/11/2026).
- Doc (AT-848): o bloco "Onde se encaixa" do README é regenerado do `repos.yml` do brabo com o formato `{arquivo, trecho}` e a aresta `brabo → brabo-contracts` (brabo#84); o check `mapa-alinhado` volta a passar.
- CI (AT-848): todos os `uses:` e `ci_ref` repinam em `6390ef5` (`v1.4.0-dev.17`, brabo-ci#53), que aceita a prova `{arquivo, trecho}` do `mapa-dos-repos.ts`.
- Docs (AT-826): o `README.md` segue o esqueleto de 8 seções do `brabo-ci` (`README.modelo.md`), com o bloco do mapa dos repos e até 150 linhas. O manual completo (instalação, flags, agente de máquina, chave de dispositivo, serviço, reconexão, macOS e segurança) desce, sem corte, para `docs/how-to/usar-o-runner.md`. O `ci.yml` ganha os checks informativos `readme-esqueleto` e `mapa-alinhado`, e todos os `uses:` e `ci_ref` do `brabo-ci` sobem para `b5df60b` (`v1.4.0-dev.14`).

- CI: o check `Dependências de merge` (AT-787) entra pelo `dependencias.yml`, que chama o reutilizável `dependencias-de-merge.yml` do `brabo-ci` pinado em `c6d9394` (`v1.4.0-dev.10`). A PR declara `Depende-de: viralabs-dev/<repo>#<n>` no corpo e o check fica amarelo (`esperando …`) até cada PR citada estar mergeada. Sem linha `Depende-de` o check fica verde ("Sem dependências declaradas"). Não é exigido por ruleset ainda.

- CI: o `ci.yml` chama o reutilizável `cadeia.yml` do `brabo-ci` (actionlint e pins, `ci_ref` obrigatório, AT-819) e repina todos os `uses:` e `ci_ref` em `0a9eba8` (`v1.4.0-dev.5`, brabo-ci#39). Como o `cadeia` não repete os `-ignore` locais, o `build-runner-binaries.yml` agrupa as redireções para `$GITHUB_OUTPUT` (SC2129) e ganha `shellcheck disable=SC2012` justificado no `ls` do binário.

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

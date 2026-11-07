# Changelog

## Unreleased

- CI: repina os reutilizáveis do `brabo-ci` em `f2d99e4` (merge da ci#16): `ubuntu-26.04`, `client-id` no lugar de `app-id`, rótulo de família criado antes de aplicar, linha `Carimbo:` na tag e helper `vinculos` (AT-772, AT-773).
- CI: todo `runs-on` fixa `ubuntu-26.04` no lugar de `ubuntu-latest`, e o `create-github-app-token` usa `client-id` no lugar do `app-id` obsoleto; os runs saem sem anotação de aviso (AT-772).

- Ko-fi do mantenedor: `.github/FUNDING.yml` (botão Sponsor) e seção Apoie no README (AT-768).

- `README.md` reescrito em pt-BR, atual e enxuto (AT-766): links para `viralabs-dev/brabo` e `viralabs-dev/brabo-runner`, instalador e binários nas Releases certas, desenvolvimento pelos scripts deste repo (sem `pnpm --filter`) e a seção "Repositórios do Brabo".
- `docs/business-rules/runner.md` volta a ser em pt-BR, sem `idioma_original` (decisão do dono de 06/11/2026, que reverte o ADR 0260); as âncoras `{#rn-NNN}` não mudam. A passagem para o inglês da AT-745 (README e `docs/`) fica revertida.
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

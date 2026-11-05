# Changelog

## v1.0.0

- Extraído do monorepo `daneiel/brabo` (AT-699, ADR 0252): `apps/runner/` vai para a raiz, com o histórico, mais `build-runner-binaries.yml` e `publish-runner.yml`.
- `@brabo/docker-port` passa a vir do `brabo-contracts#v1.0.0` (dependência git por tag).
- `build-runner-binaries.yml`: o `checksums.txt` assinado cobre só os binários do runner; `install.sh`, `THIRD_PARTY_NOTICES.md` e os assets `brabo-install-*` entram no manifesto da Release do produto, no `brabo-infra`.
- Saem para o `brabo-infra`, por serem aferições CRUZADAS: `scripts/ci/alvos-do-runner.spec.ts` (matriz × `PLATAFORMAS` da api × `case` do `install.sh`) e `scripts/ci/marca-de-credencial-do-runner.spec.ts` (runner × `credencial_de_git.ex` do engine).
- Declarado, não resolvido aqui: o job `checksums` só ANEXA a uma Release existente (criada pelo `release.yml` do produto, ainda no monorepo/`brabo-infra`); `src/servico.ts` ainda cita `apps/runner` no `Documentation=` da unit (AT-691).

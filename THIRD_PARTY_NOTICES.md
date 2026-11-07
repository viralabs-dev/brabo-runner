# Avisos de terceiros do brabo-runner

O brabo-runner é [MIT](LICENSE). Este documento cobre o software de terceiros
que **viaja junto** com ele, na única forma de distribuição: o **binário
standalone** (anexado à Release, com o runtime Bun dentro).

Levantado em **2026-11-05**, contra o `pnpm-lock.yaml` e o `BUN_VERSION` do
`build-runner-binaries.yml`.

## 1. O binário standalone

O binário é gerado por `bun build --compile` e contém o runtime **Bun 1.4.0**
(`BUN_VERSION` em `.github/workflows/build-runner-binaries.yml`).

| componente | versão | licença | observação |
|---|---|---|---|
| Bun | 1.4.0 | MIT | runtime embutido no executável |
| JavaScriptCore / WebKit | o do Bun 1.4.0 | **LGPL-2** | ligado estaticamente pelo Bun |
| tinycc | o do Bun 1.4.0 | **LGPL-2.1** | ligado estaticamente pelo Bun |
| demais bibliotecas ligadas | o do Bun 1.4.0 | MIT, BSD, Apache e outras | lista completa no `LICENSE.md` do Bun |

A lista completa e as licenças de cada biblioteca ligada estão no
[`LICENSE.md` da tag `bun-v1.4.0`](https://github.com/oven-sh/bun/blob/bun-v1.4.0/LICENSE.md).
Este repositório não as reproduz: a fonte é o upstream, na versão exata acima.

### Oferta escrita (LGPL)

JavaScriptCore (LGPL-2) e tinycc (LGPL-2.1) são ligados estaticamente ao Bun, e
o Bun ao binário do runner. Não modificamos nenhuma dessas bibliotecas. Quem
recebe o binário pode obter o código-fonte correspondente, e o que é preciso
para religar o Bun com alterações, nestes endereços:

- Fonte do Bun 1.4.0: <https://github.com/oven-sh/bun/tree/bun-v1.4.0>
- WebKit/JavaScriptCore usado pelo Bun (fork com patches): <https://github.com/oven-sh/WebKit>
- Instruções do upstream para religar: seção "JavaScriptCore" do
  [`LICENSE.md`](https://github.com/oven-sh/bun/blob/bun-v1.4.0/LICENSE.md)

Este arquivo é anexado à Release ao lado dos binários e coberto pelo mesmo
`checksums.txt` assinado, para que a oferta acompanhe a cópia recebida.

> **TODO(humano):** esta seção descreve o que o repositório FAZ. Não é parecer
> jurídico, e a validação de que a oferta escrita basta para a LGPL ligada
> estaticamente segue sendo do mantenedor.

## 2. Pacotes embutidos no binário

Todos MIT. O texto da licença está na seção 3.

| pacote | versão | copyright | no binário |
|---|---|---|---|
| jose | 6.2.4 | Filip Skokan (2018) | sim |
| node-pty | 1.1.0 | Christopher Jeffrey (2012-2015) e colaboradores | sim (binding nativo) |
| node-addon-api | 7.1.1 | Node.js API collaborators (2017) | sim (transitiva do node-pty) |
| phoenix | 1.8.9 | Chris McCord (2014) | sim (carregado por `import()`) |
| @brabo/docker-port | 1.2.0 (`@viralabs-dev/brabo-docker-port`, `brabo-contracts` v1.2.0) | Daniel Souza (2026), MIT do próprio Brabo | sim |

## 3. Texto da licença MIT

Vale para cada pacote da seção 2, com o copyright da tabela.

```
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Como este arquivo é conferido

`src/third-party-notices.spec.ts` reprova quando a versão do Bun do workflow ou
a de um pacote da seção 2 diverge do `pnpm-lock.yaml`, quando este arquivo sai
do `files` do `package.json` e quando a lista de pacotes vem vazia.

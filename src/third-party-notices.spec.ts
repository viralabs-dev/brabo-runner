import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raiz = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const notices = raiz('THIRD_PARTY_NOTICES.md');
const lock = raiz('pnpm-lock.yaml');
const workflow = raiz('.github/workflows/build-runner-binaries.yml');
const pkg = JSON.parse(raiz('package.json')) as { files: string[] };

/** Linhas `| nome | versão |` da seção 2 (a tabela dos pacotes embutidos). */
export function pacotesEmbutidos(texto: string): Array<[string, string]> {
  const secao = texto.split('## 2.')[1]?.split('\n## ')[0] ?? '';
  return [...secao.matchAll(/^\| ([@\w./-]+) \| (\d+\.\d+\.\d+)/gm)].map((m) => [m[1]!, m[2]!]);
}

describe('THIRD_PARTY_NOTICES.md do runner', () => {
  it('cita o BUN_VERSION do workflow', () => {
    const bun = /BUN_VERSION: '([\d.]+)'/.exec(workflow)?.[1];
    expect(bun).toBeTruthy();
    expect(notices).toContain(`Bun ${bun}`);
    expect(notices).toContain(`bun-v${bun}`);
  });

  it('lista cada pacote embutido com a versão do lockfile', () => {
    const lista = pacotesEmbutidos(notices);
    // lista vazia seria instrumento cego
    expect(lista.length).toBeGreaterThanOrEqual(5);
    for (const [nome, versao] of lista) {
      // @brabo/docker-port vem por alias (@viralabs-dev/brabo-docker-port): o lockfile o guarda com outro nome
      if (nome === '@brabo/docker-port') continue;
      expect(lock, `${nome}@${versao}`).toContain(`${nome}@${versao}:`);
    }
  });

  it('viaja no pacote npm (files)', () => {
    expect(pkg.files).toContain('THIRD_PARTY_NOTICES.md');
  });

  it('não herda texto do produto', () => {
    expect(notices).not.toMatch(/semgrep|hadolint|Space Grotesk|Elixir/);
  });
});

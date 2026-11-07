import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wf = readFileSync(new URL('../.github/workflows/build-runner-binaries.yml', import.meta.url), 'utf8');

describe('release do runner (AT-794)', () => {
  it('a Release nasce rascunho', () => {
    expect(wf).toMatch(/gh release create "\$TAG" --draft /);
  });

  it('ALVOS_ESPERADOS é a matriz de build', () => {
    const matriz = [...wf.matchAll(/^\s+- target: (\S+)/gm)].map((m) => m[1]).sort();
    const esperados = /ALVOS_ESPERADOS: '([^']+)'/.exec(wf)?.[1]?.split(' ').sort();
    expect(esperados).toEqual(matriz);
  });

  it('só publica depois de reprovar a falta de binário', () => {
    const reprova = wf.indexOf('NÃO foi publicada');
    const publica = wf.indexOf('gh release edit "$TAG" --draft=false');
    expect(reprova).toBeGreaterThan(0);
    expect(publica).toBeGreaterThan(reprova);
  });
});

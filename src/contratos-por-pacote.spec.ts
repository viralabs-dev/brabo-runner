import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raiz = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pkg = JSON.parse(raiz('package.json')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('contracts por pacote (AT-770, RN-1040)', () => {
  it('o runner não declara @viralabs-dev/* em dependencies (o pacote não pede token a quem instala)', () => {
    const nomes = Object.entries(pkg.dependencies).flatMap(([nome, alvo]) => [nome, alvo]);
    expect(nomes.filter((n) => n.includes('@viralabs-dev/') || n === '@brabo/docker-port')).toEqual([]);
  });

  it('o docker-port é devDependency por alias, na versão exata (sem ^)', () => {
    expect(pkg.devDependencies['@brabo/docker-port']).toMatch(/^npm:@viralabs-dev\/brabo-docker-port@\d+\.\d+\.\d+(-dev\.\d+)?$/);
  });

  it('o .npmrc do repo só aponta o registry do escopo, sem token', () => {
    expect(raiz('.npmrc').trim()).toBe('@viralabs-dev:registry=https://npm.pkg.github.com');
  });
});

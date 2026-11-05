// O Node recusa tirar os tipos de `.ts` dentro de node_modules (type stripping),
// e `@brabo/docker-port` chega do brabo-contracts como fonte .ts. Este hook faz
// o que o Node não faz, só para `start` e para os specs que sobem o CLI;
// o `tsup` e o `bun build` já embutem o pacote.
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  load(url, contexto, proximo) {
    if (url.startsWith('file:') && url.includes('/node_modules/') && url.endsWith('.ts')) {
      const fonte = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'strip' });
      return { format: 'module', source: fonte, shortCircuit: true };
    }
    return proximo(url, contexto);
  },
});

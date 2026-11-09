---
id: rn-runner
title: 'Regras de negócio — Runner'
sidebar_label: Runner
description: 'As RNs hospedadas na raiz runner.'
keywords: [regras de negócio, runner]
---

# Runner

Esta página é o índice das regras de negócio da área `runner`. As RNs moram em partes (`runner/parte-NN.md`), cortadas por faixa para a página abrir leve; a RN nova entra na ÚLTIMA parte (ADR 0287).

| Parte | Desde | RNs | Seções |
|---|---|---|---|
| [parte 1](runner/parte-01.md) | RN-423 | 13 | Onda 1 do ADR 0104 — `execution_mode` em três valores, workspace verificado pelo runner; Terminal do runner local preso em "Abrindo terminal..." para sempre (RN-433); O explorador de pasta do Runner vira três colunas, e a criação de um projeto `runner` deixa de esperar o passo final (RN-436/436); Configuração do runner pelo navegador (RN-464..466, ADR 0118); O artefato de decisão dos conversacionais (RN-505); O espelho copia o trabalho para a pasta do usuário (RN-516); O agente local vira serviço de USUÁRIO, e `status` não colapsa estado (RN-518); A flag que liga um agente tem de CHEGAR ao processo (RN-540); A base do agente local ganha um consumidor: a pasta do projeto nasce pelo canal (RN-532); O agente local abre N conexões, uma por projeto (RN-544, FASE 30); A unit de MÁQUINA, convivendo com as por projeto (RN-545) |
| [parte 2](runner/parte-02.md) | RN-550 | 6 | O agente de máquina espera o primeiro projeto, e a chave nasce no terminal (RN-550/551, FASE 30); A credencial que não atravessa o container do agente local (RN-558); O git credenciado roda no host do runner (RN-676); A Anamnese religada: sujeito elegível e fato do perfil (RN-680); AT-770 — o brabo-contracts chega por pacote do GitHub Packages |

A grade abaixo preserva as âncoras antigas (`#rn-NNN`): cada número leva à parte onde a RN mora.

<a id="rn-423"></a>[423](runner/parte-01.md#rn-423) <a id="rn-429"></a>[429](runner/parte-01.md#rn-429) <a id="rn-434"></a>[434](runner/parte-01.md#rn-434) <a id="rn-435"></a>[435](runner/parte-01.md#rn-435) <a id="rn-452"></a>[452](runner/parte-01.md#rn-452) <a id="rn-466"></a>[466](runner/parte-01.md#rn-466) <a id="rn-507"></a>[507](runner/parte-01.md#rn-507) <a id="rn-516"></a>[516](runner/parte-01.md#rn-516) <a id="rn-518"></a>[518](runner/parte-01.md#rn-518) <a id="rn-529"></a>[529](runner/parte-01.md#rn-529)
<a id="rn-532"></a>[532](runner/parte-01.md#rn-532) <a id="rn-544"></a>[544](runner/parte-01.md#rn-544) <a id="rn-545"></a>[545](runner/parte-01.md#rn-545) <a id="rn-550"></a>[550](runner/parte-02.md#rn-550) <a id="rn-551"></a>[551](runner/parte-02.md#rn-551) <a id="rn-558"></a>[558](runner/parte-02.md#rn-558) <a id="rn-676"></a>[676](runner/parte-02.md#rn-676) <a id="rn-688"></a>[688](runner/parte-02.md#rn-688) <a id="rn-1040"></a>[1040](runner/parte-02.md#rn-1040)

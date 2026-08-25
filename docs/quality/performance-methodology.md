# Metodologia de coleta de performance

## Objetivo e limite

Este documento descreve o harness da Fase 5 para uma jornada Android do RunFlow. Ele coleta
somente dados da execução explicitamente solicitada em um dispositivo já conectado por ADB;
não cria ou inicializa AVD, não abre perfis pessoais e não usa banco, GPX, FIT, foto ou
relatório real. Os testes unitários usam apenas fixtures sintéticas.

A implementação cobre:

- `am start -W`: `TotalTime` e `WaitTime` obrigatórios; `ThisTime` é registrado quando o Android o fornece;
- `dumpsys meminfo`: PSS, private dirty, Graphics do processo do app e PSS do renderer WebView;
- `dumpsys gfxinfo` e `framestats`: contagem de frames, jank, percentis disponíveis e FrameTimeline;
- `dumpsys activity exit-info` e um resumo não sensível de `logcat`;
- CDP do WebView: heap após `HeapProfiler.collectGarbage`, DOM, listeners e métricas de
  LCP/INP/CLS/Long Tasks;
- trace Perfetto limitado a 10 segundos, conforme `perfetto-config.pbtxt`. No Android 37, o
  config é enviado a `/data/local/tmp` e lido pelo shell via stdin; o trace é escrito em
  `/data/misc/perfetto-traces` por causa da política de acesso do serviço.

O harness não transforma ausência de uma métrica em zero. `ThisTime` é opcional porque o Android 37 pode omiti-lo no output de `am start -W`; nesse caso o relatório usa `status: "not_executed"` e não deriva um valor a partir de `TotalTime` ou `WaitTime`. Uma coleta que não produziu um campo obrigatório falha fechada.

No `dumpsys meminfo` do Android 37, `Private Dirty` também pode aparecer somente na tabela tabular `TOTAL`, sem um rótulo `TOTAL PRIVATE DIRTY:`. O parser usa a coluna `Private Dirty` da linha `TOTAL` (e não PSS/RSS), e a ausência das formas suportadas mantém `appPrivateDirtyKb` ausente para que a coleta falhe fechada; nenhum zero ou estimativa é derivado.

## Estados e contrato

Cada métrica é um objeto com o formato mínimo:

```json
{
  "status": "collected",
  "value": 123,
  "unit": "ms",
  "source": "adb.am.start.-W"
}
```

Quando uma etapa foi deliberadamente ou tecnicamente não executada, o campo fica explícito,
sem `value`:

```json
{
  "status": "not_executed",
  "reason": "CDP endpoint was not configured"
}
```

`collected` significa que o comando correspondente retornou um valor que passou pela
validação do coletor. `not_executed` não é uma medição e nunca deve ser apresentado como
zero, sucesso ou baseline.

`analyze-results.mjs` exige que o documento tenha `status: "collected"` e um bloco `collectors` com `adb`, `cdp` e `perfetto` também em `collected`; rejeita qualquer collector explicitamente `not_executed` ou ausente e exige, para cada execução, os campos obrigatórios de startup (`TotalTime` e `WaitTime`), memória Android,
renderer WebView, gfxinfo, FrameTimeline, exit-info, logcat, trace Perfetto e todas as
métricas CDP. A evidência `perfetto.trace` precisa estar `collected` e conter um caminho não vazio; o analisador não inventa nem deriva conteúdo do trace. `startup.thisTimeMs` é validado quando presente, mas pode permanecer `not_executed` com uma limitação explícita. Também exige exatamente `expectedRuns` execuções.
Se houver campo obrigatório ausente, `status` diferente de `collected`, collector ausente/não executado ou menos execuções
do que o solicitado, o processo termina com código diferente de zero e não grava uma análise
verificada.

A análise produz somente agregados P50/P95/P99 para métricas numéricas. O percentil usa
rank mais próximo sobre os valores coletados; isso é determinístico e deve ser mantido ao
comparar execuções. Objetos como `gfxinfo`, `exitInfo`, `logcat`, `longTasks` e o caminho do
trace são contabilizados, não convertidos artificialmente em percentis.

## Identidade do WebView

Antes de abrir CDP, o coletor lê `ps -A -o PID,NAME,ARGS` e exige que:

1. o processo do app seja único e tenha exatamente o package esperado;
2. o PID informado (ou o único candidato automático) exista nessa tabela;
3. o nome do processo comece por `<package>:` e contenha `renderer`, `webview` ou
   `sandboxed_process`;
4. o PID do renderer usado para PSS seja o mesmo PID validado para esse processo;
5. o forward CDP use o socket `webview_devtools_remote_<PID>` do processo principal do
   app. No Android 37, esse PID pode ser diferente do renderer isolado; o renderer continua
   sendo validado por ownership do package antes de qualquer métrica ser atribuída.

Um PID do processo principal usado como renderer, um PID inexistente ou mais de um renderer
sem seleção explícita interrompe a coleta. Isso evita atribuir PSS/heap/DOM/CWV ao processo
errado.

O endpoint CDP deve ser local (`127.0.0.1`, `localhost` ou loopback IPv6). O runner cria e
remove o forward TCP durante a coleta quando `--cdp-endpoint` é usado; não aceita endpoint
remoto.

## Como executar sem alegar resultado não coletado

A validação de argumentos e do fluxo, sem ADB, é possível com o dry-run:

```bash
node scripts/perf/run-journey.mjs \
  --dry-run \
  --output .hermes/artifacts/runflow-perf-dry-run.json
```

Esse arquivo terá `status: "not_executed"`, uma lista `runs` vazia e não conterá tempos ou
métricas inventados. Ele não é entrada válida para `analyze-results.mjs`.

Uma coleta real usa um ADB já conectado. A ferramenta não inicia AVD; se a matriz exigir
um AVD, ele deve ser iniciado manualmente, visível e com o estado registrado separadamente.
No Windows, quando `adb.exe` não estiver no `PATH`, informe o caminho absoluto com `--adb`.
Exemplo de uma coleta completa (o caminho de saída deve ser descartável e não conter
segredos):

```bash
node scripts/perf/run-journey.mjs \
  --serial emulator-5554 \
  --journey startup \
  --package com.runflow.app \
  --activity com.runflow.app/.MainActivity \
  --runs 20 \
  --cdp-endpoint http://127.0.0.1:9222 \
  --perfetto-config scripts/perf/perfetto-config.pbtxt \
  --perfetto-output .hermes/artifacts/runflow-perf/startup.pftrace \
  --output .hermes/artifacts/runflow-perf/startup-results.json
```

Se CDP ou Perfetto não forem configurados, o runner registra `not_executed`; ele não deve
ser usado para uma análise final. Se um comando ADB, o PID ou uma métrica obrigatória
falhar, o runner retorna código diferente de zero. A remoção do forward CDP é tentada em
`finally` e uma falha de cleanup não esconde a falha de coleta.

Depois de uma coleta completa:

```bash
node scripts/perf/analyze-results.mjs \
  --input .hermes/artifacts/runflow-perf/startup-results.json \
  --output .hermes/artifacts/runflow-perf/startup-analysis.json
```

Só um arquivo com `status: "verified"` produzido pelo analisador pode sustentar os
agregados da jornada. O analisador não lê dados de um dispositivo e não preenche lacunas.

## Fontes e disponibilidade

Nesta continuação houve coleta ADB real, mas somente como smoke serial em API 37. Os
artefatos estão em `.hermes/artifacts/runflow-perf/api37-4gb-smoke/`,
`.hermes/artifacts/runflow-perf/api37-8gb-smoke/` e no resumo
`.hermes/artifacts/runflow-perf/memory-matrix-smoke.json`. Eles comprovam instalação,
launch, PSS do processo principal/renderer e ausência de fatal/ANR no recorte observado;
não comprovam 20 runs, percentis ou baseline físico.

| Métrica | Fonte | Disponibilidade nesta entrega |
| --- | --- | --- |
| Startup | `adb shell am start -W -n ...` | Smoke COLD real em API37_4GB/API37_8GB; sem significância estatística |
| PSS/private dirty/Graphics | `adb shell dumpsys meminfo <pid>` | Smoke real dos processos principais; 4/8 GB, não baseline |
| PSS do renderer | `dumpsys meminfo <renderer-pid>` | Smoke real com ownership WebView validado nos dois AVDs |
| FrameTimeline/gfxinfo | `adb shell dumpsys gfxinfo <package> [framestats]` | Coletor implementado; não há matriz formal persistida nesta continuação |
| Exit-info/logcat | `dumpsys activity exit-info` e resumo de `logcat` | Smoke capturado; sem fatal/ANR no recorte, não prova ausência em 20 runs |
| Heap/DOM/listeners/CWV | CDP local do WebView | Smoke real em API 37: LCP/CLS/Long Tasks coletados; INP `not_executed` sem interação legítima |
| Perfetto | `perfetto-config.pbtxt` por 10 s | Smoke real produzido e validado por bytes; ainda não analisado/correlacionado |
| P50/P95/P99 | `analyze-results.mjs` | Não publicados: a matriz atual é smoke-only e o analyzer segue fail-closed |

Os testes não dependem de ADB, CDP, WebSocket ou Perfetto disponíveis. Eles passam dados
sintéticos por funções injetáveis e verificam, entre outros casos, PID WebView errado,
métrica ausente, collectors `not_executed`, `ThisTime` ausente/opcional, Private Dirty na
linha `TOTAL`, trace Perfetto não coletado ou sem caminho de evidência e número incompleto de
runs.

## Execução Macrobenchmark em AVD

O módulo Macrobenchmark usa `androidx.benchmark.suppressErrors=EMULATOR` somente para
permitir a execução técnica no `Pixel_8`/API 37 disponível localmente. Esse parâmetro
suprime apenas o erro de pré-condição do framework que identifica o ambiente como
emulador; não converte resultados em uma medição equivalente a hardware físico e não
suprime falhas de jornadas, crashes ou métricas ausentes. Qualquer relatório produzido
nessa condição deve ser rotulado `emulator-only` e não pode servir como baseline de
4 GB/8 GB ou de dispositivo físico.

A instalação do APK de teste também exige assinatura debug local e o build type do
módulo declara fallback para variantes `release` das dependências Capacitor. A ausência
de qualquer uma dessas condições falha antes da jornada, com erro explícito, em vez de
ser tratada como benchmark executado.

## Fase 5.7 e limitações atuais

A coleta smoke de memória 4 GB/8 GB foi executada serialmente, e um smoke CDP/Perfetto real
foi produzido no API 37; os 20 startups, INP derivado de uma interação legítima, scroll de
1.000 itens, ciclos de mapa/Flyover, análise correlacionada do Perfetto e validação API 33–37
ainda não foram concluídos. Portanto, não há baseline, P50/P95/P99, jank ou equivalência com
hardware físico publicados. O connected Macrobenchmark também permanece pendente até existir
provisionamento explícito das fixtures no alvo benchmark. Um relatório de baseline só pode
ser publicado depois de executar a matriz com as mesmas fixtures sintéticas, hardware/AVD,
versão do WebView e número de iterações, e guardar os traces fora do código-fonte.

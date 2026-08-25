# RunFlow Macrobenchmark

Este módulo é um harness de Macrobenchmark Android. A auditoria local é estática e não
executa testes `connected`, não inicia AVD e não coleta métricas de dispositivo.

## Contrato do harness

- O alvo instalado é a variante `benchmark` do app, com pacote
  `com.runflow.app.benchmark`; o APK de teste é o módulo `macrobenchmark`.
- `StartupBenchmark` cobre exclusivamente `StartupMode.COLD`, `StartupMode.WARM` e
  `StartupMode.HOT`. O `measureRepeated` de startup mantém
  `startupMode = startupMode` e não usa `setupBlock`/`pressHome()`.
- As jornadas não-startup (scroll, detalhe, mapa, heatmap, Flyover e rotação/background)
  usam `setupBlock = { pressHome() }` porque não declaram `StartupMode`. Elas compartilham
  `DEFAULT_ITERATIONS = 20` e `FrameTimingMetric`.
- Startup gera `StartupTimingMetric` e `FrameTimingMetric`. Os marcadores
  `RunFlowBenchmark.synthetic.<journey>.start/end` identificam cada janela de jornada no
  trace; os valores das métricas são gerados pelo AndroidX Macrobenchmark, nunca escritos
  manualmente pelo harness.
- `androidx.benchmark.suppressErrors=EMULATOR` é o único override do runner. Ele libera
  somente a pré-condição do framework para execução em emulador; não suprime falhas de
  jornada, crashes ou métricas ausentes.

## Fixture sintética e limites atuais

Os nomes `Benchmark Activity 0001` … `Benchmark Activity 1000` e `Benchmark Flyover 50000`
são metadados determinísticos do harness. O módulo não lê perfil, banco, GPX/FIT ou dados pessoais e não grava esses
metadados no armazenamento do app. Cada jornada dependente de atividade falha fechada se
a primeira atividade sintética não estiver visível; o scroll também exige a última fixture
após a rolagem.

Portanto, a implementação atual ainda precisa de um mecanismo explícito para provisionar
essas fixtures no alvo `com.runflow.app.benchmark` antes de qualquer execução conectada.
Sem esse provisionamento, não há benchmark válido de 1.000 atividades ou 50.000 pontos;
o estado é uma pendência, não um resultado.

## Evidência e baseline

Este módulo não declara baseline físico, equivalência com hardware físico, P50/P95/P99,
PSS, jank ou qualquer métrica coletada. `suppressErrors=EMULATOR` não transforma uma
execução em emulador em baseline físico. Qualquer relatório futuro deve identificar
explicitamente o ambiente (`emulator-only` ou dispositivo físico), a variante, a fixture,
o número de iterações e a origem dos dados.

Para validação local sem dispositivo, use somente tarefas não conectadas, por exemplo:

```bash
cd android
./gradlew :app:assembleBenchmark :macrobenchmark:assembleBenchmark :macrobenchmark:compileBenchmarkKotlin --console=plain
```

Não use `connectedBenchmark` neste gate estático.

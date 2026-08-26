# RunFlow — Correção Integral das Pendências da Auditoria Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** corrigir todos os bloqueadores confirmados na auditoria da revisão `88ec3e5`, restaurar integridade funcional e entregar evidências reproduzíveis de persistência, histórico completo, responsividade, performance, memória e compatibilidade Android 13–17.

**Architecture:** executar em fatias verticais TDD, começando pelos riscos de perda de dados e regressões analíticas. A listagem permanece paginada e leve, enquanto estatísticas consomem somente resumos completos; heatmap passa a processar detalhes em lotes sem reter atividades completas. Playwright valida o conteúdo web, e o APK Capacitor é validado separadamente com UiAutomator/ADB, Macrobenchmark, CDP e Perfetto.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, IndexedDB/idb 8, Vitest 4, fake-indexeddb 6, Playwright, `@tanstack/react-virtual`, Capacitor 7, Java 21, Gradle 8.13, AGP 8.13.2, Android APIs 33–37, UiAutomator, Macrobenchmark, ADB, Perfetto e Chrome DevTools Protocol.

---

## 1. Limite atual e regras de execução

- Repositório: `E:\projetos\runflow-app`.
- Baseline funcional: `88ec3e5f1e6a04a89625e6a7c87d0e67a924306d` em `main`, alinhado com `origin/main` durante a criação deste plano.
- Estado não rastreado preservado: `IDEA.md`; não editar, adicionar, apagar ou incluir em commit.
- Plano anterior, agora histórico: `.hermes/plans/2026-08-24_081718-runflow-pendencias-e2e-performance-android-13-17.md`.
- Este plano substitui somente as pendências/remediações daquele documento; não reimplementar o que já está correto.
- Usar apenas fixtures sintéticas. Nunca abrir banco, perfil, GPX/FIT, fotos ou relatórios pessoais reais.
- AVDs devem ser iniciados com janela visível; não usar `-no-window`.
- Antes de cada tarefa: revalidar `git status`, preservar mudanças alheias e confirmar o arquivo alvo.
- Para toda mudança comportamental: RED → confirmar falha correta → GREEN mínimo → suíte focada → regressão relevante.
- Antes de cada commit: revisão de conformidade e revisão de qualidade independentes.
- Após cada tarefa verde: commit convencional, push conforme política do repositório e verificação de SHA remoto.
- Não atualizar snapshots, ROADMAP ou alegações de performance antes dos respectivos gates executados.

## 2. Critérios globais de aceite

O projeto só poderá voltar a declarar a Fase 4 concluída quando:

1. migrações v5/v6→v7 abortarem integralmente em qualquer registro inválido e preservarem o legado após falha;
2. `ActivitySummary` não contiver `structuredWorkoutReport`, enquanto `ActivityDetail` preservar relatório, notas, pontos e identificadores;
3. backup, restore e sync produzirem o mesmo contrato normalizado antes/depois do split;
4. listagem usar cursor composto sem revarredura desde o início e sem duplicação/omissão;
5. estatísticas, contagem e PRs cobrirem todo o histórico, independentemente das páginas visíveis;
6. virtualização suportar altura variável, fonte 200% e 1.000 registros com DOM limitado;
7. heatmap não carregar `StoredActivity[]` completo nem acumular trackpoints brutos;
8. matriz Playwright e screenshots APK cobrirem viewports, fontes, temas, IME, modais, mapas e HUDs;
9. benchmarks registrarem startup, frame timing, PSS, heap, WebView, jank e ciclos WebGL/mapas em 4/8 GB;
10. `minSdk=33`, `compileSdk=37` e `targetSdk=37` forem comprovados no APK 0.9.6 ou versão posterior;
11. LAN, BLE, locale, áudio e Predictive Back forem validados nos limites API 33/API 37;
12. APK, package lock, Android version e documentação estiverem sincronizados;
13. gates locais/CI falharem de verdade diante de regressões;
14. SHA local e remoto coincidirem e o worktree rastreado estiver limpo.

---

# Fase 0 — Baseline, versão e gates honestos

### Task 0.1: Sincronizar versão e baseline reproduzível

**Objective:** remover a inconsistência 0.9.5/0.9.6 e registrar ambiente exato sem alegações não executadas.

**Files:**
- Modify: `package-lock.json:1-10`
- Modify: `docs/quality/current-state.md`
- Modify: `.gitignore`
- Test/verify: `package.json`, `android/app/build.gradle`

**Step 1 — RED:** criar `scripts/quality/version-consistency.mjs` que compara `package.json`, root do `package-lock.json`, `packages[""]`, `versionName` e `versionCode`; executar contra o baseline e confirmar falha por `package-lock.json=0.9.5`.

**Step 2 — GREEN:** regenerar somente o lockfile com a versão atual (`npm install --package-lock-only`) e completar `current-state.md` com SHA, Node/npm, Java/JBR, Gradle/AGP, SDKs, AVD/API/RAM e gates ainda não executados.

**Step 3 — Verification:** 
```bash
node scripts/quality/version-consistency.mjs
npm ci
```

**Expected:** script retorna zero; todos os manifestos declaram 0.9.6/versionCode 3; nenhum pacote é atualizado fora do lockfile necessário.

**Commit:** `chore(release): synchronize RunFlow 0.9.6 metadata`

### Task 0.2: Substituir testes Android tautológicos

**Objective:** fazer os testes nativos validarem configuração real.

**Files:**
- Modify: `android/app/src/test/java/com/runflow/app/AppConfigUnitTest.java`
- Modify: `android/app/src/androidTest/java/com/runflow/app/AppContextInstrumentedTest.java`
- Create: `android/app/src/main/java/com/runflow/app/AppBuildContract.java` somente se necessário para evitar parsing frágil de Gradle.

**Step 1 — RED:** exigir package `com.runflow.app`, minSdk 33, versionName correspondente e registro dos plugins `AppLocale`/`LocalNetworkPermission`; confirmar que o teste atual de strings hardcoded não satisfaz o contrato.

**Step 2 — GREEN:** expor somente constantes necessárias ou validar `BuildConfig`/contexto real. Não manter `assertTrue("literal".startsWith(...))`.

**Verification:**
```bash
cd android
./gradlew testDebugUnitTest assembleAndroidTest --console=plain
```

**Expected:** teste local executado e APK instrumentado compilado; ainda não declarar teste instrumentado executado.

**Commit:** `test(android): validate real RunFlow app configuration`

### Task 0.3: Criar gates que falham fechado

**Objective:** impedir scripts que imprimem sucesso sem validar nada.

**Files:**
- Modify: `scripts/android/audit-legacy.mjs`
- Modify: `scripts/perf/bundle-budget.mjs`
- Modify: `package.json`
- Create: `scripts/quality/version-consistency.mjs`
- Create: `scripts/android/audit-legacy.test.ts`
- Create: `scripts/perf/bundle-budget.test.ts`

**Step 1 — RED:** fixtures deliberadamente inválidas devem produzir exit code não zero: permissão legada em manifest mesclado; chunk inicial acima do limite; `out/` ausente; versão divergente.

**Step 2 — GREEN:**
- auditor de legado examina manifests source + merged debug/benchmark/release, não silencia termos globalmente e agrega ocorrências por arquivo;
- bundle gate usa baseline JSON versionado, identifica chunks por rota e falha em regressão >10%; `three` não pode estar no chunk inicial;
- ausência de artefato necessário é erro, não sucesso.

**Scripts esperados:**
```json
{
  "quality:versions": "node scripts/quality/version-consistency.mjs",
  "quality:legacy": "node scripts/android/audit-legacy.mjs",
  "perf:bundle": "node scripts/perf/bundle-budget.mjs"
}
```

**Verification:** unitários das fixtures + execução positiva após build.

**Commit:** `test(quality): make release gates fail closed`

---

# Fase 1 — P0: migração IndexedDB realmente atômica

### Task 1.1: Reproduzir descarte silencioso de pontos

**Objective:** provar o risco de perda antes de alterar a migração.

**Files:**
- Modify: `tests/fixtures/legacyDbV5.ts`
- Modify: `tests/fixtures/legacyDbV6.ts`
- Modify: `src/lib/storage.migration.test.ts`

**Step 1 — RED:** criar v5/v6 com uma atividade válida e outra com `points: "corrompido"`; abrir v7 e exigir rejeição.

**Step 2 — RED adicional:** reabrir o IndexedDB cru e exigir:
- versão ainda anterior a 7;
- store `activities` presente;
- dois registros originais intactos;
- nenhum estado split parcialmente consolidado.

**Verification RED:**
```bash
npm run test -- src/lib/storage.migration.test.ts
```

**Expected:** FAIL porque `src/lib/storage.ts:153` converte pontos inválidos em `[]`.

**Commit:** nenhum antes do GREEN.

### Task 1.2: Fazer validação abortar a versionchange

**Objective:** tornar a migração v7 fail-closed.

**Files:**
- Modify: `src/lib/storage.ts:139-168`
- Test: `src/lib/storage.migration.test.ts`

**Implementation mínima:**
```ts
function assertLegacyActivity(value: unknown): asserts value is StoredActivity {
  if (!value || typeof value !== "object") throw new Error("Invalid legacy activity");
  const activity = value as Partial<StoredActivity>;
  if (!activity.id || !activity.startedAt || !Array.isArray(activity.points)) {
    throw new Error(`Invalid legacy activity: ${activity.id ?? "unknown"}`);
  }
}
```

No cursor, chamar `assertLegacyActivity(cursor.value)`; remover fallback `Array.isArray(...) ? ... : []`; não capturar o erro no callback `upgrade`.

**Verification GREEN:**
```bash
npm run test -- src/lib/storage.migration.test.ts
npm run test -- src/lib/storage.detail.test.ts
```

**Expected:** migração inválida rejeita e preserva legado; migrações válidas continuam passando.

**Commit:** `fix(storage): abort v7 migration on invalid legacy data`

### Task 1.3: Completar matriz de migração e idempotência

**Objective:** cobrir os estados que o teste atual omite.

**Files:**
- Modify: `src/lib/storage.migration.test.ts`
- Modify: `tests/fixtures/activityFactory.ts`

**RED/GREEN cases independentes:**
1. v5 com todos os campos;
2. v6 com summary/track incompleto e full record íntegro;
3. duas aberturas v7 sem duplicação;
4. duas atividades com mesmo `startedAt` preservam IDs;
5. erro após o primeiro registro não deixa split parcial;
6. reabertura após falha permite corrigir fixture e migrar;
7. store legado inexiste após sucesso;
8. store legado permanece após falha;
9. `resetStoreForTesting()` rejeita `onblocked` em vez de fingir exclusão;
10. helper de reset só opera em ambiente de teste.

**Verification:**
```bash
npm run test -- src/lib/storage.migration.test.ts
```

**Commit:** `test(storage): cover interrupted and idempotent v7 upgrades`

### Task 1.4: Remover relatório pesado do summary

**Objective:** concluir o split sem duplicar `structuredWorkoutReport`.

**Files:**
- Modify: `src/lib/types.ts:235-269`
- Modify: `src/lib/storage.ts:27-65,194-238`
- Modify conforme compilador: consumidores que esperam relatório em `ActivitySummary`
- Modify: `src/lib/storage.detail.test.ts`

**Step 1 — RED:** após `putActivity()`, ler diretamente `activitySummaries` e exigir ausência da propriedade; ler `getStoredActivity()` e exigir igualdade profunda do relatório.

**Step 2 — GREEN:**
- remover `structuredWorkoutReport` de `ActivitySummary`;
- declarar o campo em `ActivityDetail`/detail record;
- `toActivitySummary()` escolher campos explicitamente, não usar rest que possa reintroduzir dados pesados;
- remover fallback `summary.structuredWorkoutReport` na leitura.

**Verification:**
```bash
npm run test -- src/lib/storage.detail.test.ts src/lib/storage.migration.test.ts
npx tsc --noEmit
```

**Commit:** `perf(storage): keep structured reports out of summaries`

### Task 1.5: Provar contratos de backup, restore e sync

**Objective:** garantir que o split interno não altera payload externo.

**Files:**
- Create: `src/lib/storage.reconstruction.test.ts`
- Create: `src/lib/backup.test.ts`
- Create: `src/lib/sync/merger.test.ts`
- Modify somente conforme RED: `src/lib/backup.ts`, `src/lib/sync/merger.ts`, `src/lib/sync/webdav.ts`

**RED cases:** all-field round-trip; backup→delete→restore; merge local/remoto; ausência de duplicação; timestamps normalizados; relatório estruturado preservado.

**GREEN:** usar reconstrução explícita em lotes e um normalizador compartilhado. Não acessar store legado.

**Verification:**
```bash
npm run test -- src/lib/storage.reconstruction.test.ts src/lib/backup.test.ts src/lib/sync/merger.test.ts
```

**Commit:** `test(storage): prove split-store backup and sync round trips`

---

# Fase 2 — Histórico completo, paginação eficiente e virtualização

### Task 2.1: Corrigir cursor para usar o índice composto

**Objective:** eliminar revarredura desde o primeiro registro.

**Files:**
- Modify: `src/lib/storage.ts:280-321`
- Modify: `src/lib/storage.pagination.test.ts`

**Step 1 — RED:** instrumentar cursor para provar que a segunda página não percorre os primeiros 50 itens; adicionar lista vazia, 1, 49, 50, 51, datas iguais, cursor removido, limite 0/negativo/acima do máximo.

**Step 2 — GREEN:**
```ts
const range = cursor
  ? IDBKeyRange.upperBound([cursor.startedAt, cursor.id], true)
  : null;
let dbCursor = await index.openCursor(range, "prev");
```

Usar `by-started-id`; aceitar somente inteiro `1..200` e lançar `RangeError` fora do contrato.

**Verification:**
```bash
npm run test -- src/lib/storage.pagination.test.ts
```

**Commit:** `perf(storage): page activities with compound cursor ranges`

### Task 2.2: Serializar `loadMore` e tratar falhas

**Objective:** evitar duas páginas concorrentes e loading preso.

**Files:**
- Modify: `src/hooks/useActivities.ts:42-72`
- Create: `src/hooks/useActivities.test.tsx`
- Modify: `vitest.config.ts` se for necessário ambiente DOM isolado.

**Step 1 — RED:** disparar duas chamadas antes da primeira resolver; exigir uma consulta. Simular rejeição e exigir `loadingMore=false`, erro controlado e retry funcional.

**Step 2 — GREEN:** usar `inFlightRef`, `try/catch/finally`, dedupe por ID e token de refresh para ignorar resposta obsoleta.

**Verification:**
```bash
npm run test -- src/hooks/useActivities.test.tsx
```

**Commit:** `fix(activities): serialize cursor page loading`

### Task 2.3: Separar lista paginada de analytics completos

**Objective:** corrigir contagem, PRs e estatísticas limitadas aos primeiros 50 itens.

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/activities.ts`
- Modify: `src/hooks/useActivities.ts`
- Modify: `src/components/ActivitiesPageClient.tsx:40-110`
- Create: `src/hooks/useActivityAnalytics.test.tsx`
- Create: `src/components/ActivitiesPageClient.test.tsx`

**Design:**
- `countStoredActivities()` usa `store.count()`;
- listagem usa somente páginas visíveis;
- analytics/PRs usam `getAllStoredSummaries()` — resumos leves, nunca pontos;
- aba de estatísticas carrega summaries completos independentemente do sentinel;
- contagem exibida usa total persistido, não `activities.length`.

**RED:** 120 registros, página inicial 50; UI mostra total 120; PR mais antigo continua presente; estatísticas incluem todos os 120 sem abrir `activityTracks`.

**Verification:**
```bash
npm run test -- src/hooks/useActivityAnalytics.test.tsx src/components/ActivitiesPageClient.test.tsx
```

**Commit:** `fix(analytics): compute history stats independently of visible pages`

### Task 2.4: Adotar virtualização de altura variável

**Objective:** manter DOM limitado sem sobreposição em fonte 200%.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/ActivityList.tsx:87-257`
- Create: `src/components/ActivityList.test.tsx`

**Step 1 — RED:** 1.000 linhas com textos curtos/longos e alturas distintas; exigir DOM limitado, item final acessível, foco preservado e sem spacer baseado exclusivamente em `index × altura`.

**Step 2 — GREEN:** instalar `@tanstack/react-virtual`; usar `useWindowVirtualizer`, `measureElement`, overscan 8 e chaves estáveis.

**Verification:**
```bash
npm run test -- src/components/ActivityList.test.tsx
```

**Commit:** `perf(ui): virtualize variable-height activity history`

### Task 2.5: Testar sentinel e fallback acessível

**Objective:** provar carregamento único por observer e teclado.

**Files:**
- Modify: `src/components/ActivityList.test.tsx`
- Modify: `src/components/ActivitiesPageClient.test.tsx`
- Modify somente conforme RED: `ActivityList.tsx`

**RED/GREEN:** mock de `IntersectionObserver`; uma interseção = uma página; botão funciona por Enter/Space; `aria-busy`; erro mantém botão de retry; aba stats não precisa do sentinel.

**Commit:** `test(ui): verify accessible incremental history loading`

---

# Fase 3 — Heatmap e lifecycle de mapas

### Task 3.1: Definir processamento incremental sem array global

**Objective:** processar trilhas em lotes sem retornar todos os pontos acumulados.

**Files:**
- Modify: `src/lib/heatmap-data.ts`
- Modify: `src/lib/heatmap-data.test.ts`

**API alvo:**
```ts
export async function forEachHeatmapBatch(
  options: HeatmapBatchOptions,
  consume: (batch: HeatmapTrack[]) => void | Promise<void>,
): Promise<{ activities: number; renderedPoints: number }>;
```

**RED:** 1.000 atividades; consumer recebe lotes limitados; API retorna apenas contadores; track bruto deixa de ser referenciado ao fim de cada iteração; cancelamento por `AbortSignal` encerra leitura.

**GREEN:** paginar IDs/summaries, abrir transações curtas por lote, simplificar cada track, liberar referência e nunca criar `allHeatmapPoints`.

**Verification:**
```bash
npm run test -- src/lib/heatmap-data.test.ts
```

**Commit:** `perf(heatmap): stream simplified track batches`

### Task 3.2: Integrar o heatmap incremental

**Objective:** remover `getAllStoredActivities()` de `PersonalHeatmap`.

**Files:**
- Modify: `src/components/PersonalHeatmap.tsx:190-269`
- Create: `src/components/PersonalHeatmap.test.tsx`

**RED:** mock falha se `getAllStoredActivities()` for chamado; lotes aparecem incrementalmente; unmount cancela processamento; filtros não recarregam track bruto desnecessariamente.

**GREEN:** guardar somente `HeatmapTrack` simplificado e metadados leves. Não manter `StoredActivity[]`.

**Commit:** `perf(heatmap): consume incremental storage batches`

### Task 3.3: Provar cleanup de Leaflet/mapas

**Objective:** remover layers/listeners em ciclos repetidos.

**Files:**
- Create/modify tests: `ActivityMap`, `LiveMapTrack`, `RouteMapOverlay`, `PersonalHeatmap`
- Modify produção somente quando RED reproduzir leak.

**RED:** montar/desmontar 20 vezes; contar listeners/layers; estado final volta ao baseline.

**Verification:** unitários + coletor runtime da Fase 5.

**Commit:** `test(maps): verify layer and listener cleanup`

---

# Fase 4 — E2E visual, responsividade e acessibilidade

### Task 4.1: Completar fixtures sintéticas

**Objective:** cobrir extremos visuais/performance sem dados pessoais.

**Files:**
- Modify: `tests/fixtures/activityFactory.ts`
- Modify: `tests/fixtures/datasets.ts`
- Create: `tests/fixtures/routes.ts`
- Create: `tests/fixtures/profile.ts`
- Create: `tests/fixtures/fixtures.test.ts`

**Datasets:** 0/25/100/1.000 resumos; 1k/10k/50k pontos; datas iguais; PT/EN longo; valores nulos; treino estruturado; equipamento; rotas; fontes de dados marcadas `synthetic-test`.

**Commit:** `test(fixtures): complete deterministic RunFlow datasets`

### Task 4.2: Instalar e configurar Playwright

**Objective:** criar regressão visual e funcional isolada.

**Files:**
- Modify: `package.json`, `package-lock.json`, `.gitignore`
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers/seedIndexedDb.ts`
- Create: `tests/e2e/helpers/runtimeGuard.ts`
- Create: `tests/e2e/helpers/visualAssertions.ts`

**Config:** servidor HTTP local; contexto novo por teste; traces/screenshots/video na primeira repetição; falhar em `pageerror`, console error inesperado e request failed; nunca usar perfil real.

**Scripts:** `test:e2e`, `test:e2e:headed`, `test:e2e:update`.

**Verification:** um teste de controle deve falhar com overflow deliberado e passar sem ele.

**Commit:** `test(e2e): add isolated Playwright harness`

### Task 4.3: Corrigir shell e safe areas por testes

**Objective:** remover `min-h-screen`/`pb-24` frágeis.

**Files:**
- Create: `tests/e2e/visual/navigation.spec.ts`
- Modify conforme RED: `src/app/globals.css`, `src/components/AppLayout.tsx`

**Matrix:** 360×640, 360×800, 390×844, 412×915, 480×1040, 600×960, 800×1280, 844×390, 1280×800; fonte 100/150/200%; gestos/três botões.

**GREEN:** `100dvh`, variável de altura da bottom nav, safe-area dinâmica, foco visível e targets ≥48 px.

**Commit:** `fix(ui): harden app shell for safe areas and large text`

### Task 4.4: Completar acessibilidade dos modais

**Objective:** aplicar o hook a todos os modais e testar comportamento real.

**Files:**
- Modify: `src/hooks/useModalA11y.ts`
- Replace/expand: `src/hooks/useModalA11y.test.ts` → `.test.tsx`
- Modify: `SocialShareCardModal.tsx`, `WorkoutLibraryModal.tsx`, `WorkoutBuilderModal.tsx`, `AutoPauseModal.tsx`, `VoiceCoachModal.tsx`, `BikeGarageManager.tsx`
- Create: `tests/e2e/visual/modals.spec.ts`

**RED:** foco inicial; Tab/Shift+Tab confinados; Escape fecha; foco retorna; callback instável não restaura foco durante modal aberto; IME não cobre ação primária; Back fecha modal antes de navegar.

**GREEN:** um hook compartilhado, callbacks estabilizados via ref e sem handlers duplicados.

**Commit:** `fix(a11y): complete modal focus and dismissal contract`

### Task 4.5: Cobrir atividades, mapas e Flyover

**Files:**
- Create: `tests/e2e/visual/activities.spec.ts`
- Modify produção apenas para falhas reproduzidas.

**Scenarios:** lista 0/25/1.000; item final; stats completos; mapa disponível/indisponível; heatmap incremental; Flyover abrir/fechar/fullscreen; fontes 200%; retrato/paisagem.

**Commit:** `test(e2e): cover activity and map visual journeys`

### Task 4.6: Cobrir gravação, HUD e IME

**Files:**
- Create: `tests/e2e/visual/recording.spec.ts`
- Modify conforme RED: `RecordWorkoutClient.tsx`, `BikeComputerHud.tsx`, `StructuredWorkoutHud.tsx`, `ClimbProHudCard.tsx`, `LiveElevationProfile.tsx`, `LiveMapTrack.tsx`.

**Scenarios:** corrida/ciclismo; sensores sintéticos; orientação; fonte 200%; Glove Mode 64 px; teclado; background/foreground simulado; cancelamento de áudio ao encerrar.

**Commit:** `test(e2e): validate responsive recording HUDs`

### Task 4.7: Automatizar screenshots APK reversíveis

**Files:**
- Create: `scripts/android/avd-matrix.json`
- Create: `scripts/android/run-visual-matrix.mjs`
- Create: `scripts/android/adb-screenshot.mjs`
- Create: `scripts/android/reset-device-state.mjs`
- Create: `docs/quality/visual-matrix.md`

**Rules:** AVD visível; `adb exec-out screencap -p`; restaurar size/density/font/rotação/navegação em `finally`; WebView via CDP quando UiAutomator não expuser DOM.

**Commit:** `test(android): add reversible APK visual matrix`

---

# Fase 5 — Performance, WebGL, bundle e memória 4/8 GB

### Task 5.1: Tornar benchmark realmente profileable

**Files:**
- Modify: `android/app/build.gradle:19-30`
- Create: `android/app/src/benchmark/AndroidManifest.xml`
- Verify: `MainActivity.java`

**RED:** manifest benchmark atual não contém `<profileable android:shell="true">`.

**GREEN:** release-like, `applicationIdSuffix=.benchmark`, non-debuggable, profileable, WebView debugging desativado.

**Verification:** `processBenchmarkMainManifest` e inspeção do manifest mesclado.

**Commit:** `test(perf): make benchmark build profileable`

### Task 5.2: Criar módulo Macrobenchmark

**Files:**
- Modify: `android/settings.gradle`, `android/build.gradle`
- Create: `android/macrobenchmark/build.gradle`
- Create manifest e `StartupBenchmark.kt`

**Metrics:** COLD/WARM/HOT, `StartupTimingMetric`, `FrameTimingMetric`; 20 iterações finais.

**Verification:** assemble app/AndroidTest e uma execução de smoke em AVD visível.

**Commit:** `test(perf): add RunFlow Macrobenchmark module`

### Task 5.3: Adicionar jornadas críticas de benchmark

**Files:** `StartupBenchmark.kt`, `ActivityScrollBenchmark.kt`, `ActivityDetailBenchmark.kt`, `FlyoverBenchmark.kt`, `BenchmarkJourneys.kt`.

**Journeys:** startup; scroll 1.000; detalhe; mapa; Flyover 50k; heatmap; rotação/background.

**Rule:** fixtures exclusivas do package benchmark; marcadores semânticos de início/fim; nada de coordenada fixa se houver seletor acessível.

**Commit:** `test(perf): benchmark critical RunFlow journeys`

### Task 5.4: Criar coleta ADB/CDP/Perfetto

**Files:**
- Create: `scripts/perf/run-journey.mjs`, `android-processes.mjs`, `webview-cdp.mjs`, `analyze-results.mjs`, `perfetto-config.pbtxt`
- Create: `docs/quality/performance-methodology.md`

**Metrics:** `am start -W`; PSS/private dirty/graphics; renderer WebView; JS heap pós-GC; DOM/listeners; FrameTimeline; gfxinfo; LCP/INP/CLS/Long Tasks; exit-info/logcat.

**RED:** fixture com PID WebView errado ou métrica ausente deve falhar fechado.

**Commit:** `test(perf): add WebView and Android trace collectors`

### Task 5.5: Verificar Flyover e adaptar somente por medição

**Files:**
- Create: `src/components/ActivityFlyover3D.test.tsx`
- Create: `src/lib/flyover3d/quality.ts`, `.test.ts`
- Modify: `ActivityFlyover3D.tsx`

**RED:** um RAF; pausa/retoma sem duplicação; dispose uma vez; fullscreen sincronizado; 20 ciclos sem crescimento monotônico.

**GREEN:** tier por budget medido para DPR/antialias/segmentos; não confiar apenas em `navigator.deviceMemory`.

**Commit:** `perf(webgl): enforce measured Flyover lifecycle budgets`

### Task 5.6: Definir budget de bundle por rota

**Files:**
- Modify: `scripts/perf/bundle-budget.mjs`, `package.json`
- Create: `scripts/perf/bundle-baseline.json`
- Modify imports apenas após medição.

**Gate:** Three ausente do inicial; limites por rota; regressão >10% falha; relatório inclui bytes gzip/brutos e chunk attribution.

**Commit:** `perf(bundle): enforce route-level budgets`

### Task 5.7: Executar matriz de memória 4 GB/8 GB

**Files:**
- Create: `docs/quality/performance-baseline.md`

**Runs:** 20 startups; scroll 1.000; 10 detalhes/mapas; 20 Flyovers; heatmap; gravação sintética; import/restore; API37 MemoryLimiter.

**Gate:** P50/P95/P99; nenhum ANR/OOM/MemoryLimiter; estado final ≤ `max(baseline+10%, baseline+20MB)`; traces temporários em `.hermes/artifacts/`.

**Commit:** `docs(perf): publish verified 4GB and 8GB baseline`

---

# Fase 6 — Android 13–17 e permissões

### Task 6.1: Instalar platform 37 e criar AVDs dedicados

**Objective:** distinguir plataforma, system image e AVD.

**Steps:** registrar IDs atuais com `sdkmanager.bat --list`; instalar `platforms;android-37` e imagens 33–36 necessárias; criar `API33_4GB`, `API34_smoke`, `API35_smoke`, `API36_smoke`, `API37_4GB`, `API37_8GB`; preservar `Pixel_8` existente.

**Verification:** lista de AVDs + leitura de `config.ini` + boot visível; registrar API/RAM/resolução/densidade.

### Task 6.2: Elevar compileSdk/targetSdk para 37

**Files:**
- Modify: `android/variables.gradle:2-4`
- Modify dependências/toolchain somente se a compilação provar incompatibilidade.

**RED:** script de metadata rejeita target 35.

**GREEN:** min 33, compile/target 37.

**Verification:**
```bash
export JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
export ANDROID_HOME='C:/Users/gustavo/AppData/Local/Android/Sdk'
npm run build:mobile
cd android
./gradlew testDebugUnitTest assembleBenchmark lintDebug lintRelease --console=plain
```

Confirmar metadata com `aapt2`/`apkanalyzer` no APK, não só Gradle.

**Commit:** `feat(android): target Android 17 API 37`

### Task 6.3: Corrigir estado da permissão LAN

**Files:**
- Modify: `LocalNetworkPermissionPlugin.java`, `src/lib/local-network.ts`, `SyncPanel.tsx`
- Expand: `src/lib/local-network.test.ts`
- Create: `LocalNetworkPermissionTest.java`

**Contract:** `granted | denied | rationale | unavailable`; erro do plugin em nativo não pode virar `true`; API<37 não pede prompt; P2P e WebDAV param quando negados e mostram retry/configurações; offline continua normal.

**RED:** host/join/WebDAV não iniciam com denied; retry inicia após grant; revogação é detectada.

**Commit:** `fix(android): enforce local network permission outcomes`

### Task 6.4: Corrigir precedência de locale

**Files:**
- Modify: `AppLocalePlugin.java`, `src/lib/app-locale.ts`, `src/lib/i18n.tsx`
- Expand: `src/lib/app-locale.test.ts`
- Create teste instrumentado de locale.

**Contract:** plugin diferencia locale explícito de locale do sistema. Precedência: app locale explícito > perfil > navegador/sistema > pt. `setAppLocale` só retorna sucesso quando aplicado.

**RED:** perfil EN + sistema PT + nenhum app locale deve iniciar EN; troca Android atualiza app/perfil; restart preserva.

**Commit:** `fix(i18n): preserve explicit app and profile locale precedence`

### Task 6.5: Validar BLE e manifesto moderno

**Files:**
- Expand testes nativos BLE/mocks web
- Verify: source e manifests merged debug/benchmark/release.

**Scenarios:** grant, deny, revoke, re-pair API33/API37; manter SCAN/CONNECT; zero BLUETOOTH/ADMIN/storage legado; nenhum prompt de notificação sem consumidor.

**Commit:** `test(android): verify modern BLE permissions across API boundaries`

### Task 6.6: Endurecer áudio em background por evidência

**Files:**
- Create: `voice-coach.test.ts`, `workout-audio.test.ts`, `auto-pause.test.ts`
- Modify produção somente conforme RED.

**Scenarios:** ação visível; background; foco negado; retorno; encerramento cancela speech/audio context. Foreground service somente se runtime provar necessidade.

**Commit:** `test(audio): verify Android 17 background lifecycle`

### Task 6.7: Validar Predictive Back, large screens e IME

**Files:** testes Playwright/UiAutomator; modificar `AppLayout`, modais, `MainActivity`/Capacitor App apenas conforme falha.

**Gate:** Back fecha fullscreen/modal, depois histórico, depois app; gravação não perde estado; sw600/multi-window e IME sem controles cobertos.

**Commit:** `fix(android): validate predictive back and multi-window flows`

### Task 6.8: StrictMode e grants URI

**Files:** fonte debug específica; instrumented share/export test.

**Gate:** StrictMode apenas debug; URI content provider com grants explícitos; nenhum caminho interno; share/export funciona API33/API37.

**Commit:** `test(android): verify safe share URI grants`

### Task 6.9: Publicar auditoria de legado confiável

**Files:**
- Modify: `scripts/android/audit-legacy.mjs`
- Create: `docs/quality/android-legacy-audit.md`

**Gate:** zero permissão legada no artefato; ocorrências de compatibilidade justificadas individualmente; script retorna não zero para fixture negativa.

**Commit:** `docs(android): publish fail-closed legacy audit`

---

# Fase 7 — Matriz final, CI, documentação e entrega

### Task 7.1: Criar CI de gates determinísticos

**Files:**
- Create: `.github/workflows/gates.yml`
- Create/pin: `.nvmrc` ou campo `engines` alinhado ao baseline escolhido.

**Jobs:** npm ci; version consistency; lint/typecheck; Vitest; Playwright; Next build; bundle budget; Android unit/lint/assemble debug/benchmark; legacy audit. Instrumentados/performance podem ser job manual se runner não suportar aceleração, mas permanecem gate local obrigatório.

**RED:** fixture/branch de controle quebra cada gate; remover antes do commit.

**Commit:** `ci: enforce RunFlow web and Android quality gates`

### Task 7.2: Executar matriz funcional API 33–37

**Files:**
- Create: `docs/quality/android-13-17-compatibility.md`
- Create: `docs/quality/device-matrix.md`

**Per API:** instalação limpa; onboarding; dashboard; lista/detalhe; stats 1.000; heatmap; gravação; import; rotas; perfil; permissões; locale; BLE quando disponível; rotação/background; screenshots; logcat/meminfo/exit-info.

**Gate:** API33/API37 jornada completa; API34–36 smoke + visual principal; não executado = pendente.

**Commit:** `docs(android): publish verified API 33-37 matrix`

### Task 7.3: Aprovar regressão visual final

**Files:** snapshots aprovados e `docs/quality/visual-e2e-report.md`.

**Matrix:** nove viewports; pares críticos tema/fonte; 200% em telefone compacto/paisagem/tablet; APK API33/API37. Snapshots atualizados somente com comando explícito e revisão humana.

**Commit:** `test(visual): approve RunFlow responsive baselines`

### Task 7.4: Publicar performance antes/depois

**Files:** `docs/quality/performance-final.md`.

**Gate:** mesmas fixtures/AVD/RAM/WebView/iterações; P50/P95/P99, APK/chunks, PSS, heap, jank, startup, CWV, 20 ciclos WebGL/mapas; nenhuma regressão >10% sem justificativa aceita.

**Commit:** `docs(perf): publish verified RunFlow performance results`

### Task 7.5: Executar todos os gates e gerar APK atual

**Environment:**
```bash
export JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
export ANDROID_HOME='C:/Users/gustavo/AppData/Local/Android/Sdk'
```

**Commands:**
```bash
npm ci
npm run quality:versions
npm run lint
npx tsc --noEmit
npm run test
npm run test:e2e
npm run build
npm run perf:bundle
npm run build:mobile
npm run quality:legacy
cd android
./gradlew testDebugUnitTest assembleAndroidTest lintDebug lintRelease assembleBenchmark --console=plain
./gradlew connectedDebugAndroidTest --console=plain
./gradlew :macrobenchmark:connectedBenchmarkAndroidTest --console=plain
```

**Verify:** APK principal e benchmark existem; versionCode/name/min/target corretos; bytes e SHA-256 registrados; instalar/abrir API33/API37; zero crash/ANR/OOM/StrictMode grave; `git diff --check`; nenhum segredo/dado real/artefato temporário versionado.

### Task 7.6: Corrigir README, ROADMAP e CHANGELOG

**Files:** `README.md`, `ROADMAP.md`, `CHANGELOG.md`, links `docs/quality/`.

**Rule:** marcar Fase 4 concluída somente após 7.2–7.5 verdes. Corrigir a declaração obsoleta de `POST_NOTIFICATIONS`; documentar target37 real, comandos, APK e limitações. Se qualquer gate falhar, status é “em validação”.

**Commit:** `docs(quality): align RunFlow roadmap with verified evidence`

### Task 7.7: Revisão independente e publicação Git

**Steps:**
1. revalidar SHA/status/diff;
2. revisão de conformidade tarefa por tarefa;
3. revisão de qualidade independente focada em migração, concorrência, permissões, privacidade, memória e acessibilidade;
4. corrigir achados com novo RED e repetir gates afetados;
5. commit final apenas se necessário;
6. push `origin main` conforme política do projeto;
7. verificar `git ls-remote origin refs/heads/main` igual ao SHA local;
8. confirmar worktree rastreado limpo e `IDEA.md` preservado fora do commit.

**Final report:** resultados reais, contagens, APKs/bytes/SHA-256, API/RAM/AVDs, journeys, métricas antes/depois, screenshots/relatórios, limitações, commit e SHA remoto.

---

## 3. Ordem obrigatória

```text
Fase 0  versão/baseline/gates honestos
  ↓
Fase 1  migração v7 e contratos externos (P0)
  ↓
Fase 2  histórico completo/paginação/virtualização
  ↓
Fase 3  heatmap e lifecycle de mapas
  ↓
Fase 4  Playwright/responsividade/acessibilidade
  ↓
Fase 5  benchmark/performance/memória
  ↓
Fase 6  target37/permissões/Android 13–17
  ↓
Fase 7  CI/matrizes/documentação/release
```

Não iniciar target37 ou medições finais antes de fechar Fase 1. Não aprovar snapshots antes da correção funcional. Não usar APK 0.9.5 como evidência da revisão 0.9.6.

## 4. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Migração apagar trilhas inválidas | teste negativo real, validação explícita, abort versionchange, reabertura e inspeção do legado |
| Analytics permanecer limitado à página | contrato separado: lista paginada + summaries completos leves + count do store |
| Cursor composto alterar ordenação | casos com datas/IDs iguais e range exclusivo em ambas as páginas |
| Virtualização quebrar foco/fonte 200% | medição dinâmica, teste DOM/foco e Playwright narrow/large text |
| Heatmap continuar consumindo heap | API sem retorno global, cancelamento, UI armazenando somente tracks simplificados |
| Snapshot mascarar bug | atualização explícita após assertion funcional verde e revisão humana |
| Benchmark medir build debug | package isolado, non-debuggable/profileable e manifest auditado |
| Target37 quebrar plugin | compilar primeiro; atualizar dependência apenas com erro reproduzido |
| Permissão LAN mascarada por fallback | distinguir web/nativo, estados explícitos e teste de denial/revocation |
| Locale do sistema sobrescrever perfil | plugin retorna `explicit=false`; matriz de precedência e restart |
| Relatório declarar sucesso sem artefato | scripts fail-closed, schema, CI e caminhos/SHAs verificados |
| Mudanças concorrentes no repo | revalidar HEAD/status antes de editar/commit; nunca resetar/stashar trabalho alheio |

## 5. Pontos de acesso e artefatos esperados

- Aplicação local: `http://127.0.0.1:3000/`.
- App principal: `com.runflow.app/.MainActivity`.
- Benchmark: `com.runflow.app.benchmark/.MainActivity`.
- APK debug: `E:\projetos\runflow-app\android\app\build\outputs\apk\debug\app-debug.apk`.
- APK benchmark: `E:\projetos\runflow-app\android\app\build\outputs\apk\benchmark\app-benchmark.apk`.
- Artefatos temporários: `E:\projetos\runflow-app\.hermes\artifacts\runflow-e2e\`.
- Relatórios versionados: `E:\projetos\runflow-app\docs\quality\`.

## 6. Checklist do plano

- [x] Parte do HEAD publicado `88ec3e5`.
- [x] Trata primeiro perda de dados e regressão de analytics.
- [x] Remove duplicação de relatório no summary.
- [x] Usa índice composto e virtualização variável.
- [x] Integra heatmap incremental de verdade.
- [x] Cria E2E visual web e APK separados.
- [x] Mede memória/performance em 4/8 GB.
- [x] Eleva e comprova compile/target 37.
- [x] Testa LAN, locale, BLE, áudio e Predictive Back.
- [x] Corrige versão, scripts fail-closed, CI e documentação.
- [x] Exige TDD, revisão independente, APK atual e SHA remoto.

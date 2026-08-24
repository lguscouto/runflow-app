# RunFlow — Pendências E2E Visual, Performance, Memória e Android 13–17 Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task. Se a skill não estiver disponível, usar workers isolados via `delegate_task`, com revisão em duas etapas após cada fase: conformidade com o plano e qualidade técnica.

**Goal:** corrigir todos os bloqueadores encontrados na reavaliação, comprovar visual/performance/memória em ambientes reproduzíveis e entregar o RunFlow funcional do Android 13/API 33 ao Android 17/API 37, sem legado exclusivo de Android 12 ou anterior.

**Architecture:** executar verticalmente e com TDD: primeiro tornar a persistência v7 íntegra e reversível; depois implementar paginação/virtualização e infraestrutura visual; em seguida medir e otimizar WebView/WebGL/IndexedDB; finalmente elevar o target Android, modernizar permissões e executar a matriz final. O conteúdo Next.js será validado com Vitest + Playwright e o APK Capacitor com UiAutomator, Macrobenchmark, ADB, CDP e Perfetto.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, IndexedDB/idb 8, Vitest 4, fake-indexeddb 6, Playwright, Capacitor 7, Java 21, Android Gradle Plugin 8.13.2, Gradle 8.13, Android API 33–37, UiAutomator 2.4.0, Macrobenchmark 1.4.1, ADB, Perfetto e Chrome DevTools Protocol.

---

## 1. Boundary confirmado e finalidade deste plano

- Repositório: `E:\projetos\runflow-app`.
- Baseline Git: `b2256154a0091b6075149077ee32c147e99d0ed7` em `main`, alinhada com `origin/main` no momento da reavaliação.
- Estado Android atual: `minSdk 33`, `compileSdk 35`, `targetSdk 35`.
- AVD atual: somente `Pixel_8`, Android 17/API 37, RAM configurada em 2.048 MB.
- A plataforma de compilação API 37 ainda não está instalada.
- O plano anterior continua como histórico: `.hermes/plans/2026-08-23_231212-runflow-e2e-visual-performance-android-13-17.md`.
- Este documento substitui as partes pendentes daquele plano e incorpora os defeitos descobertos na reavaliação.
- Não usar `IDEA.md`, banco real, perfil real, treinos reais, GPX/FIT reais ou dados pessoais.
- Emuladores sempre com janela visível; nunca usar `-no-window` sem autorização explícita.
- Commits indicados abaixo pertencem à futura execução autorizada. Push somente com autorização e verificação do SHA remoto.

## 2. Critérios globais de conclusão

O trabalho só estará concluído quando todos os itens abaixo forem comprovados:

1. migração IndexedDB v5/v6→v7 preserva todos os campos e aborta atomicamente em erro;
2. `workoutId` e `structuredWorkoutReport` continuam visíveis no detalhe após salvar, migrar, sincronizar e restaurar;
3. o store pesado legado deixa de receber escrita tripla e, ao final da migração, é removido com segurança;
4. histórico completo usa paginação estável por cursor e DOM limitado com 1.000 itens;
5. fonte a 200%, paisagem, teclado, safe areas, mapas, HUDs e modais passam na matriz visual;
6. nenhuma regressão não aprovada >10% em startup, jank, PSS, heap ou Core Web Vitals;
7. AVDs de 4 GB e 8 GB passam os cenários de carga sem ANR, OOM ou `MemoryLimiter:AnonSwap`;
8. `minSdk 33`, `compileSdk 37` e `targetSdk 37` são confirmados no APK;
9. permissão de rede local, BLE, idioma por app e áudio são validados no Android 17;
10. o manifesto mesclado não contém `BLUETOOTH`, `BLUETOOTH_ADMIN`, armazenamento legado ou outro fallback exclusivo de API ≤32;
11. matriz real Android 13, 14, 15, 16 e 17 possui relatório e evidência;
12. ROADMAP e documentação refletem somente resultados executados.

---

# Fase 0 — Baseline reproduzível e correção da suíte mínima

### Task 0.1: Registrar ambiente e falhas atuais

**Objective:** criar um baseline auditável antes de alterar produção.

**Files:**
- Create: `docs/quality/current-state.md`
- Modify: `.gitignore`

**Steps:**
1. Registrar SHA, branch, status, Node/npm, Java, Gradle, AGP, Capacitor, SDKs, AVDs, WebView e RAM dos AVDs.
2. Confirmar que `.hermes/artifacts/runflow-e2e/` ignora traces, heaps, vídeos, XML do UiAutomator, APKs e screenshots temporárias.
3. Executar os gates atuais sem corrigir nada e registrar cada sucesso/falha real.

**Verification:**
```bash
npm ci
npm run test
npm run build
npx cap sync android
cd android
./gradlew testDebugUnitTest assembleDebug assembleAndroidTest --console=plain
```

**Expected:** baseline factual. Falhas conhecidas devem ser documentadas, nunca reinterpretadas como sucesso.

**Commit:**
```bash
git add docs/quality/current-state.md .gitignore
git commit -m "docs(quality): record reproducible RunFlow baseline"
```

### Task 0.2: Corrigir os placeholders Android

**Objective:** eliminar falso teste e validar o package real.

**Files:**
- Modify: `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`
- Modify: `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`

**Step 1 — RED:** trocar o teste instrumentado para esperar `com.runflow.app` e renomear pacote/classe para `com.runflow.app`; executar antes de mover o arquivo e confirmar erro de package/source path.

**Step 2 — GREEN:** mover para:
- `android/app/src/androidTest/java/com/runflow/app/AppContextInstrumentedTest.java`
- `android/app/src/test/java/com/runflow/app/AppConfigUnitTest.java`

O teste local deve validar constantes reais de configuração extraídas para uma classe pequena, ou ser removido se continuar sendo `2 + 2`.

**Verification:**
```bash
cd android
./gradlew testDebugUnitTest assembleAndroidTest --console=plain
```

**Expected:** testes compilam; o teste instrumentado ainda será executado na matriz, não declarado como executado aqui.

**Commit:**
```bash
git add android/app/src/test android/app/src/androidTest
git commit -m "test(android): replace Capacitor placeholder tests"
```

---

# Fase 1 — P0: integridade e migração IndexedDB v7

### Task 1.1: Criar factories e isolamento de banco

**Objective:** tornar os testes determinísticos e independentes.

**Files:**
- Create: `tests/fixtures/activityFactory.ts`
- Create: `tests/fixtures/datasets.ts`
- Create: `tests/fixtures/legacyDbV5.ts`
- Create: `tests/fixtures/legacyDbV6.ts`
- Modify: `tests/setup/indexeddb.ts`
- Modify: `vitest.config.ts`

**Step 1 — RED:** adicionar teste que grava uma atividade, encerra o caso e exige banco vazio no próximo teste.

**Step 2 — GREEN:** resetar `indexedDB` e o singleton de conexão em `beforeEach/afterEach`. Expor em `storage.ts` somente um helper de teste protegido por `process.env.NODE_ENV === "test"` para fechar/resetar `dbPromise`.

**Factory mínima:**
```ts
export function makeStoredActivity(
  overrides: Partial<StoredActivity> = {},
): StoredActivity {
  return {
    id: "activity-001",
    name: "Treino sintético",
    sport: "running",
    startedAt: "2026-08-24T10:00:00.000Z",
    durationSec: 3600,
    movingTimeSec: 3500,
    elapsedTimeSec: 3600,
    distanceM: 10000,
    avgPaceSecKm: 360,
    maxPaceSecKm: 300,
    elevationGainM: 100,
    avgHr: 150,
    maxHr: 175,
    calories: 700,
    source: "synthetic-test",
    fileName: null,
    gearId: null,
    routeId: null,
    workoutId: null,
    structuredWorkoutReport: null,
    notes: null,
    points: [],
    ...overrides,
  };
}
```

**Verification:**
```bash
npm run test -- tests/setup tests/fixtures src/lib/storage.test.ts
```

**Expected:** isolamento verde e nenhuma leitura de banco real.

**Commit:** `test(storage): add deterministic IndexedDB fixtures`

### Task 1.2: Reproduzir a perda de treino estruturado

**Objective:** criar regressão que prove o bloqueador encontrado.

**Files:**
- Create: `src/lib/storage.detail.test.ts`
- Modify later: `src/lib/storage.ts`

**Step 1 — RED:** salvar uma atividade contendo `workoutId` e `structuredWorkoutReport`; ler com `getStoredActivity()` e exigir igualdade profunda.

```ts
it("preserves structured workout metadata in detail storage", async () => {
  const activity = makeStoredActivity({
    workoutId: "workout-42",
    structuredWorkoutReport: makeStructuredWorkoutReport(),
  });
  await putActivity(activity);
  const restored = await getStoredActivity(activity.id);
  expect(restored?.workoutId).toBe("workout-42");
  expect(restored?.structuredWorkoutReport)
    .toEqual(activity.structuredWorkoutReport);
});
```

**Verification RED:**
```bash
npm run test -- src/lib/storage.detail.test.ts
```

**Expected:** FAIL porque o join atual perde os campos.

**Commit:** nenhum antes do GREEN.

### Task 1.3: Separar summary leve e detail completo

**Objective:** corrigir a perda de campos sem inflar a listagem.

**Files:**
- Modify: `src/lib/storage.ts:15-66,163-206,332-388`
- Modify: `src/lib/types.ts:235-269`
- Test: `src/lib/storage.detail.test.ts`

**Design:**
```ts
interface StoredActivityDetailRecord {
  id: string;
  points: StoredTrackPoint[];
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  workoutId: string | null;
  structuredWorkoutReport: StructuredWorkoutReport | null;
}
```

- `activitySummaries` mantém campos leves e `workoutId`.
- `structuredWorkoutReport` fica somente no detail/track store.
- `getStoredActivity()` recompõe summary + detail sem perda.
- `ActivitySummary.structuredWorkoutReport` deve ser removido do contrato de listagem se nenhum consumidor de lista precisar dele; `ActivityDetail` continua contendo o campo.

**Verification GREEN:**
```bash
npm run test -- src/lib/storage.detail.test.ts
npm run test
```

**Expected:** teste antes vermelho agora passa; suíte completa verde.

**Commit:** `fix(storage): preserve structured workout detail fields`

### Task 1.4: Escrever testes de migração v5/v6→v7

**Objective:** provar preservação, idempotência e falha segura antes do novo upgrade.

**Files:**
- Create: `src/lib/storage.migration.test.ts`
- Use: `tests/fixtures/legacyDbV5.ts`
- Use: `tests/fixtures/legacyDbV6.ts`

**RED cases:**
1. v5 com todos os campos migra byte-equivalente após normalização;
2. v6 incompleto é reparado a partir do store completo legado;
3. duas aberturas da v7 não duplicam dados;
4. datas iguais preservam todos os IDs;
5. registro deliberadamente inválido (`points` não-array) aborta a versão inteira;
6. após falha, store legado continua íntegro e a versão não fica consolidada como v7.

**Verification RED:**
```bash
npm run test -- src/lib/storage.migration.test.ts
```

**Expected:** FAIL contra DB_VERSION 6 e migração que engole erros.

### Task 1.5: Implementar upgrade transacional v7

**Objective:** migrar atomicamente e remover o legado somente após sucesso.

**Files:**
- Modify: `src/lib/storage.ts:52-160`
- Test: `src/lib/storage.migration.test.ts`

**Rules:**
- elevar `DB_VERSION` para 7;
- criar/garantir stores summary/detail;
- recriar dados split a partir de `activities` para v5 e v6;
- validar `id`, `startedAt` e `Array.isArray(points)`;
- não capturar/engolir erro de migração;
- deixar a exceção abortar a transaction `versionchange`;
- somente após o último `put`, apagar `activities` dentro da mesma transação;
- não manter fallback silencioso para store removido em runtime normal.

**Verification GREEN:**
```bash
npm run test -- src/lib/storage.migration.test.ts
npm run test
```

**Expected:** todos os casos de migração verdes, inclusive abort e reabertura.

**Commit:** `fix(storage): make v7 migration atomic and lossless`

### Task 1.6: Eliminar escrita tripla e reconstruir registros completos

**Objective:** parar duplicação permanente sem quebrar backup, heatmap ou sync.

**Files:**
- Modify: `src/lib/storage.ts:163-285`
- Modify: `src/lib/sync/merger.ts`
- Modify: `src/lib/sync/webdav.ts`
- Modify: `src/components/PersonalHeatmap.tsx`
- Create: `src/lib/storage.reconstruction.test.ts`

**Step 1 — RED:** exigir que `putActivity()` escreva somente summary + detail e que `getAllStoredActivities()` reconstrua objetos completos em lotes.

**Step 2 — GREEN:**
- transação apenas em `activitySummaries` + `activityDetails/activityTracks`;
- `getAllStoredActivities()` itera summary e busca detalhes sem store legado;
- para heatmap, expor iterador/lotes de pontos para evitar manter todas as atividades completas simultaneamente;
- sync e backup continuam produzindo o mesmo payload normalizado.

**Verification:**
```bash
npm run test -- src/lib/storage.reconstruction.test.ts src/lib/storage.migration.test.ts
npm run test
```

**Commit:** `perf(storage): remove legacy full-record duplication`

---

# Fase 2 — Paginação completa e virtualização acessível

### Task 2.1: Definir contrato de cursor estável

**Objective:** criar paginação determinística para datas repetidas.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/storage.ts`
- Create: `src/lib/storage.pagination.test.ts`

**Contract:**
```ts
export interface ActivityPageCursor {
  startedAt: string;
  id: string;
}

export interface ActivityPage {
  items: ActivitySummary[];
  nextCursor: ActivityPageCursor | null;
  hasMore: boolean;
}
```

**RED cases:** primeira página, página seguinte, fim, zero itens, limite inválido e datas iguais sem duplicação/omissão.

**Implementation:** índice composto `by-started-id` com key path `["startedAt", "id"]`; buscar `limit + 1`; cursor exclusivo na próxima página.

**Verification:**
```bash
npm run test -- src/lib/storage.pagination.test.ts
```

**Commit:** `feat(storage): add stable cursor pagination`

### Task 2.2: Integrar paginação à camada de atividades

**Objective:** remover o teto oculto de 200 atividades.

**Files:**
- Modify: `src/lib/activities.ts:140-144`
- Modify: `src/hooks/useActivities.ts:38-52`
- Create: `src/hooks/useActivities.test.tsx`

**Desired hook API:**
```ts
return {
  activities,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  refresh,
};
```

**RED:** duas páginas de 50 devem resultar em 100 IDs únicos e `hasMore=false` no fim.

**GREEN:** serializar `loadMore`, ignorar clique/intersection duplicado e resetar cursor no `refresh()`.

**Verification:**
```bash
npm run test -- src/hooks/useActivities.test.tsx
```

**Commit:** `feat(activities): load complete history by cursor`

### Task 2.3: Substituir virtualizador de altura fixa

**Objective:** manter DOM limitado sem quebrar fonte grande ou texto multilinha.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/ActivityList.tsx`
- Create: `src/components/ActivityList.test.tsx`

**Dependency:** `@tanstack/react-virtual`, versão estável pinada durante a execução.

**RED:** com 1.000 itens e linhas de alturas diferentes, DOM contém apenas janela + overscan e o item final continua acessível.

**GREEN:** usar `useWindowVirtualizer`/`measureElement`, não multiplicar posição por 74 px.

```ts
const rowVirtualizer = useWindowVirtualizer({
  count: activities.length,
  estimateSize: () => 74,
  overscan: 8,
  measureElement: (element) => element?.getBoundingClientRect().height ?? 74,
});
```

Preservar links, foco, `aria-current`, leitura por screen reader e retorno de navegação.

**Verification:**
```bash
npm run test -- src/components/ActivityList.test.tsx
```

**Commit:** `perf(ui): virtualize variable-height activity rows`

### Task 2.4: Carregar páginas sob demanda

**Objective:** integrar sentinel e botão acessível de fallback.

**Files:**
- Modify: `src/components/ActivitiesPageClient.tsx`
- Test: `src/components/ActivitiesPageClient.test.tsx`

**RED:** `IntersectionObserver` dispara uma única próxima página; sem observer, botão “Carregar mais” funciona por teclado.

**GREEN:** adicionar sentinel depois da lista e botão com estado `disabled`/`aria-busy`.

**Verification:**
```bash
npm run test -- src/components/ActivitiesPageClient.test.tsx
```

**Commit:** `feat(ui): load activity pages on demand`

---

# Fase 3 — Infraestrutura E2E visual e correções responsivas

### Task 3.1: Criar datasets visuais sintéticos

**Objective:** cobrir estados vazios, densos e extremos sem dados pessoais.

**Files:**
- Expand: `tests/fixtures/activityFactory.ts`
- Expand: `tests/fixtures/datasets.ts`
- Create: `tests/fixtures/routes.ts`
- Create: `tests/fixtures/profile.ts`

**Datasets:** 0, 25, 100 e 1.000 resumos; detalhes com 1.000, 10.000 e 50.000 pontos; corrida/ciclismo; textos longos PT/EN; valores ausentes; treino estruturado; equipamentos e rotas.

**Verification:** teste de snapshot estrutural do dataset, seed fixa e nenhum valor vindo do dispositivo.

**Commit:** `test(fixtures): add deterministic visual and load datasets`

### Task 3.2: Configurar Playwright

**Objective:** automatizar nove viewports e regressão visual.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers/seedIndexedDb.ts`
- Create: `tests/e2e/helpers/visualAssertions.ts`
- Create: `tests/e2e/visual/navigation.spec.ts`

**Scripts:**
```json
{
  "test:e2e:visual": "playwright test tests/e2e/visual",
  "test:e2e:visual:update": "playwright test tests/e2e/visual --update-snapshots"
}
```

**Matrix base:** 360×640, 360×800, 390×844, 412×915, 480×1040, 600×960, 800×1280, 844×390 e 1280×800.

**RED:** teste deve detectar overflow inserido pela fixture de controle.

**GREEN:** helper falha para `scrollWidth > clientWidth`, controles fora da viewport, touch target <48 px e overlap crítico.

**Verification:**
```bash
npm run dev
npm run test:e2e:visual
```

**Commit:** `test(e2e): add Playwright visual harness`

### Task 3.3: Corrigir shell, safe areas e navegação

**Objective:** passar 360×640, paisagem e fonte 200%.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/AppLayout.tsx`
- Test: `tests/e2e/visual/navigation.spec.ts`

**RED:** screenshots e assertions para 100%, 150% e 200% de fonte, gestos e barra de três botões.

**GREEN CSS alvo:**
```css
.safe-area-app {
  min-height: 100vh;
  min-height: 100dvh;
  padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
}

.app-main-mobile {
  padding-bottom: calc(
    var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem
  );
}
```

Remover dependência de `pb-24` fixo, manter foco visível, rótulos i18n e targets ≥48 px.

**Verification:** Playwright navigation matrix verde.

**Commit:** `fix(ui): harden app shell for safe areas and large text`

### Task 3.4: Cobrir atividades e detalhes

**Objective:** validar lista, gráficos, mapas e Flyover nas dimensões críticas.

**Files:**
- Create: `tests/e2e/visual/activities.spec.ts`
- Modify somente quando teste falhar: `src/components/ActivityDetailClient.tsx`, `ActivityCharts.tsx`, `ActivitySplits.tsx`, `SimpleLineChart.tsx`, `PowerDurationCurve.tsx`, `ActivityMap.tsx`, `PersonalHeatmap.tsx`, `ActivityFlyover3D.tsx`

**Scenarios:** 0/25/100/1.000, texto longo, item final, mapa carregado/indisponível, 3D aberto/fechado, fullscreen, retrato/paisagem e fonte 200%.

**Rule:** corrigir somente falhas reproduzidas; não reescrever componentes por estética.

**Commit:** `fix(ui): resolve measured activity layout regressions`

### Task 3.5: Cobrir gravação e HUDs

**Objective:** garantir telemetria e controles utilizáveis em telefone compacto e paisagem.

**Files:**
- Create: `tests/e2e/visual/recording.spec.ts`
- Modify conforme RED: `RecordWorkoutClient.tsx`, `BikeComputerHud.tsx`, `StructuredWorkoutHud.tsx`, `ClimbProHudCard.tsx`, `LiveElevationProfile.tsx`, `LiveMapTrack.tsx`

**Scenarios:** corrida/ciclismo, GPS/BLE sintético, teclado, rotação, Glove Mode ≥64 px, background/foreground simulado.

**Commit:** `fix(recording): harden responsive workout HUDs`

### Task 3.6: Consolidar acessibilidade de modais

**Objective:** fornecer foco, Escape/Back e retorno de foco de forma DRY.

**Files:**
- Create: `src/hooks/useModalA11y.ts`
- Create: `src/hooks/useModalA11y.test.tsx`
- Modify: `WorkoutBuilderModal.tsx`, `WorkoutLibraryModal.tsx`, `SocialShareCardModal.tsx`, `AutoPauseModal.tsx`, `VoiceCoachModal.tsx`, `BikeGarageManager.tsx`
- Create: `tests/e2e/visual/modals.spec.ts`

**RED:** foco inicial, Tab confinado, Escape fecha, foco retorna ao disparador e ação primária fica acima do teclado/safe area.

**GREEN:** um único hook compartilhado; nada de handlers duplicados por modal.

**Commit:** `fix(a11y): standardize modal focus and dismissal`

### Task 3.7: Automatizar screenshots do APK

**Objective:** capturar sistema + WebView de forma reversível.

**Files:**
- Create: `scripts/android/avd-matrix.json`
- Create: `scripts/android/run-visual-matrix.mjs`
- Create: `scripts/android/adb-screenshot.mjs`
- Create: `scripts/android/reset-device-state.mjs`
- Create: `docs/quality/visual-matrix.md`

**Rules:** AVD visível; PNG via `adb exec-out screencap -p` como bytes; `wm size`, density, font scale, rotação e navegação restaurados em `finally`; pacote benchmark isolado.

**Verification:** script deliberadamente interrompido ainda restaura todas as configurações.

**Commit:** `test(android): add reversible APK screenshot matrix`

---

# Fase 4 — Performance e memória 4–8 GB

### Task 4.1: Criar variante benchmark release-like

**Objective:** medir sem debugging e sem sobrescrever o app principal.

**Files:**
- Modify: `android/app/build.gradle`
- Create: `android/app/src/benchmark/AndroidManifest.xml`
- Modify: `android/app/src/main/java/com/runflow/app/MainActivity.java`

**Build type:** `initWith release`, `applicationIdSuffix ".benchmark"`, assinatura debug local, `debuggable false`, `profileableByShell true`, `matchingFallbacks ['release']`.

**Verification:**
```bash
cd android
./gradlew assembleBenchmark processBenchmarkMainManifest --console=plain
```

Inspecionar manifest mesclado: profileable presente, debuggable ausente e WebView debugging desativado.

**Commit:** `test(perf): add isolated benchmark build type`

### Task 4.2: Criar módulo Macrobenchmark

**Objective:** medir startup e frame timing com ferramenta oficial.

**Files:**
- Modify: `android/settings.gradle`
- Modify: `android/build.gradle`
- Create: `android/macrobenchmark/build.gradle`
- Create: `android/macrobenchmark/src/main/AndroidManifest.xml`
- Create: `android/macrobenchmark/src/main/java/com/runflow/macrobenchmark/StartupBenchmark.kt`

**Versions pinadas:** Macrobenchmark `1.4.1`, UiAutomator `2.4.0`; usar versão Kotlin compatível confirmada com AGP 8.13.2/Gradle 8.13 antes do sync, preferindo versão estável e sem atualizar AGP por conveniência.

**Metrics:** `StartupTimingMetric`, `FrameTimingMetric`; COLD/WARM/HOT; 20 iterações para relatório final.

**Verification:**
```bash
cd android
./gradlew :macrobenchmark:assembleBenchmark :macrobenchmark:assembleAndroidTest --console=plain
```

**Commit:** `test(perf): add Android Macrobenchmark module`

### Task 4.3: Criar jornadas Macrobenchmark

**Objective:** medir startup, scroll e abertura de detalhe/3D.

**Files:**
- Create: `StartupBenchmark.kt`
- Create: `ActivityScrollBenchmark.kt`
- Create: `ActivityDetailBenchmark.kt`
- Create: `BenchmarkJourneys.kt`

**RED:** cada jornada deve falhar se não conseguir localizar seu estado semântico de início/fim.

**GREEN:** fixture injection exclusiva da variante benchmark; UI Automator não depende de coordenadas fixas quando houver texto/descrição.

**Verification:**
```bash
cd android
./gradlew :macrobenchmark:connectedBenchmarkAndroidTest --console=plain
```

**Commit:** `test(perf): benchmark critical RunFlow journeys`

### Task 4.4: Criar coletor ADB/CDP/Perfetto

**Objective:** coletar memória do processo principal e renderers WebView.

**Files:**
- Create: `scripts/perf/run-journey.mjs`
- Create: `scripts/perf/android-processes.mjs`
- Create: `scripts/perf/webview-cdp.mjs`
- Create: `scripts/perf/perfetto-config.pbtxt`
- Create: `scripts/perf/analyze-results.mjs`
- Create: `docs/quality/performance-methodology.md`

**Metrics:** `am start -W`, PSS/private dirty/graphics, UID/processos WebView, heap JS pós-GC, DOM/listeners, FrameTimeline, `gfxinfo`, LCP/INP/CLS/Long Tasks, exit-info e logcat.

**Verification:** fixture conhecida gera JSON validado por schema; processo WebView errado deve falhar fechado.

**Commit:** `test(perf): add WebView memory and trace collectors`

### Task 4.5: Testar e finalizar Flyover 3D

**Objective:** provar que o cleanup atual funciona e adicionar qualidade adaptativa somente se medida.

**Files:**
- Create: `src/components/ActivityFlyover3D.test.tsx`
- Create: `src/lib/flyover3d/quality.ts`
- Create: `src/lib/flyover3d/quality.test.ts`
- Modify: `src/components/ActivityFlyover3D.tsx`

**RED:** um loop por montagem, cancelamento ao ocultar, retomada sem salto, dispose uma vez, fullscreen sincronizado ao sair pelo sistema e qualidade reduzida sob orçamento explícito.

**GREEN:** manter refs e 4–10 Hz; adicionar listener `fullscreenchange`; adaptar DPR/antialias/segmentos por tier definido pelo benchmark, não apenas por `navigator.deviceMemory`.

**Verification:** unitários + dez ciclos via coletor, sem crescimento monotônico além do gate.

**Commit:** `perf(webgl): verify cleanup and adaptive flyover quality`

### Task 4.6: Reduzir memória de heatmap e mapas

**Objective:** evitar carregar todo o histórico completo em memória simultaneamente.

**Files:**
- Modify: `src/components/PersonalHeatmap.tsx`
- Modify: `src/components/ActivityMap.tsx`
- Modify: `src/components/LiveMapTrack.tsx`
- Modify: `src/components/RouteMapOverlay.tsx`
- Create: `src/lib/heatmap-data.ts`
- Create: `src/lib/heatmap-data.test.ts`

**RED:** 1.000 atividades são processadas por lote e arrays intermediários são liberados; layers/listeners removidos ao desmontar.

**GREEN:** iterador paginado, simplificação apenas para renderização, estatísticas canônicas preservadas.

**Commit:** `perf(maps): stream heatmap data and release layers`

### Task 4.7: Criar budget de bundle

**Objective:** impedir bibliotecas pesadas no chunk inicial.

**Files:**
- Create: `scripts/perf/bundle-budget.mjs`
- Modify: `package.json`
- Modify somente após medir: componentes que importam `three`, `leaflet`, `peerjs`, `canvas-confetti`

**Gate:** `three` ausente do chunk inicial; limites por rota registrados no baseline; regressão >10% falha.

**Commit:** `perf(bundle): enforce route-level chunk budgets`

### Task 4.8: Executar baseline 4 GB e 8 GB

**Objective:** produzir prova reproduzível, não afirmação subjetiva.

**Files:**
- Create: `docs/quality/performance-baseline-android-13-17.md`

**Runs:** 20 startups; scroll 1.000; dez detalhes/mapas; dez Flyovers de 50.000 pontos; heatmap; gravação sintética; rotação/background; import/restore.

No API 37 executar:
```bash
adb shell am memory-limiter status
adb shell am memory-limiter manual <pid> <limite-em-MB>
adb shell dumpsys activity exit-info com.runflow.app.benchmark
```

**Gate:** P50/P95/P99, traces e delta; ausência de ANR/OOM/MemoryLimiter; estado final de memória dentro de `max(baseline + 10%, baseline + 20 MB)`.

**Commit:** `docs(perf): publish 4GB and 8GB benchmark baseline`

---

# Fase 5 — Android 13–17, permissões e remoção de legado

### Task 5.1: Preparar toolchain e AVDs dedicados

**Objective:** obter matriz real sem alterar o `Pixel_8` existente.

**Files:**
- Update only report: `docs/quality/current-state.md`

**Steps:**
1. Executar `sdkmanager.bat --list` e registrar IDs exatos; não confiar no comando antigo.
2. Instalar plataforma `platforms;android-37` e imagens ausentes API 33–36.
3. Reutilizar a imagem API 37 já instalada se saudável.
4. Criar AVDs visíveis: API33_4GB, API34_smoke, API35_smoke, API36_smoke, API37_4GB e API37_8GB.
5. Nunca usar o Galaxy A10 como gate desta matriz se ele estiver abaixo do Android 13.

**Verification:** `emulator.exe -list-avds` e leitura de cada `config.ini`; RAM e API precisam coincidir.

**Commit:** documentação apenas, se alterada.

### Task 5.2: Elevar compile/target para API 37

**Objective:** habilitar e testar os comportamentos do Android 17.

**Files:**
- Modify: `android/variables.gradle:2-4`
- Modify somente se necessário: `android/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties`, plugins Capacitor
- Modify: `README.md`

**Change:** manter `minSdkVersion=33`; alterar `compileSdkVersion=37` e `targetSdkVersion=37`.

**Verification:** compilar antes de atualizar dependências; corrigir somente incompatibilidades reais.
```bash
cd android
./gradlew testDebugUnitTest assembleDebug assembleBenchmark lintDebug lintRelease --console=plain
```

Confirmar SDK com `aapt2 dump badging`/`apkanalyzer`, não apenas Gradle.

**Commit:** `feat(android): target Android 17 API 37`

### Task 5.3: Implementar permissão runtime de rede local

**Objective:** manter P2P/WebDAV/LAN funcional no target 37.

**Files:**
- Create: `android/app/src/main/java/com/runflow/app/LocalNetworkPermissionPlugin.java`
- Modify: `android/app/src/main/java/com/runflow/app/MainActivity.java`
- Create: `src/lib/local-network.ts`
- Modify: `src/components/SyncPanel.tsx`
- Test: `src/lib/local-network.test.ts`
- Create: `android/app/src/androidTest/java/com/runflow/app/LocalNetworkPermissionTest.java`

**Native behavior:** API <37 retorna disponível sem prompt; API 37 verifica/solicita `ACCESS_LOCAL_NETWORK`; retorna `granted`, `denied` ou `prompt-with-rationale` sem lançar segredo/stack na UI.

**Registration:** registrar plugin antes de `super.onCreate(savedInstanceState)` conforme contrato Capacitor.

**RED:** P2P não inicia no API37 quando negado; offline permanece funcionando; retry após concessão funciona.

**Commit:** `feat(android): handle Android 17 local network permission`

### Task 5.4: Remover permissões Bluetooth legadas do manifesto mesclado

**Objective:** cumprir minSdk 33 sem legado API≤30 herdado do plugin.

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`
- Test: manifest merger/lint

Adicionar namespace `tools` e remoções explícitas:
```xml
<uses-permission
    android:name="android.permission.BLUETOOTH"
    tools:node="remove" />
<uses-permission
    android:name="android.permission.BLUETOOTH_ADMIN"
    tools:node="remove" />
```

Manter `BLUETOOTH_SCAN` e `BLUETOOTH_CONNECT`; validar `BleClient.requestDevice()` em API 33–37, negação, revogação e re-pareamento Android 17.

**Verification:** zero ocorrência no manifest mesclado debug/benchmark/release.

**Commit:** `refactor(android): remove pre-Android 13 Bluetooth permissions`

### Task 5.5: Remover permissão de notificações sem consumidor

**Objective:** não pedir acesso que o app não usa.

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

**Step:** confirmar novamente por busca que não existe Push/Local Notifications. Se continuar sem consumidor, remover `POST_NOTIFICATIONS`. Se existir consumidor novo, criar fluxo testado em vez de remover.

**Verification:** manifest mesclado e jornada sem prompt inesperado.

**Commit:** `refactor(android): remove unused notification permission`

### Task 5.6: Sincronizar idioma Android e WebView

**Objective:** manter uma única preferência PT-BR/EN entre Configurações do Android e perfil.

**Files:**
- Create: `android/app/src/main/java/com/runflow/app/AppLocalePlugin.java`
- Modify: `MainActivity.java`
- Create: `src/lib/app-locale.ts`
- Modify: `src/lib/i18n.tsx:1938-1984`
- Modify: `src/components/ProfilePageClient.tsx`
- Create: `src/lib/app-locale.test.ts`

**Precedence:** locale nativo explícito > preferência salva sincronizada > `navigator.language` > `pt`.

Ao trocar dentro do app: salvar perfil e chamar plugin nativo. Ao trocar nas configurações do sistema: locale nativo vence na próxima ativação e atualiza o perfil sem loop.

**Verification:** API33 e API37; troca no sistema e dentro do app; reinício preserva valor.

**Commit:** `feat(android): synchronize per-app locale with WebView`

### Task 5.7: Validar e endurecer áudio em background

**Objective:** manter Voice Coach/Auto-Pause dentro das regras do Android 17.

**Files:**
- Test first: `src/lib/voice-coach.test.ts`, `src/lib/workout-audio.test.ts`, `src/lib/auto-pause.test.ts`
- Modify conforme resultado: `voice-coach.ts`, `workout-audio.ts`, `auto-pause.ts`, `useWorkoutRecorder.ts`
- Criar serviço foreground somente se o teste real provar necessidade e a feature exigir áudio contínuo.

**Scenarios:** fala iniciada por ação visível, app vai background, foco de áudio negado, retorno foreground, treino encerrado cancela fala/contexto.

**Rule:** não adicionar serviço permanente preventivamente; YAGNI.

**Commit:** `fix(audio): comply with Android 17 background rules`

### Task 5.8: Large screens, multi-window e Predictive Back

**Objective:** garantir target37 em `sw>=600dp` e navegação previsível.

**Files:**
- Test: Playwright e Android UiAutomator
- Modify somente conforme falha: `AppLayout.tsx`, modais, `MainActivity.java`, integração `@capacitor/app`

**Scenarios:** resize/multi-window, orientação alterada, teclado visível, modal aberto, Flyover fullscreen, WebView history e saída do app.

**Gate:** Back fecha modal/fullscreen antes de navegar; navega histórico antes de sair; nenhum estado de gravação é perdido na rotação.

**Commit:** `fix(android): support large screens and predictive back`

### Task 5.9: StrictMode e grants URI explícitos

**Objective:** antecipar endurecimentos de segurança sem afetar release.

**Files:**
- Modify: `MainActivity.java` ou fonte debug específica
- Review: integração `@capacitor/share`, filesystem e `FileProvider`
- Create: instrumented test de compartilhamento/exportação

Ativar StrictMode somente em debug; verificar grants explícitos de leitura/escrita para intents de share/export; não expor caminhos internos.

**Commit:** `test(android): detect implicit URI grants in debug`

### Task 5.10: Auditoria final de legado ≤32

**Objective:** provar ausência no código próprio e artefato final.

**Files:**
- Create: `scripts/android/audit-legacy.mjs`
- Create: `docs/quality/android-legacy-audit.md`

**Audit:** `SDK_INT <=32`, `VERSION_CODES.S` e inferiores, `BLUETOOTH`, `BLUETOOTH_ADMIN`, `READ/WRITE_EXTERNAL_STORAGE`, `requestLegacyExternalStorage`, `values-vXX`, dependências e manifests mesclados.

**Verification:** cada ocorrência remanescente deve ter justificativa técnica; zero permissão legada no artefato.

**Commit:** `refactor(android): complete pre-Android 13 legacy removal`

---

# Fase 6 — Matriz final, relatórios e release gate técnico

### Task 6.1: Executar matriz funcional API 33–37

**Objective:** provar instalação, lançamento e jornadas críticas em cinco versões.

**Files:**
- Create: `docs/quality/android-13-17-compatibility.md`
- Create: `docs/quality/device-matrix.md`

**Per API:** instalar benchmark limpo; injetar fixture; onboarding; dashboard; lista/detalhe; gravação; import; rotas; perfil; BLE quando disponível; permissões; rotação; background; screenshots; UiAutomator; logcat; meminfo; exit-info.

**Gate:** API33 e API37 jornada completa; API34–36 smoke + matriz visual principal; qualquer não executado fica pendente.

**Commit:** `docs(android): publish API 33-37 compatibility matrix`

### Task 6.2: Executar regressão visual final

**Objective:** aprovar baselines revisados humanamente.

**Files:**
- Create/update: `tests/e2e/__screenshots__/`
- Create: `docs/quality/visual-e2e-report.md`

**Matrix controlada:** nove viewports no tema principal; pares críticos de temas/fontes; 200% em 360×640, 844×390 e tablet; APK completo API33/API37.

Snapshots só podem ser atualizados por comando explícito e revisão humana.

**Commit:** `test(visual): approve RunFlow responsive baselines`

### Task 6.3: Comparar performance antes/depois

**Objective:** publicar deltas honestos com ruído e regressões.

**Files:**
- Create: `docs/quality/performance-final.md`

Executar os mesmos datasets, RAM, AVD, WebView, iterações e scripts do baseline. Registrar P50/P95/P99, tamanho de APK/chunks, PSS, heap, jank, startup, LCP/INP/CLS e dez ciclos WebGL/mapas.

**Gate:** nenhuma regressão >10% sem justificativa aprovada; nenhuma alegação de “150 MB” sem tabela e trace.

**Commit:** `docs(perf): publish verified final performance results`

### Task 6.4: Rodar todos os gates técnicos

**Objective:** validar o entregável completo antes de documentação final.

```bash
npm ci
npm run lint
npm run test
npm run test:e2e:visual
npm run build
npm run perf:bundle
npx cap sync android
cd android
./gradlew testDebugUnitTest assembleDebug assembleAndroidTest lintDebug lintRelease --console=plain
./gradlew assembleBenchmark --console=plain
./gradlew connectedDebugAndroidTest --console=plain
./gradlew :macrobenchmark:connectedBenchmarkAndroidTest --console=plain
```

Depois:
- verificar APKs e bytes;
- validar package/version/min/target com SDK tools;
- instalar em API33/API37;
- abrir `com.runflow.app/.MainActivity` e benchmark equivalente;
- revisar logcat, StrictMode, ANR/OOM, WebView e MemoryLimiter;
- `git diff --check`;
- revisar segredos, dados pessoais e artefatos gerados.

**Expected:** todos verdes. Gate não executado não pode ser tratado como aprovado.

### Task 6.5: Corrigir documentação e status do roadmap

**Objective:** alinhar documentação aos fatos comprovados.

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `CHANGELOG.md`
- Cross-link: todos os relatórios em `docs/quality/`

Somente marcar Fase 4 como concluída se Tasks 6.1–6.4 estiverem integralmente verdes. Caso contrário, marcar “em validação” e listar bloqueadores reais.

**Commit:** `docs(quality): reconcile roadmap with verified E2E evidence`

### Task 6.6: Revisão independente e entrega Git

**Objective:** impedir que o executor aprove o próprio trabalho sem segunda leitura.

**Steps:**
1. revisão de conformidade contra este plano;
2. revisão de qualidade focada em migração, permissões, privacidade, memória e acessibilidade;
3. corrigir achados e repetir gates afetados;
4. revisar `git status`, diff e histórico;
5. somente com autorização: push;
6. verificar SHA local/remoto idêntico.

**Final report deve conter:** comandos e resultados reais, APKs/caminhos/tamanhos, AVDs/APIs/RAM, jornadas, métricas antes/depois, limitações, SHA e estado remoto.

---

## 3. Ordem obrigatória e dependências

```text
Fase 0 baseline
  ↓
Fase 1 integridade IndexedDB v7 (bloqueia todo o restante)
  ↓
Fase 2 paginação/virtualização
  ↓
Fase 3 visual + responsividade
  ↓
Fase 4 benchmark/performance/memória
  ↓
Fase 5 target API37 + permissões + legado
  ↓
Fase 6 matriz final + documentação
```

Não iniciar otimizações de memória sobre a migração v6 defeituosa. Não atualizar snapshots antes de corrigir a funcionalidade. Não elevar o ROADMAP a concluído antes dos relatórios finais.

## 4. Riscos, trade-offs e rollback

| Risco | Mitigação |
|---|---|
| Migração v7 perder dados | fixtures v5/v6, transação única, abort explícito, export normalizado e restauração |
| Remover store legado quebrar sync | reconstrução testada antes da exclusão; mesmo payload normalizado |
| Virtualização prejudicar acessibilidade | altura dinâmica, foco, botão fallback, teste 200% e screen reader semantics |
| Target 37 quebrar plugin | compilar primeiro; atualizar somente dependência comprovadamente incompatível |
| Permissão LAN aparecer cedo | solicitar apenas no fluxo P2P/WebDAV/LAN iniciado pelo usuário |
| Áudio exigir foreground service | teste real primeiro; serviço somente se necessário |
| AVD representar mal aparelho real | combinar 4/8 GB, MemoryLimiter, Perfetto e declarar limite do emulador |
| Matriz visual explodir em combinações | cobertura pairwise para temas/fontes e completa nas dimensões críticas |
| Macrobenchmark medir build errado | package benchmark isolado, non-debuggable/profileable e manifest verificado |
| Relatórios poluírem Git | versionar resumo/snapshots aprovados; traces/heaps em `.hermes/artifacts/` |

## 5. Pontos de acesso durante a futura execução

- Web local: `http://127.0.0.1:3000/`
- APK principal: `com.runflow.app/.MainActivity`
- APK benchmark: `com.runflow.app.benchmark/.MainActivity`
- APK debug esperado: `E:\projetos\runflow-app\android\app\build\outputs\apk\debug\app-debug.apk`
- Artefatos temporários: `E:\projetos\runflow-app\.hermes\artifacts\runflow-e2e\`

## 6. Checklist de revisão do plano

- [x] Integridade de dados precede performance.
- [x] TDD RED→GREEN definido para cada mudança comportamental.
- [x] Arquivos e comandos principais são explícitos.
- [x] Dados sintéticos e isolamento estão obrigatórios.
- [x] Matriz visual web e APK estão separadas.
- [x] 4 GB e 8 GB possuem prova de memória, não apenas configuração.
- [x] Android 13–17 possui cobertura real e target37 confirmado.
- [x] Permissões legadas são verificadas no manifest mesclado.
- [x] Atualização do roadmap depende dos gates.
- [x] Push depende de autorização e SHA remoto verificado.

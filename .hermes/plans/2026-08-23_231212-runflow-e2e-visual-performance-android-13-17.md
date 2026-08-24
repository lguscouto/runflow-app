# RunFlow — Plano de Implementação E2E Visual, Performance e Android 13–17

> **Para o Hermes:** executar tarefa por tarefa, com medição antes/depois e revisão independente por fase. A antiga skill `subagent-driven-development` não está instalada neste perfil; não depender dela.

**Objetivo:** tornar o RunFlow visualmente robusto nas resoluções e proporções representativas do mercado, previsível em aparelhos com 4 GB a 8 GB de RAM e plenamente testado do Android 13 (API 33) ao Android 17 (API 37), removendo suporte e código exclusivos do Android 12 ou anterior.

**Arquitetura:** abordagem *measurement-first* em duas camadas: testes web reproduzíveis para o conteúdo Next.js e testes do APK Capacitor em emuladores Android reais. A otimização será guiada por screenshots, traces, PSS/RSS, heap JavaScript, jank e tempos de jornada; dados pessoais não serão usados. Mudanças de persistência serão migradas de forma transacional e testadas com fixtures sintéticas.

**Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, IndexedDB/idb 8, Capacitor 7, Android Gradle Plugin 8.13, Java 21, Playwright, Vitest/fake-indexeddb, ADB, UiAutomator, Chrome DevTools Protocol, Perfetto e Android Studio Profiler.

---

## 1. Contexto verificado em 23/08/2026

O repositório ativo é `E:\projetos\runflow-app`.

### Estado atual confirmado

- App híbrido Next.js + Capacitor, pacote Android `com.runflow.app`.
- `minSdkVersion = 33`, mas `compileSdkVersion = 35` e `targetSdkVersion = 35` em `android/variables.gradle`.
- SDKs instalados: API 34, 35 e 36.1; não há SDK/imagem API 33 nem API 37 instalados.
- Existe apenas o AVD `Pixel_8`.
- Não existem arquivos `*.test.*` nem `*.spec.*` no repositório.
- O commit `5fa60a4` e o `ROADMAP.md` declaram a Fase 4 como concluída, mas não há suíte E2E, matriz de dispositivos, baselines visuais nem relatórios de memória versionados que comprovem essa conclusão.
- A árvore está limpa, exceto por `IDEA.md` não rastreado, que não será alterado nem incorporado sem decisão explícita.

### Lacunas técnicas já identificadas

1. **Android 17 ainda não é alvo de compilação:** target/compile permanecem na API 35; a documentação oficial trata o suporte completo ao Android 17 como target API 37.
2. **Debug remoto está habilitado em toda variante:** `MainActivity.java` chama `WebView.setWebContentsDebuggingEnabled(true)` sem verificar `BuildConfig.DEBUG`.
3. **Mixed content está liberado globalmente:** `capacitor.config.ts` contém `allowMixedContent: true`; isso precisa ser substituído por política mínima e explícita.
4. **A suposta leitura leve ainda desserializa o registro pesado:** `getAllStoredSummaries()` percorre `cursor.value` no store `activities`, cujo valor contém `points`. O IndexedDB entrega o objeto completo antes de `toActivitySummary()` descartar os pontos.
5. **A lista não está realmente virtualizada:** `ActivityList.tsx` acrescenta 25 nós por vez e nunca remove os anteriores; a árvore DOM cresce até conter todos os treinos.
6. **O loop 3D gera churn:** `ActivityFlyover3D.tsx` atualiza estados React por frame e recria o efeito de animação sempre que `progress` muda, pressionando CPU/GC.
7. **Não há prova da alegação “recuperação de 150 MB+”:** a limpeza Three.js existe, mas não há medição antes/depois nem teste repetido de vazamento.
8. **Preferência de idioma por app não foi implementada nativamente:** não há `localeConfig` nem recurso `locales_config.xml`, apesar da alegação no roadmap.
9. **Android 17 introduz limites de memória por RAM:** é obrigatório testar o `MemoryLimiter` no API 37, especialmente porque o escopo cita aparelhos de 4 GB a 8 GB.
10. **Funcionalidades afetadas pelo Android 17:** sincronização LAN/WebDAV/P2P, BLE e áudio/Voice Coach precisam de testes específicos para `ACCESS_LOCAL_NETWORK`, Bluetooth e endurecimento de áudio em background.

### Fontes oficiais de referência

- Migração Android 17: https://developer.android.com/about/versions/17/migration
- Mudanças Android 17 para todos os apps: https://developer.android.com/about/versions/17/behavior-changes-all
- Mudanças para apps target API 37: https://developer.android.com/about/versions/17/behavior-changes-17
- Medição de performance: https://developer.android.com/topic/performance/measuring-performance
- Gestão de memória: https://developer.android.com/topic/performance/memory

---

## 2. Premissas, limites e proteção dos dados

- O escopo é o RunFlow; nenhuma feature nova será criada salvo o necessário para compatibilidade, teste ou otimização.
- Todos os testes usarão **fixtures sintéticas** em pacote/variante isolada. Nunca usar IndexedDB, arquivos GPX/FIT, rotas, perfil ou histórico real do usuário.
- O emulador deve sempre abrir com janela visível; não usar `-no-window`.
- O build de benchmark deverá usar `applicationIdSuffix ".benchmark"` ou solução equivalente para não sobrescrever `com.runflow.app` instalado.
- Antes de qualquer migração IndexedDB, o teste precisa provar preservação, idempotência e falha segura. Downgrade para uma versão antiga do app após elevar o schema não é um rollback confiável; o plano exige backup/exportação e teste de restauração.
- A tarefa não inclui publicar na Play Store, criar keystore de produção nem fazer release pública.
- Commits e push só ocorrerão durante a execução autorizada. Como `.cursorrules` exige push para alterações de código, cada fase concluída deverá ser validada antes do commit/push, sem misturar `IDEA.md`.

---

## 3. Matriz E2E obrigatória

### 3.1 Versões Android

| Plataforma | API | Cobertura mínima |
|---|---:|---|
| Android 13 | 33 | jornada completa, permissões, BLE, importação, gravação e restauração |
| Android 14 | 34 | smoke funcional e visual |
| Android 15 | 35 | edge-to-edge, barras do sistema, teclado e matriz visual principal |
| Android 16 | 36/36.1 | telas adaptativas, paisagem, permissões e smoke completo |
| Android 17 | 37 | jornada completa, target 37, MemoryLimiter, LAN, áudio e compat changes |

A execução será dividida em dois passes:

1. APK atual com target 35 rodando em API 33–37, para detectar mudanças que afetam todos os apps.
2. APK atualizado para target 37 rodando novamente em API 33–37, para detectar mudanças condicionadas ao target.

### 3.2 Viewports e formatos representativos

As dimensões abaixo são **dp/CSS pixels**, não pixels físicos:

| Classe | Viewport | Proporção/uso |
|---|---:|---|
| Compacto antigo | 360 × 640 | 16:9 |
| Compacto moderno | 360 × 800 | 20:9 |
| Telefone comum | 390 × 844 | ~19,5:9 |
| Telefone grande | 412 × 915 | ~20:9 |
| Telefone XL | 480 × 1040 | alta densidade |
| Tablet compacto | 600 × 960 | `sw600dp` |
| Tablet | 800 × 1280 | large screen |
| Paisagem telefone | 844 × 390 | HUD, mapas e teclado |
| Paisagem tablet | 1280 × 800 | layout adaptativo API 36/37 |

Variações adicionais:

- `font_scale`: 1.0, 1.3, 1.5 e 2.0;
- tema normal, Modo Sol, Noite AMOLED e Neo;
- navegação por gestos e por três botões;
- teclado aberto em formulários;
- recorte/notch e safe areas;
- rotação durante gravação e durante modal aberto.

### 3.3 Jornadas e estados visuais

Cobrir pelo menos:

1. onboarding;
2. dashboard `/` vazio e com histórico;
3. atividades `/atividades/` com 0, 25, 100 e 1.000 resumos;
4. detalhe `/atividades/ver/?id=<fixture>` com mapas, gráficos, splits e Flyover 3D;
5. gravação `/gravar/` em corrida e ciclismo, retrato e paisagem;
6. importação `/importar/` com sucesso e arquivo inválido;
7. rotas `/rotas/` e `/rotas/criar/`;
8. heatmap `/heatmap/`;
9. perfil `/perfil/`, garagem e configurações;
10. Workout Builder, Social Card, Auto-Pause, Voice Coach e bottom sheets;
11. permissão negada/aceita para localização, Bluetooth, notificações e rede local;
12. background/foreground durante gravação, Voice Coach, GPS e BLE.

---

## 4. Critérios de aceite

### Visual e acessibilidade

- zero overflow horizontal involuntário, corte de telemetria, conteúdo sob barras do sistema ou controles inacessíveis;
- touch targets interativos ≥ 48 dp; no Glove Mode, ≥ 64 dp;
- fluxo utilizável com fonte a 200%, sem esconder ações primárias;
- contraste, foco visível, nomes acessíveis e `aria-current`/estado selecionado nas navegações;
- mapas, gráficos, canvas e bottom sheets redimensionam sem tela preta, distorção ou vazamento;
- screenshots aprovados para todas as combinações críticas; diferenças não aprovadas falham o gate.

### Performance

Os relatórios devem registrar P50/P95/P99 e comparar baseline com versão otimizada.

- nenhuma regressão > 10% em startup, INP, jank, PSS ou heap sem justificativa aprovada;
- LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 nas jornadas web locais;
- jank < 5% em scroll e transições; frame P95 dentro do orçamento do refresh rate do AVD;
- 1.000 resumos e um detalhe com 50.000 trackpoints continuam utilizáveis em AVD de 4 GB;
- após 10 ciclos abrir/fechar mapa, heatmap e Flyover 3D, PSS e heap JS pós-GC não podem crescer monotonicamente; estado final ≤ `max(baseline + 10%, baseline + 20 MB)`;
- nenhuma ocorrência de ANR, OOM, low-memory kill ou `MemoryLimiter:AnonSwap`;
- Flyover e mapas devem parar trabalho quando ocultos e liberar listeners, `requestAnimationFrame`, geometrias, materiais, texturas, layers e contexto WebGL ao desmontar;
- startup cold/warm/hot será comparado aos objetivos oficiais do Android; qualquer desvio deve ter trace e causa documentados, não ser ocultado.

### Compatibilidade Android

- `minSdk = 33`, `compileSdk = 37`, `targetSdk = 37` no artefato final;
- APK instala, inicia e conclui a jornada em API 33, 34, 35, 36 e 37;
- nenhum ramo, permissão, recurso ou dependência existe exclusivamente para API ≤ 32;
- manifest principal e manifest mesclado não reintroduzem permissões legadas;
- WebView debugging desativado em release/benchmark não-debug;
- política de rede não permite mixed content global sem justificativa e consentimento explícito;
- permissões de Android 13–17 têm UX de concessão, negação e “não perguntar novamente” testada;
- nenhum `FATAL EXCEPTION`, StrictMode relevante, acesso non-SDK restrito ou erro WebView no logcat.

---

# 5. Plano de implementação

## Fase 0 — Congelar baseline e criar evidência reproduzível

### Tarefa 0.1: registrar boundary Git e ambiente

**Arquivos:**
- Criar: `docs/quality/android-e2e-baseline.md`
- Criar: `.hermes/artifacts/runflow-e2e/.gitkeep`
- Modificar: `.gitignore`

**Passos:**

1. Registrar branch, SHA, `git status`, Node/npm, Java, Gradle, AGP, Capacitor, WebView, SDKs e AVDs.
2. Não adicionar `IDEA.md` ao Git.
3. Ignorar traces, heaps, vídeos, dumps e screenshots temporários em `.hermes/artifacts/runflow-e2e/`.
4. Guardar apenas relatórios consolidados e baselines visuais revisados no Git.
5. Confirmar que o build atual é reproduzível antes de qualquer correção.

**Comandos de verificação:**

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew testDebugUnitTest assembleDebug --console=plain
```

**Resultado esperado:** build web e APK debug verdes, ou baseline documentado com falha real e causa.

### Tarefa 0.2: separar variante de teste/benchmark

**Arquivos:**
- Modificar: `android/app/build.gradle`
- Criar: `android/app/src/benchmark/AndroidManifest.xml`
- Modificar: `android/app/src/main/java/com/runflow/app/MainActivity.java`
- Criar: `android/app/src/debug/java/com/runflow/app/DebugWebViewConfig.java` se necessário

**Passos:**

1. Criar variante `benchmark` release-like, `profileableByShell`, com `applicationIdSuffix ".benchmark"`.
2. Manter WebView debugging apenas em builds explicitamente debugáveis.
3. Garantir que `release` não contém `android:debuggable="true"` nem debugging remoto.
4. Permitir fixture injection somente na variante benchmark, inacessível no release.
5. Validar os manifests mesclados de debug, benchmark e release.

---

## Fase 1 — Infraestrutura de teste visual e fixtures

### Tarefa 1.1: introduzir testes TypeScript e IndexedDB isolado

**Arquivos:**
- Modificar: `package.json`
- Modificar: `package-lock.json`
- Criar: `vitest.config.ts`
- Criar: `tests/setup/indexeddb.ts`
- Criar: `tests/fixtures/activityFactory.ts`
- Criar: `tests/fixtures/datasets.ts`

**Passos:**

1. Adicionar Vitest e `fake-indexeddb`.
2. Gerar fixtures determinísticas com seed fixa:
   - 0, 25, 100 e 1.000 resumos;
   - detalhes com 1.000, 10.000 e 50.000 trackpoints;
   - corrida e ciclismo, altitude, FC, potência e cadência;
   - estados vazios, dados incompletos e registros da versão atual do DB.
3. Proibir leitura do IndexedDB real do navegador ou do APK.
4. Adicionar scripts `test`, `test:watch` e `test:storage`.

### Tarefa 1.2: criar matriz Playwright para visual web

**Arquivos:**
- Modificar: `package.json`
- Modificar: `package-lock.json`
- Criar: `playwright.config.ts`
- Criar: `tests/e2e/visual/navigation.spec.ts`
- Criar: `tests/e2e/visual/activities.spec.ts`
- Criar: `tests/e2e/visual/recording.spec.ts`
- Criar: `tests/e2e/visual/routes-profile.spec.ts`
- Criar: `tests/e2e/helpers/seedIndexedDb.ts`
- Criar: `tests/e2e/helpers/visualAssertions.ts`
- Criar: `tests/e2e/__screenshots__/`

**Passos:**

1. Configurar os nove viewports da matriz.
2. Semear IndexedDB antes de cada cenário.
3. Capturar página inteira e regiões críticas.
4. Falhar em overflow horizontal, elementos fora do viewport, overlap, touch target < 48 px e texto truncado sem intenção.
5. Executar com temas e escalas de fonte definidas.
6. Criar baseline somente após revisão humana das imagens.

**Comandos:**

```bash
npm run dev
npm run test:e2e:visual
npm run test:e2e:visual -- --update-snapshots
```

A atualização de snapshots não pode ocorrer automaticamente no CI.

### Tarefa 1.3: automatizar screenshots do APK

**Arquivos:**
- Criar: `scripts/android/avd-matrix.json`
- Criar: `scripts/android/run-visual-matrix.mjs`
- Criar: `scripts/android/adb-screenshot.mjs`
- Criar: `scripts/android/reset-device-state.mjs`
- Criar: `docs/quality/visual-matrix.md`

**Passos:**

1. Usar ADB por `child_process` e gravar PNG como bytes; não usar pipes MSYS para binários.
2. Alterar `wm size`, `wm density`, `font_scale`, rotação e modo de navegação de forma reversível.
3. Abrir sempre AVD com janela.
4. Restaurar configurações em bloco `finally`, mesmo se um teste falhar.
5. Capturar barras do sistema, teclado, permissões e app completo.
6. Produzir índice HTML/Markdown lado a lado por API, viewport e estado.

---

## Fase 2 — Correção visual responsiva

### Tarefa 2.1: consolidar tokens responsivos e safe areas

**Arquivos:**
- Modificar: `src/app/globals.css`
- Modificar: `src/components/AppLayout.tsx`
- Criar: `src/lib/layout.ts`
- Testar: `tests/e2e/visual/navigation.spec.ts`

**Passos:**

1. Criar tokens de largura, espaçamento, altura de navegação e tipografia fluida.
2. Usar `100dvh` com fallback e safe areas em quatro lados.
3. Calcular padding inferior como navegação + `safe-area-inset-bottom`, evitando valores duplicados (`pb-24` + barra fixa).
4. Adicionar `aria-current="page"`, rótulos traduzidos e foco visível.
5. Garantir navegação funcional com 200% de fonte e 360 dp de largura.
6. Remover `aria-label="Navegação Principal"` hardcoded e usar i18n.

### Tarefa 2.2: corrigir telas densas, HUDs e gráficos

**Arquivos prioritários:**
- `src/components/RecordWorkoutClient.tsx`
- `src/components/BikeComputerHud.tsx`
- `src/components/StructuredWorkoutHud.tsx`
- `src/components/ClimbProHudCard.tsx`
- `src/components/LiveElevationProfile.tsx`
- `src/components/ActivityDetailClient.tsx`
- `src/components/ActivityCharts.tsx`
- `src/components/ActivitySplits.tsx`
- `src/components/SimpleLineChart.tsx`
- `src/components/PowerDurationCurve.tsx`
- `src/components/ActivityMap.tsx`
- `src/components/LiveMapTrack.tsx`
- `src/components/PersonalHeatmap.tsx`

**Passos:**

1. Corrigir somente falhas reproduzidas na matriz.
2. Evitar alturas fixas incompatíveis com fonte grande e paisagem.
3. Garantir `ResizeObserver`/redimensionamento correto de canvas, SVG, Leaflet e WebGL.
4. Manter telemetria essencial acima da dobra em 360 × 640 e paisagem.
5. Preservar uso com uma mão e Glove Mode.
6. Testar rotação sem perder treino, cronômetro, sensores ou mapa.

### Tarefa 2.3: corrigir modais e bottom sheets

**Arquivos:**
- `src/components/WorkoutBuilderModal.tsx`
- `src/components/WorkoutLibraryModal.tsx`
- `src/components/SocialShareCardModal.tsx`
- `src/components/AutoPauseModal.tsx`
- `src/components/VoiceCoachModal.tsx`
- `src/components/BikeGarageManager.tsx`
- `src/components/ProfilePageClient.tsx`

**Passos:**

1. Garantir trap de foco, Escape/Back, backdrop e retorno de foco.
2. Aplicar altura máxima com scroll interno e safe area.
3. Impedir botões primários sob teclado/barra de gestos.
4. Cobrir 360 × 640, paisagem e fonte 200%.
5. Validar Predictive Back no APK, não apenas no navegador.

---

## Fase 3 — Baseline E2E de CPU, renderização e memória

### Tarefa 3.1: criar coletor Android/WebView

**Arquivos:**
- Criar: `scripts/perf/run-journey.mjs`
- Criar: `scripts/perf/android-processes.mjs`
- Criar: `scripts/perf/webview-cdp.mjs`
- Criar: `scripts/perf/perfetto-config.pbtxt`
- Criar: `scripts/perf/analyze-results.mjs`
- Criar: `docs/quality/performance-methodology.md`

**Métricas:**

- `am start -W`: TotalTime/WaitTime;
- `dumpsys meminfo`: PSS, private dirty, Java/native/graphics;
- processos WebView renderer/sandbox associados ao UID do app;
- CDP: `Runtime.getHeapUsage`, DOM nodes, event listeners e heap pós-GC em build debug;
- Perfetto: scheduling, frequência CPU, frames, WebView, GC e I/O;
- `dumpsys gfxinfo` e FrameTimeline;
- LCP, INP, CLS e Long Tasks no conteúdo web;
- `dumpsys activity exit-info` e logcat para ANR/OOM/MemoryLimiter.

### Tarefa 3.2: executar cenários de carga sintética

**Cenários:**

1. cold/warm/hot start, 20 repetições;
2. scroll de 1.000 atividades, 10 repetições;
3. abrir/fechar detalhe e mapa, 10 ciclos;
4. abrir/fechar Flyover 3D com 50.000 pontos, 10 ciclos;
5. alternar heatmap/filtros, 10 ciclos;
6. gravação de 30 minutos simulados com GPS/BLE sintéticos;
7. background/foreground e rotação, 20 ciclos;
8. importação e backup/restauração de datasets grandes.

Executar em AVD de 4 GB e 8 GB, com relatório separado. No API 37, executar também:

```bash
adb shell am memory-limiter status
adb shell am memory-limiter manual <pid> <limite-medido>
adb shell dumpsys activity exit-info com.runflow.app.benchmark
```

O limite manual deverá ser derivado do baseline e aplicado gradualmente; nunca escolher um valor arbitrário que só produza crash.

### Tarefa 3.3: publicar relatório baseline

**Arquivo:**
- Criar: `docs/quality/performance-baseline-android-13-17.md`

O relatório deve conter dispositivo, API, RAM, WebView, commit, fixture, repetições, P50/P95/P99, trace, gráfico antes/depois e lacunas. Não aceitar frases como “reduziu 150 MB” sem tabela reproduzível.

---

## Fase 4 — Persistência IndexedDB e paginação de verdade

### Tarefa 4.1: testar o comportamento atual e escrever RED

**Arquivos:**
- Criar: `src/lib/storage.test.ts`
- Criar: `tests/fixtures/legacyDbV5.ts`

**Testes RED:**

1. listagem de resumos não deve clonar/desserializar `points`;
2. página de 50 itens não deve carregar os demais registros;
3. detalhe deve recompor summary + track sem perda;
4. migração v5→v6 deve preservar todos os campos;
5. migração repetida deve ser idempotente;
6. falha interrompida não pode deixar stores parcialmente migrados.

### Tarefa 4.2: separar summary e track/detail

**Arquivos:**
- Modificar: `src/lib/storage.ts`
- Modificar: `src/lib/activities.ts`
- Modificar: `src/lib/types.ts`
- Modificar: `src/lib/sync/merger.ts`
- Modificar: `src/lib/sync/webdav.ts`
- Modificar: backup/importação relacionado, após busca de chamadas
- Testar: `src/lib/storage.test.ts`

**Desenho:**

- elevar DB para v6;
- criar `activitySummaries` com índice `by-started`;
- criar `activityDetails`/`activityTracks` separado, chaveado por `activityId`;
- `putActivity()` escreve ambos em uma única transação;
- `getStoredActivity()` faz join;
- listagens percorrem apenas `activitySummaries`;
- migração usa a transação `versionchange` e cursor do store v5;
- backup/export/sync continuam capazes de reconstruir um registro completo.

**Gate:** comparar conteúdo exportado antes/depois byte a byte após normalização de ordem e datas.

### Tarefa 4.3: paginação por cursor e virtualização real

**Arquivos:**
- Modificar: `src/lib/storage.ts`
- Modificar: `src/lib/activities.ts`
- Modificar: `src/components/ActivitiesPageClient.tsx`
- Modificar: `src/components/ActivityList.tsx`
- Modificar: `package.json`/`package-lock.json` se um virtualizador for adotado
- Testar: `tests/e2e/visual/activities.spec.ts`

**Passos:**

1. API de página retorna `{items, nextCursor, hasMore}`.
2. Cursor combina data + ID para paginação estável quando datas coincidem.
3. A UI solicita páginas sob demanda.
4. Usar virtualização real (`@tanstack/react-virtual` ou implementação equivalente validada), removendo nós fora da janela.
5. Preservar foco, leitura por screen reader, retorno de navegação e link direto.
6. Provar por teste que DOM permanece limitado com 1.000 itens.

---

## Fase 5 — Otimização de WebGL, mapas e cálculos

### Tarefa 5.1: estabilizar loop do Flyover 3D

**Arquivos:**
- Modificar: `src/components/ActivityFlyover3D.tsx`
- Criar: `src/components/ActivityFlyover3D.test.tsx` ou teste de controlador extraído
- Criar: `src/lib/flyover3d/playbackController.ts`

**Passos:**

1. Manter um único `requestAnimationFrame` estável por montagem.
2. Armazenar progresso por frame em `useRef`; atualizar UI React em frequência limitada, por exemplo 4–10 Hz.
3. Não recriar efeito a cada frame.
4. Pausar ao ocultar app/documento e retomar sem delta acumulado.
5. Liberar frame, listeners, renderer, contexto, geometrias, materiais e texturas uma única vez.
6. Testar 10 ciclos e comparar heap/PSS pós-GC.
7. Definir qualidade adaptativa medida: pixel ratio, antialias, segmentos e resolução, sem depender exclusivamente de `navigator.deviceMemory`.

### Tarefa 5.2: reduzir custo de GPS, Leaflet e heatmap

**Arquivos:**
- Modificar: `src/lib/geo.ts`
- Modificar: `src/components/ActivityMap.tsx`
- Modificar: `src/components/LiveMapTrack.tsx`
- Modificar: `src/components/PersonalHeatmap.tsx`
- Modificar: `src/components/RouteMapOverlay.tsx`
- Criar: `src/workers/geo.worker.ts` se o trace justificar
- Criar: `src/lib/geo.test.ts`

**Passos:**

1. Criar testes de fidelidade e performance para Douglas–Peucker.
2. Eliminar recursão/slices excessivos se traces mostrarem pressão; preferir implementação iterativa.
3. Executar simplificação pesada em Web Worker quando necessário.
4. Adaptar tolerância ao zoom sem alterar distância/estatísticas originais.
5. Remover layers/listeners ao desmontar.
6. Nunca usar trilha simplificada para cálculos canônicos, apenas renderização.

### Tarefa 5.3: bundle, chunks e cálculo intensivo

**Arquivos:**
- Modificar: componentes que importam `three`, `leaflet`, `peerjs` e `canvas-confetti`
- Criar: `scripts/perf/bundle-budget.mjs`
- Modificar: `package.json`

**Passos:**

1. Medir chunks antes de alterar imports.
2. Carregar bibliotecas pesadas somente nas rotas que as usam.
3. Confirmar que `three` não entra no chunk inicial.
4. Memoizar apenas cálculos comprovadamente caros; não aplicar `useMemo` indiscriminadamente.
5. Criar budget de bundle inicial e por rota com regressão máxima definida pelo baseline.

---

## Fase 6 — Android 13–17 e remoção de legado

### Tarefa 6.1: instalar toolchain e AVDs faltantes

**Pré-requisito mutável, executar somente após autorização:**

```bash
"C:/Users/gustavo/AppData/Local/Android/Sdk/cmdline-tools/latest/bin/sdkmanager.bat" \
  "platforms;android-33" \
  "platforms;android-37" \
  "system-images;android-33;google_apis;x86_64" \
  "system-images;android-37;google_apis;x86_64"
```

Criar AVDs visíveis dedicados, por exemplo `RunFlow_API_33_4GB` e `RunFlow_API_37_8GB`, sem alterar o `Pixel_8` existente.

### Tarefa 6.2: migrar compile/target para API 37

**Arquivos:**
- Modificar: `android/variables.gradle`
- Modificar: `android/app/build.gradle`
- Modificar: `package.json`/`package-lock.json` somente se Capacitor/plugins precisarem de versão compatível
- Atualizar: `README.md`

**Passos:**

1. Manter `minSdkVersion = 33`.
2. Alterar `compileSdkVersion` e `targetSdkVersion` para 37.
3. Verificar AGP, Gradle, Java e plugins Capacitor contra documentação/metadata real.
4. Revisar mudanças Android 13, 14, 15, 16 e 17, inclusive compat toggles.
5. Compilar antes de atualizar dependências; atualizar apenas o necessário.
6. Verificar metadata real com `aapt2`/`apkanalyzer`, não apenas o arquivo Gradle.

### Tarefa 6.3: permissões, LAN, BLE e áudio

**Arquivos prováveis:**
- Modificar: `android/app/src/main/AndroidManifest.xml`
- Criar/Modificar: `android/app/src/main/res/xml/network_security_config.xml`
- Modificar: `android/app/src/main/java/com/runflow/app/MainActivity.java`
- Criar: plugin/bridge nativo de permissão em `android/app/src/main/java/com/runflow/app/` se Capacitor 7 não expuser API 37
- Modificar: `src/lib/sync/*`, `src/lib/ble*`, `src/lib/voice*` conforme inventário
- Modificar: `capacitor.config.ts`

**Passos:**

1. Adicionar e solicitar `ACCESS_LOCAL_NETWORK` no API 37 apenas quando P2P/WebDAV/LAN for usado.
2. Testar concessão, negação e revogação sem quebrar recursos offline.
3. Verificar BLE scan/connect no API 33–37 e re-pareamento no Android 17.
4. Testar Voice Coach e áudio quando o app vai para background; adaptar lifecycle/foreground service apenas se necessário e permitido.
5. Substituir `allowMixedContent: true` por HTTPS obrigatório ou configuração de rede mínima por domínio/uso explícito. Não criar whitelist aberta.
6. Garantir flags explícitas de grant URI em share/export, conforme comportamento futuro indicado pelo Android 17.
7. Executar StrictMode em debug para non-SDK APIs e grants implícitos.

### Tarefa 6.4: idioma por app e large screens

**Arquivos:**
- Criar: `android/app/src/main/res/xml/locales_config.xml`
- Modificar: `android/app/src/main/AndroidManifest.xml`
- Modificar: bridge/i18n nativo e `src/lib/i18n.ts`, se necessário
- Testar: API 33 e 37

**Passos:**

1. Declarar `pt-BR` e `en` no locale config.
2. Sincronizar preferência nativa com o i18n do conteúdo WebView sem loop ou perda do idioma salvo.
3. Testar troca pelo sistema e dentro do app.
4. Validar resize, multi-window e large screen `sw600dp` no target 37; não depender de bloqueio de orientação/aspect ratio.

### Tarefa 6.5: remover legado ≤ Android 12 com prova

**Arquivos:** todos os arquivos Android/TS encontrados pelo inventário; não remover por busca textual cega.

**Checklist:**

- remover branches `SDK_INT <= 32`, `VERSION_CODES.S` ou inferiores usados apenas como fallback;
- remover permissões `BLUETOOTH`, `BLUETOOTH_ADMIN`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` e `requestLegacyExternalStorage`, inclusive de manifests mesclados;
- remover polyfills de WebView só após confirmar a versão mínima do Android System WebView suportada no API 33;
- remover recursos `values-vXX` e código JavaScript que não têm consumidor em API 33+;
- remover dependências nativas exclusivamente legadas;
- manter código que ainda é necessário por comportamento de plugins, formato de backup ou compatibilidade de dados, documentando o motivo.

**Comandos de auditoria:**

```bash
./gradlew :app:processDebugMainManifest :app:processReleaseMainManifest
./gradlew :app:lintDebug :app:lintRelease
```

Revisar manifest merger reports e dependency tree. Zero ocorrência não justificada de API ≤ 32.

---

## Fase 7 — Execução E2E final e documentação

### Tarefa 7.1: matriz funcional API 33–37

Para cada API:

1. instalar APK benchmark com dados limpos;
2. semear fixture sintética;
3. executar jornadas críticas;
4. negar/aceitar permissões;
5. rotacionar e alternar background/foreground;
6. registrar screenshots, vídeo curto, UiAutomator dump, logcat, meminfo e exit-info;
7. desinstalar/limpar somente o pacote benchmark.

**Gate:** 5/5 APIs verdes; qualquer caso não executado fica explicitamente pendente, nunca “compatível por inferência”.

### Tarefa 7.2: regressão visual e performance depois das correções

Executar exatamente os mesmos datasets, AVDs, repetições e scripts do baseline. Produzir tabela delta antes/depois, incluindo regressões e ruído estatístico.

### Tarefa 7.3: gates técnicos finais

```bash
npm ci
npm run lint
npm run test
npm run test:e2e:visual
npm run build
npx cap sync android
cd android
./gradlew testDebugUnitTest assembleDebug assembleAndroidTest lintDebug --console=plain
./gradlew connectedDebugAndroidTest --console=plain
./gradlew assembleBenchmark lintRelease --console=plain
```

Depois:

- verificar APKs e tamanho em bytes;
- verificar `minSdk`, `targetSdk`, versão e package ID com ferramentas do SDK;
- instalar APK final em API 33 e 37;
- abrir `com.runflow.app/.MainActivity` e validar foco;
- revisar logcat, StrictMode, ANR/OOM, WebView e crashes;
- rodar `git diff --check`, revisar segredos e confirmar árvore sem artefatos gerados.

### Tarefa 7.4: documentação final

**Arquivos:**
- Atualizar: `README.md`
- Atualizar: `ROADMAP.md`
- Atualizar: `CHANGELOG.md`
- Criar: `docs/quality/visual-e2e-report.md`
- Criar: `docs/quality/performance-final.md`
- Criar: `docs/quality/android-13-17-compatibility.md`
- Criar: `docs/quality/device-matrix.md`

O `ROADMAP.md` só continuará marcando a Fase 4 como 100% concluída se os gates acima forem executados e os relatórios existirem. Caso contrário, os itens devem voltar para “em validação”.

---

## 6. Estratégia de commits e revisão

Commits pequenos, após validação de cada fase:

1. `test(e2e): add visual and synthetic fixture harness`
2. `fix(ui): harden responsive layouts and safe areas`
3. `test(perf): add repeatable Android WebView benchmarks`
4. `perf(storage): split activity summaries from track data`
5. `perf(ui): virtualize activity list and stabilize flyover loop`
6. `feat(android): target API 37 and modernize permissions`
7. `refactor(android): remove pre-Android 13 legacy paths`
8. `docs(quality): publish E2E compatibility and performance evidence`

Antes de cada commit:

- testes focados;
- gate da fase;
- revisão do diff;
- nenhuma inclusão de fixture pesada, dump, token, GPX/FIT real ou `IDEA.md`.

Após autorização de execução e conforme regra do repositório, fazer push e verificar SHA remoto igual ao SHA local.

---

## 7. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Target API 37 quebrar plugins Capacitor/BLE | primeiro testar target 35 no API 37; depois elevar target e usar compat toggles |
| Migração IndexedDB perder dados | fixture v5, transação versionchange, backup/restauração e teste idempotente |
| Medidas de emulador variarem | 20 repetições, estado térmico/AVD documentado, P50/P95/P99 e comparação no mesmo host |
| “4 GB de RAM” não representar aparelho real | limitar AVD a 4 GB, usar MemoryLimiter API 37 e declarar limitação; validar depois no Galaxy A10 somente como alvo posterior |
| Screenshot web passar mas APK falhar | manter matriz dupla: Playwright + APK real com system bars/permissões |
| Virtualização prejudicar acessibilidade | testar foco, teclado, screen reader semantics e navegação de retorno |
| Mixed content ser necessário a WebDAV HTTP local | exigir decisão explícita e política por domínio/uso; não deixar liberação global |
| Áudio/GPS em background exigir foreground service | confirmar comportamento real e política antes de adicionar serviço permanente |
| Relatórios/artefatos crescerem muito no Git | versionar apenas resumo e snapshots aprovados; guardar traces brutos em `.hermes/artifacts/` |

---

## 8. Definição de concluído

A implementação só estará concluída quando:

- a matriz API 33–37 tiver execução real e relatório;
- os nove formatos críticos tiverem baselines aprovados;
- fonte 200%, paisagem, teclado e safe areas estiverem verdes;
- benchmarks de 4 GB e 8 GB mostrarem ausência de vazamento, OOM, ANR e regressões injustificadas;
- a persistência separar resumos de trackpoints e a lista usar paginação/virtualização reais;
- o Flyover 3D e mapas tiverem prova de liberação de memória;
- `minSdk 33`, `compileSdk 37` e `targetSdk 37` forem confirmados no APK;
- não houver código/permissões exclusivos para Android ≤ 12;
- build web, testes, lint, APK, androidTest, E2E, logcat e Git estiverem validados;
- README, ROADMAP, CHANGELOG e relatórios refletirem fatos medidos.

## 9. Pontos de acesso para teste

- Web local: `http://127.0.0.1:3000/`
- APK Android: pacote `com.runflow.app`, atividade `com.runflow.app/.MainActivity`
- Variante isolada sugerida: `com.runflow.app.benchmark`
- APK debug esperado: `E:\projetos\runflow-app\android\app\build\outputs\apk\debug\app-debug.apk`

Não existe URL HTTP separada para o APK Capacitor: o conteúdo está empacotado e é aberto pela atividade Android acima.

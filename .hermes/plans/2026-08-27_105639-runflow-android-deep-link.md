# RunFlow Android Deep-Link Loading Bug Implementation Plan

> **For Hermes:** Use the `software-development/systematic-debugging` and `software-development/requesting-code-review` skills to implement this plan task-by-task.

**Goal:** Fazer todas as rotas estáticas do RunFlow carregarem corretamente após cold start/deep link no Capacitor Android, preservando o fluxo `file://` usado pelo E2E e o modo claro persistido.

**Architecture:** Separar o tratamento de assets do export estático por destino. O export para `file://` continuará usando caminhos relativos e o bootstrap existente; o export empacotado no Capacitor deverá preservar caminhos absolutos na raiz (`/_next/...`), que correspondem ao servidor `https://localhost` do WebView. A correção deve ser coberta por teste de exportação e por uma regressão real no emulador.

**Tech Stack:** Next.js static export, Capacitor Android, WebView `https://localhost`, TypeScript/JavaScript, Vitest, `@playwright/test` via CDP, ADB/Gradle.

---

## Diagnóstico confirmado

### Defeito observado

No emulador `Pixel_8` / Android API 37, após instalar e iniciar o APK debug do commit `8aa8fa2fda39ab9a3d3f46568988950178d86281`:

- A home (`https://localhost/`) carregou e renderizou corretamente.
- O modo claro alternou, persistiu após reload e apresentou fundo `rgb(255, 255, 255)`.
- A navegação interna a partir da home passou para `/gravar/`, `/atividades/`, `/importar/`, `/rotas/`, `/perfil/` e `/heatmap/`, sem 4xx, erros de console ou overflow horizontal.
- A abertura direta de uma rota profunda, por exemplo `https://localhost/gravar/`, falhou:
  - scripts e CSS foram solicitados como `https://localhost/gravar/_next/...`;
  - esses recursos retornaram HTTP 404;
  - a aplicação ficou em `Carregando...` e exibiu chaves de tradução sem resolver;
  - `data-theme` voltou para `dark` embora `localStorage.runflow_theme` permanecesse `light`.
- O app nativo continuou em primeiro plano, sem crash em `logcat`; o problema é de asset URL/empacotamento do export, não de inicialização nativa.

### Evidência de causa provável

- `scripts/build/patch-file-export.mjs:7-21` calcula um prefixo relativo pela profundidade da página e reescreve `/_next/` para `../_next/` ou equivalente em todo HTML/CSS.
- `scripts/build/patch-file-export.mjs:5` mantém um bootstrap específico para `file://`.
- `next.config.ts:4-5` usa `output: "export"` e `trailingSlash: true`.
- `package.json:9-10` executa esse patch em todo `postbuild` e reutiliza `npm run build` dentro de `build:mobile`.
- O Capacitor expõe `webDir: "out"` em `capacitor.config.ts:6` e o WebView usa `https://localhost`, portanto os assets precisam resolver a partir de `https://localhost/_next/...`, não de `https://localhost/<rota>/_next/...`.

---

## Tarefas de implementação

### Task 1: Criar regressão determinística do patch de exportação

**Objective:** Provar em teste que os dois destinos de exportação produzem URLs compatíveis com seus servidores.

**Files:**
- Modify: `scripts/build/patch-file-export.mjs`
- Create or modify: `scripts/build/patch-file-export.test.ts`
- Modify: `package.json` only if a focused test script is needed

**Steps:**
1. Extrair funções puras para calcular o destino e reescrever HTML/CSS, sem executar `walk()` ao importar o módulo em teste.
2. Adicionar caso `file` que espera caminhos relativos como `../_next/...` em uma rota profunda e a presença do bootstrap `file://`.
3. Adicionar caso `capacitor` que espera `/_next/...`, sem `/gravar/_next/...` ou outro prefixo de rota.
4. Adicionar caso CSS para garantir que URLs internas também respeitem o destino.
5. Rodar o teste focado e confirmar que ele falha com a implementação atual para o destino Capacitor antes de aplicar a correção.

**Validation:**

```bash
npx vitest run scripts/build/patch-file-export.test.ts
```

Expected after the test is written: the Capacitor case fails for the current relative rewrite; the file case remains covered.

### Task 2: Tornar o patch consciente do destino de execução

**Objective:** Preservar assets absolutos no export destinado ao Capacitor, mantendo compatibilidade com `file://`.

**Files:**
- Modify: `scripts/build/patch-file-export.mjs`
- Create: `scripts/build/build-mobile.mjs` (recommended if an environment flag must cross npm/Windows reliably)
- Modify: `package.json:9-10`

**Steps:**
1. Definir um destino explícito, por exemplo `NEXT_EXPORT_TARGET=file` para export de arquivo e `NEXT_EXPORT_TARGET=capacitor` para o build Android.
2. Manter o comportamento atual relativo apenas quando o destino for `file`.
3. Para o destino `capacitor`, não reescrever atributos estáticos `href/src` de `/_next/...` nem URLs CSS de `/_next/...`; manter o bootstrap `file://` fora desse modo ou torná-lo inofensivo para HTTPS.
4. Preferir um wrapper Node para `build:mobile`, evitando sintaxe de variável de ambiente específica de `cmd.exe`/Git Bash. O wrapper deverá propagar o destino ao `npm run build`, executar `npx cap sync android` e invocar o Gradle existente com código de saída propagado.
5. Não adicionar dependência de produção somente para essa seleção de destino.

**Acceptance:**

- `out/gravar/index.html` no modo file contém referências relativas válidas para o E2E `file://`.
- `out/gravar/index.html` no modo Capacitor contém `/_next/...` e nunca `gravar/_next/...`.
- CSS e imports dinâmicos não escapam para a rota atual.

### Task 3: Cobrir o cold start real no emulador

**Objective:** Impedir regressão no fluxo que falhou neste diagnóstico.

**Files:**
- Create: `scripts/android/test-capacitor-deep-links.mjs`
- Modify: `package.json` se for criado um script explícito de smoke test

**Steps:**
1. Instalar o APK recém-gerado no `Pixel_8` sem limpar dados por padrão.
2. Iniciar `com.runflow.app`, localizar o socket `webview_devtools_remote_<PID>` e refazer o forward TCP 9222 após cada relaunch/reinstall.
3. Conectar via CDP usando `chromium.connectOverCDP` de `@playwright/test`, evitando WebSocket cru em Android 14+.
4. Para cada rota `/`, `/gravar/`, `/atividades/`, `/importar/`, `/rotas/`, `/perfil/` e `/heatmap/`, abrir diretamente após cold start/reload e verificar:
   - `window.location.pathname` correto;
   - `main` presente;
   - conteúdo real, não apenas `Carregando...` ou chaves `nav.*`/`footer.*`;
   - tema persistido coerente com `localStorage`;
   - ausência de respostas 4xx para scripts/CSS/chunks;
   - ausência de `pageerror` e erros de console relevantes;
   - ausência de overflow horizontal.
5. Manter um caso separado de navegação interna para garantir que a correção não remova o comportamento já aprovado.

**Acceptance:**

- Todos os deep links carregam conteúdo completo em até um timeout definido, sem 404 de assets.
- O modo claro continua persistindo no cold start.
- A navegação interna continua passando.

### Task 4: Revalidar export `file://` e web

**Objective:** Garantir que a correção Android não quebre o caminho estático usado pelos testes web.

**Files:**
- Testes existentes em `tests/e2e/navigation.spec.ts` e `tests/e2e/visual/navigation.spec.ts`
- `scripts/build/patch-file-export.test.ts`

**Commands:**

```bash
npm run build
npm run test:e2e
npm run quality:contrast
npm test
npx --no-install tsc --noEmit --pretty false
npm run lint
```

**Acceptance:**

- O caso `file://` existente continua carregando a home e as rotas cobertas.
- E2E, testes unitários, TypeScript, lint e auditoria de contraste passam.

### Task 5: Rebuild mobile e validar o APK

**Objective:** Produzir um APK com o destino Capacitor corrigido e verificar o artefato.

**Environment:**

```bash
export JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
export ANDROID_HOME='C:/Users/gustavo/AppData/Local/Android/Sdk'
```

**Command:**

```bash
npm run build:mobile
```

**Validation:**

```bash
python -c "from pathlib import Path; p=Path('android/app/build/outputs/apk/debug/app-debug.apk'); assert p.is_file() and p.stat().st_size > 0; print(p, p.stat().st_size)"
npm run perf:bundle
npm run quality:legacy
```

Depois instalar novamente no `Pixel_8` e executar Task 3 contra o APK recém-gerado. Verificar também:

```bash
adb -s emulator-5554 shell dumpsys window
adb -s emulator-5554 logcat -d -b crash
```

Não considerar somente `BUILD SUCCESSFUL` como aprovação: o cold start de cada rota precisa passar.

### Task 6: Atualizar documentação e evidências

**Objective:** Alinhar a documentação ao comportamento corrigido e registrar a regressão que foi eliminada.

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/quality/current-state.md`
- Modify: `package.json` if scripts were added

**Content:**

- Registrar a correção de deep links/cold start no Capacitor.
- Separar explicitamente a validação `file://` da validação `https://localhost` no WebView.
- Registrar quantidade de rotas testadas, resultado dos 4xx, erros de console, modo claro/escuro e APK gerado.
- Não declarar matriz Android completa, hardware físico ou CI hospedado sem execução real.

### Task 7: Revisão e entrega

**Objective:** Publicar somente a correção testada, sem incluir artefatos ou arquivos pessoais.

**Steps:**

```bash
git status --short --untracked-files=all
git diff --check
git diff --stat
```

1. Revisar o diff e solicitar revisão independente somente leitura do índice final.
2. Incluir somente os arquivos da correção, testes e documentação alinhada.
3. Excluir APKs, `out/`, traces, screenshots, caches, `.env` e `IDEA.md`.
4. Criar commit com prefixo `[verified]` somente após aprovação independente.
5. Executar `git push origin HEAD` sem force.
6. Fazer `git fetch origin main` e provar igualdade entre `git rev-parse HEAD` e `git rev-parse origin/main`.

---

## Riscos e trade-offs

- O patch atual foi criado para permitir E2E com `file://`; remover o rewrite global sem estratégia por destino pode quebrar todos os testes de export local.
- Alterar apenas o `assetPrefix` do Next pode não ser suficiente enquanto `patch-file-export.mjs` continuar reescrevendo os atributos depois do build.
- O forward CDP precisa ser recriado após reinstall/relaunch porque o PID/socket do WebView muda.
- Dados persistentes do emulador podem alterar números exibidos no dashboard; a regressão deve validar estrutura, navegação e estado, não assumir conteúdo pessoal fixo.
- O APK debug é adequado para esse smoke test, mas não substitui uma release assinada.

## Estado atual

- Diagnóstico: concluído.
- Implementação da correção: concluída nesta execução.
- Plano salvo em: `.hermes/plans/2026-08-27_105639-runflow-android-deep-link.md`.
- Arquivos implementados: `scripts/build/patch-file-export.mjs`, `scripts/build/build-mobile.mjs`, `scripts/build/patch-file-export.test.ts`, `scripts/android/test-capacitor-deep-links.mjs`, `src/lib/capacitor-deep-link.ts`, `src/lib/capacitor-deep-link.test.ts`, `src/components/CapacitorDeepLinkRedirect.tsx`, `src/app/page.tsx` e `package.json`.
- Testes realizados nesta sessão: instalação/launch, CDP, navegação interna, alternância de temas, cold-start/deep-link reproduzido antes da correção, export `file://`, export Capacitor, testes unitários, TypeScript, lint, E2E web, build mobile e deep links diretos no APK final.
- Resultado final do emulador: 7 rotas profundas carregadas com conteúdo completo, tema claro persistido, zero 4xx de assets, zero erros de console e zero overflow horizontal.

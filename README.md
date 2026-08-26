# RunFlow

App **open source** e **gratuito** para gerenciar treinos de corrida — alternativa local ao Strava, com foco em importação de treinos do **Amazfit** via arquivos GPX e FIT.

![RunFlow](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Capacitor](https://img.shields.io/badge/Capacitor-7-green)

## Funcionalidades

- Dashboard com estatísticas (distância total, tempo, semana atual e metas)
- Lista de atividades com distância, duração e ritmo médio
- Detalhe do treino com rota local e **mapa online opcional** (OpenStreetMap), gráficos analíticos e tabela de voltas (splits)
- **Gravar treino** com GPS ao vivo (distância, tempo, ritmo, mapa) — estilo Strava
- **Importação** de arquivos `.gpx` e `.fit` (arrastar ou selecionar)
- Dados de treino armazenados **localmente** no dispositivo (IndexedDB); o Android Auto Backup permanece desabilitado
- **Performance**: catálogo de traduções e painel de sincronização carregados sob demanda; bundle inicial medido em `410.970 bytes`
- **Acessibilidade**: respeito a `prefers-reduced-motion` (animações anuladas) e indicador de foco visível por `:focus-visible` (WCAG 2.2)
- **App Android (APK)** via Capacitor
- Interface multilíngue (Português do Brasil 🇧🇷 e Inglês 🇺🇸)
- **Assistente de configuração inicial (Wizard de Boas-vindas)** para novos usuários
- **Recordes pessoais (PRs)** automáticos (distância, ritmo, duração e ganho de altitude)
- **Histórico e estatísticas avançadas** (filtros temporais/esporte, acumulado anual e gráficos de volume semanal/mensal)
- **Controle de Tênis / Equipamentos**: cadastro com barra de desgaste, km acumulado e associação automática a novos treinos
- **Conquistas Pessoais**: 10 insígnias desbloqueadas dinamicamente com base no histórico de treinos (consistência, distância, horário, elevação e mais)
- **Modo Treino**: tela imersiva fullscreen com métricas em fonte gigante e tela sempre ativa (`Screen Wake Lock API`) durante a gravação
- **Backup e Restauração**: exportar/importar backup JSON completo (atividades, perfil, equipamentos)
- **Frequência Cardíaca em Tempo Real**: conexão BLE com relógios e cintas cardíacas
- **Competidor Virtual (Ghost Runner)**: corra contra o ritmo de treinos anteriores ou meta fixa, com alertas de voz
- **Correção de Altimetria opcional**: após confirmação explícita, envia as coordenadas exatas do treino à API Open-Meteo para corrigir a elevação
- **Associar FIT (FC)**: mesclagem de frequência cardíaca de arquivos FIT em treinos GPX já importados
- **Navegação local de rotas**: rotas e alertas de desvio funcionam com dados locais; a camada visual do mapa usa tiles online somente após consentimento por sessão
- **Voice Coach nativo no Android**: fallback TTS por Capacitor quando o WebView não expõe `speechSynthesis`, com cancelamento seguro no stop/background/unmount
- **Lifecycle seguro de gravação**: cancelamento de timers/áudio, invalidação de watchers GPS e proteção contra resultados assíncronos após reset ou descarte
- **Métricas e sensores protegidos**: elevação processada uma vez por segmento, pontos de Auto-Pause excluídos do artefato salvo, operações concorrentes de gravação invalidadas/idempotentes, GPS finito, callbacks de rota sem estado obsoleto, alertas de desvio com transição/throttling e conexões BLE canceláveis no unmount com payloads truncados descartados
- **Desenho de Rotas**: crie rotas GPX clicando no mapa, com distância em tempo real e salvamento local
- **Mapa de Comparação**: overlay da rota planejada vs trajeto real no detalhe da atividade

## Requisitos

- Node.js 18+
- Windows / macOS / Linux
- Para APK: [Android Studio](https://developer.android.com/studio) + JDK 21 (JBR incluído)

## Instalação (navegador / desenvolvimento)

Execute os comandos a partir da raiz do checkout:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

O RunFlow é **local-first**: gravações, histórico e configurações permanecem no dispositivo.
As sincronizações P2P e WebDAV são opcionais e exigem rede somente quando acionadas pelo usuário.
Outros serviços externos também são opcionais: os mapas só carregam tiles após consentimento
explícito por sessão (OpenStreetMap, CARTO ou Esri, que recebem a área solicitada), e a correção
de altimetria só envia coordenadas exatas à Open-Meteo após uma confirmação específica. Sem esse
consentimento, rotas e trajetos continuam visíveis sobre o fundo local, sem tiles externos.

### Sincronização opcional

- **P2P:** disponível no navegador desktop e no Android/iOS; use um código de pareamento
  temporário. O protocolo autentica o desafio antes de aceitar dados e valida limites/tipos do
  payload antes de escrever no IndexedDB.
- **WebDAV:** use uma URL `https://` e informe a senha no momento da sincronização. A senha não
  é persistida em `localStorage`; falhas de leitura, JSON inválido, respostas HTTP inesperadas
  e corpos de resposta pendurados (timeout de headers e de streaming) interrompem o fluxo antes
  de qualquer sobrescrita remota.
- A permissão **Local Network** é necessária apenas no app nativo; no navegador desktop esse
  bridge não é necessário.

## Gerar APK para Android

O app usa [Capacitor](https://capacitorjs.com/) para empacotar a versão web como aplicativo nativo.

### 1. Instalar dependências e gerar o site estático

```bash
npm install
npm run build
```

### 2. Sincronizar com o projeto Android

```bash
npx cap sync android
```

Ou em um comando:

```bash
npm run build:mobile
```

### 3. Abrir no Android Studio e gerar o APK

```bash
npm run cap:android
```

No Android Studio:

1. Aguarde o Gradle sincronizar (primeira vez pode demorar).
2. Conecte um celular com **depuração USB** ou use um emulador.
3. **Run** (▶) para instalar no aparelho, **ou**
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   O APK de debug fica em:
   `android/app/build/outputs/apk/debug/app-debug.apk`

### APK de release (instalar fora da loja)

1. No Android Studio: **Build → Generate Signed Bundle / APK**
2. Crie ou use um keystore
3. Escolha **APK** → **release**
4. Assine e guarde o arquivo `.apk` gerado

### Rodar direto no celular (linha de comando)

Com dispositivo conectado e Android SDK configurado:

```bash
npm run cap:run
```

### Variáveis de ambiente (se o build falhar)

- `ANDROID_HOME` — pasta do Android SDK (ex.: `%LOCALAPPDATA%\Android\Sdk` no Windows)
- `JAVA_HOME` — JDK 21/JBR (vem com o Android Studio; no Windows: `C:\Program Files\Android\Android Studio\jbr`)

## Exportar treinos do Amazfit

O app Zepp na nuvem da Huami não oferece exportação GPX nativa simples para todos os modelos. Use ferramentas open source:

1. **[Mi-Fit-and-Zepp-workout-exporter](https://github.com/rolandsz/Mi-Fit-and-Zepp-workout-exporter)** — exporta para GPX, JSON, CSV
2. **[zepp-fit-extractor](https://github.com/H3llK33p3r/zepp-fit-extractor)** — exporta para FIT

Depois, em RunFlow → **Importar**, envie os arquivos `.gpx` ou `.fit`.

Você também pode exportar **um treino por vez** em GPX pelo próprio app Zepp (manual).

### Por que não há sincronização automática com a Zepp?

A nuvem Zepp/Huami é **proprietária**. Não existe uma API pública simples para apps independentes como o RunFlow:

| Opção | Situação |
|-------|----------|
| **API oficial** ([dev.huami.com](https://dev.huami.com), [zepp-health/rest-api](https://github.com/zepp-health/rest-api)) | Exige cadastro de **empresa/parceiro**, aprovação e OAuth — não é voltada a projetos pessoais ou open source |
| **API da nuvem** (`api-mifit*.huami.com`) | Usada pelo app Zepp, mas **não documentada**; acesso via engenharia reversa e `apptoken` (instável, pode quebrar) |
| **Exportação GDPR** | Não inclui, em geral, atividades esportivas com GPX |
| **Integrações oficiais** | Strava, TrainingPeaks, Komoot etc. — só para **apps parceiros**, não para o RunFlow |

Por isso o RunFlow usa **importação de arquivos GPX/FIT** — método estável, local e sem depender da Zepp.

### Token Zepp (ferramentas externas)

1. Acesse a página de privacidade/GDPR: https://user.huami.com/privacy2/index.html
2. No navegador (F12 → Rede), localize o `apptoken` nas requisições
3. Use o token na ferramenta de exportação conforme a documentação do projeto

## Estrutura do projeto

```
src/
  app/           # Páginas (export estático)
    rotas/       # Navegação local de rotas (listar rotas, criar rota)
  components/    # UI (mapa, lista, importação, perfil, conquistas, navegação)
  lib/
    parsers/     # GPX e FIT
    storage.ts   # IndexedDB v7 (activitySummaries, activityTracks, profile, gear, routes, workouts)
    activities.ts
    gear.ts      # Utilitários de equipamentos
    achievements.ts  # Cálculo dinâmico de conquistas
    route-geo.ts     # Algoritmos de proximidade geométrica
    enrichment.ts    # Correção de altitude + merge de HR
    calories.ts      # Estimativa de calorias MET
android/         # Projeto nativo Capacitor
out/             # Build estático (gerado)
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera site estático em `out/` |
| `npm run build:mobile` | Build + sync Android |
| `npm run cap:android` | Abre Android Studio |
| `npm run cap:run` | Instala no dispositivo conectado |
| `npm start` | Servir pasta `out/` localmente |

## Verificação local

Gates web e E2E usados no checkout atual:

```bash
npx --no-install vitest run
npx --no-install tsc --noEmit --pretty false
npm run lint
npm run test:e2e
```

Na primeira execução do Playwright, instale o navegador de teste se ele ainda não estiver presente:

```bash
npx playwright install chromium
```

Na execução local, a aplicação fica acessível em [http://localhost:3000](http://localhost:3000).
O build mobile validado usa `npm run build:mobile`; os testes Android conectados rodam com
`./gradlew.bat :app:testDebugUnitTest :app:assembleAndroidTest :app:connectedDebugAndroidTest`
na pasta `android/`, com JDK 21/JBR e SDK Android configurados.

### Estado verificado do checkout 0.9.8

- `npm test`: **66 arquivos / 258 testes** aprovados.
- E2E: **25/25** aprovados.
- Bundle: **2.689.684 bytes total / 406.135 bytes inicial**, dentro do orçamento; redução de **92.029 bytes (18,5%)** no inicial após lazy loading de i18n e SyncPanel.
- Dashboard com leitura única de summaries (stats, PRs, VO2 Max e previsões derivados em memória, sem segunda leitura do IndexedDB).
- `npm run build:mobile`: aprovado; APK debug final em
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- A matriz Android 33–36, hardware físico, medição acústica e CI hospedado permanecem fora do escopo desta entrega.

## Licença

MIT — use, modifique e compartilhe livremente.

## Roadmap

As features planejadas e o progresso do aplicativo estão detalhados em [ROADMAP.md](./ROADMAP.md), contendo prioridades, estimativas de esforço e a ordem sugerida de versões (v0.2 → v0.8+).

Resumo do status das features:

1. ~~Exportar GPX~~ ✅
2. ~~Gráficos (ritmo, elevação, FC)~~ ✅
3. ~~Metas semanais~~ ✅
4. ~~Recordes pessoais (PRs)~~ ✅
5. ~~Splits por km / voltas~~ ✅
* ~~Suporte Multilíngue (Português & Inglês)~~ ✅
6. ~~Histórico e estatísticas avançadas~~ ✅
7. ~~Tela escura durante gravação (modo treino)~~ ✅
8. ~~Backup e restauração de dados~~ ✅
9. ~~Integração com frequência cardíaca em tempo real (BLE)~~ ✅
10. Publicação na Play Store (release assinado)
11. ~~Assistente de configuração inicial (Wizard)~~ ✅
12. ~~Conquistas Pessoais e Analytics de Equipamentos~~ ✅
13. ~~Competidor Virtual / Ghost Runner Offline~~ ✅
14. ~~Motor de Enriquecimento e Correção de Altimetria~~ ✅
15. Sincronização Multidispositivo Sem Servidor
16. ~~Navegação local de rotas e Alerta de Desvio de Rota~~ ✅
17. Replay e Visualização da Atividade em 3D (Flyover)

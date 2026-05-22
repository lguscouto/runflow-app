# RunFlow

App **open source** e **gratuito** para gerenciar treinos de corrida — alternativa local ao Strava, com foco em importação de treinos do **Amazfit** via arquivos GPX e FIT.

![RunFlow](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)

## Funcionalidades

- Dashboard com estatísticas (distância total, tempo, semana atual e metas)
- Lista de atividades com distância, duração e ritmo médio
- Detalhe do treino com **mapa** (OpenStreetMap), gráficos analíticos e tabela de voltas (splits)
- **Gravar treino** com GPS ao vivo (distância, tempo, ritmo, mapa) — estilo Strava
- **Importação** de arquivos `.gpx` e `.fit` (arrastar ou selecionar)
- Dados armazenados **localmente** no dispositivo (IndexedDB) — privacidade total local-first
- **App Android (APK)** via Capacitor
- Interface multilíngue (Português do Brasil 🇧🇷 e Inglês 🇺🇸)
- **Assistente de configuração inicial (Wizard de Boas-vindas)** para novos usuários
- **Recordes pessoais (PRs)** automáticos (distância, ritmo, duração e ganho de altitude)
- **Histórico e estatísticas avançadas** (filtros temporais/esporte, acumulado anual e gráficos de volume semanal/mensal)

## Requisitos

- Node.js 18+
- Windows / macOS / Linux
- Para APK: [Android Studio](https://developer.android.com/studio) + JDK 17

## Instalação (navegador / desenvolvimento)

```bash
cd "app treino"
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

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
- `JAVA_HOME` — JDK 17 (vem com o Android Studio)

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
| **Integrações oficiais** | Strava, TrainingPeaks, komoot etc. — só para **apps parceiros**, não para o RunFlow |

Por isso o RunFlow usa **importação de arquivos GPX/FIT** — método estável, local e sem depender da Zepp.

### Token Zepp (ferramentas externas)

1. Acesse a página de privacidade/GDPR: https://user.huami.com/privacy2/index.html  
2. No navegador (F12 → Rede), localize o `apptoken` nas requisições  
3. Use o token na ferramenta de exportação conforme a documentação do projeto

## Estrutura do projeto

```
src/
  app/           # Páginas (export estático)
  components/    # UI (mapa, lista, importação)
  lib/
    parsers/     # GPX e FIT
    storage.ts   # IndexedDB (web + Android)
    activities.ts
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

## Licença

MIT — use, modifique e compartilhe livremente.

## Roadmap

As features planejadas e o progresso do aplicativo estão detalhados em [ROADMAP.md](./ROADMAP.md), contendo prioridades, estimativas de esforço e a ordem sugerida de versões (v0.2 → v0.7+).

Resumo do status das features:

1. ~~Exportar GPX~~ ✅  
2. ~~Gráficos (ritmo, elevação, FC)~~ ✅  
3. ~~Metas semanais~~ ✅  
4. ~~Recordes pessoais (PRs)~~ ✅  
5. ~~Splits por km / voltas~~ ✅  
* ~~Suporte Multilíngue (Português & Inglês)~~ ✅  
6. ~~Histórico e estatísticas avançadas~~ ✅  
7. Tela escura durante gravação (modo treino)  
8. Backup e restauração de dados  
9. Integração com frequência cardíaca em tempo real (BLE)  
10. Publicação na Play Store (release assinado)  
11. ~~Assistente de configuração inicial (Wizard)~~ ✅  
12. Conquistas Pessoais e Analytics de Equipamentos  
13. Competidor Virtual / Ghost Runner Offline  
14. Motor de Enriquecimento e Correção de Altimetria  
15. Sincronização Multidispositivo Sem Servidor  
16. Navegação Offline e Alerta de Desvio de Rota  
17. Replay e Visualização da Atividade em 3D (Flyover)  


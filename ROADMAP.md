# RunFlow — Roadmap & Benchmark de Mercado

Pesquisa de mercado e análise comparativa baseada nos aplicativos líderes da categoria (**Strava**, **Garmin Connect / Edge**, **Wahoo Fitness**, **Komoot**, **Nike Run Club - NRC** e **Bikemap**), mantendo o compromisso central do RunFlow: **100% offline, local-first, gratuito e com privacidade total de dados**.

---

## 🏆 Benchmark de Mercado & Tendências — Ciclismo & Multi-Esporte (2025–2026)

| Aplicativo | Pontos Fortes em UI/UX & Ciclismo | O que o RunFlow oferece / supera |
|---|---|---|
| **Strava** | • Métricas de velocidade em km/h e potência estimada<br>• Cadastro de Bikes e componentes<br>• Heatmaps e Segmentos | • No Strava, recursos analíticos e heatmaps são pagos ($$$). No RunFlow, tudo é 100% gratuito e local.<br>• Cards de Stories sem marcas de paywall. |
| **Garmin Connect / Edge** | • Sensores BLE de Cadência (RPM) e Potência (Watts)<br>• Zonas de Potência (Coggan) e Zonas de FC (Z1-Z5)<br>• Análise de subidas em tempo real (ClimbPro) | • Transformar qualquer smartphone em um ciclocomputador GPS completo com sensores BLE sem exigir aparelhos caros. |
| **Wahoo Fitness & Cadence** | • Tela de Ciclocomputador limpa com números grandes<br>• Modo Paisagem (Landscape) para suporte de guidão<br>• Avisos de voz configuráveis para ciclismo | • HUD de alto contraste (Outdoor Sun Mode) otimizado para sol direto no guidão da bicicleta. |
| **Komoot & Bikemap** | • Perfil altimétrico de elevação da rota<br>• Alertas de manutenção preventiva de bike por quilometragem | • Gestão completa da garagem de bikes com histórico de desgaste de corrente, pneus e pastilhas. |

---

## 📊 Status Geral do Projeto (Fases Anteriores Concluídas)

| Fase | Descrição | Status |
|---|---|---|
| **Fase 1.0: Core do App** | Importação GPX/FIT, Altimetria, Splits, PRs, Gráficos, BLE HR, Metas, Dashboard Anual | ✅ 100% Concluído |
| **Fase 2.0: Avançada** | Sincronização P2P/WebDAV, Navegação Offline, Flyover 3D, Card Social, Voice Coach, Auto-Pause, Heatmap Térmico, Treinos Intervalados, VO2 Max, Micro-Interações Táteis & Modo Sol | ✅ 100% Concluído |
| **Fase 3.0: Ecossistema de Ciclismo** | Garagem de Bikes, Potência Watts, Cadência RPM, Velocidade km/h, Ciclocomputador HUD, Sensores BLE (CSCS/CPS), Auto-Pause Ciclismo, ClimbPro, Treinos FTP/Coggan, Curva de Potência e Heatmap Velo | ✅ 100% Concluído |
| **Fase 4.0: Fine-Tuning & Performance** | Visual Multi-Resoluções, Otimização de Memória (4GB-8GB), Modernização Android 13 a 17 & Remoção de Legado (12 Etapas) | ✅ 100% Concluído |
| **Fase Final: Publicação** | Google Play Store Release Assinado (.aab, Proguard/R8, Keystore, Data Safety) | ⏳ Próxima |

---

# 🚴 Fase 3.0: Ecossistema de Ciclismo (Concluído)

*(Todas as 9 etapas funcionais de ciclismo concluídas com sucesso: Garagem de Bicicletas, Métricas km/h e Watts, Ciclocomputador HUD Retrato/Paisagem, Sensores BLE CSCS/CPS, Auto-Pause & Voice Coach de Bike, ClimbPro ao Vivo, Treinos Estruturados FTP/Coggan, Curva de Potência e Cards Sociais/Heatmap de Ciclismo).*

---

# 🚀 Fase 4.0: Fine-Tuning, Performance E2E & Modernização Android (13 a 17) — ✅ 100% Concluído

Divisão estratégica em **12 etapas** estruturadas em 3 pilares técnicos fundamentais, antecedendo a publicação oficial.

---

## 🎨 Pilar 1: Fine-Tuning Visual & Multi-Resoluções (5 Etapas) — ✅ Concluído

### 1. Design System Responsivo & Multi-Breakpoints (360dp a 1440dp)
**Esforço:** M · **Prioridade:** Alta · **Foco:** Responsividade & Escala · **Status:** ✅ Concluído
- [x] Mapeamento e testes em proporções de aspecto 16:9, 18:9, 19.5:9, 20:9, 21:9 e compactos (360x640 até 1440x3120px)
- [x] Tipografia fluida com escala relativa (`clamp()`, `rem`, `dvh`/`dvw`) para evitar overflow horizontal ou corte de telemetria
- [x] Suporte à escala de fonte de acessibilidade do Android (até 200%) em cards estatísticos, listas e modais

---

### 2. Bottom Navigation Bar Mobile-First & Ergonomia de Polegar
**Esforço:** S · **Prioridade:** Alta · **Foco:** UX / Usabilidade com Uma Mão · **Status:** ✅ Concluído
- [x] Implementação de Bottom Navigation Bar flutuante/fixa para telas mobile (<640px) com os 5 hubs centrais (Início, Atividades, Gravar [Destaque], Rotas, Perfil)
- [x] Preservação do Header espaçado para visualizações desktop, tablets e modo paisagem
- [x] Micro-interações táteis (Haptics) e transições suaves ao alternar entre abas

---

### 3. Safe Area Insets E2E (Android 15+ Edge-to-Edge & Recortes de Tela)
**Esforço:** S · **Prioridade:** Alta · **Foco:** Conformidade com Android 15/16/17 · **Status:** ✅ Concluído
- [x] Conformidade total com a política de Edge-to-Edge mandatória a partir do Android 15 (API 35+)
- [x] Mapeamento dinâmico de `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)` e `right`
- [x] Proteção contra sobreposição da barra de gestos inferior sobre botões de ação e adaptação a recortes de câmera/notch em Paisagem

---

### 4. HUDs de Gravação, Modos Retrato/Paisagem & Touch Targets (48dp+)
**Esforço:** M · **Prioridade:** Alta · **Foco:** Acessibilidade & Uso ao Ar Livre · **Status:** ✅ Concluído
- [x] Grid responsivo refinado para Ciclocomputador e HUD de Corrida com redimensionamento dinâmico de fontes e mapa dividido (Split Map)
- [x] Garantia de área de toque mínima de **48x48dp** (WCAG 2.2 / Material Design 3) com **Glove Mode (64dp+)** na tela de gravação
- [x] Otimização dos modos de visualização de alto contraste: ☀️ Modo Sol (E-Ink), 🌙 Modo Noite (AMOLED Black #000000) e ⚡ Modo Neo

---

### 5. Modais, Bottom Sheets Deslizáveis & Proporções de Gráficos/Mapas
**Esforço:** M · **Prioridade:** Média · **Foco:** Fluidez de Componentes · **Status:** ✅ Concluído
- [x] Transformação de modais em Bottom Sheets deslizáveis (Drawer) no mobile (Workout Builder, Social Card, Auto-Pause, Voice Coach, Garagem)
- [x] Ajuste de proporção para mapas Leaflet e gráficos interativos SVG (Power Curve, Altimetria, Ritmo) com suporte a pan/zoom suave

---

## ⚡ Pilar 2: Performance E2E & Gestão de Memória 4GB-8GB (5 Etapas) — ✅ Concluído

### 6. Otimização do Armazenamento IndexedDB & Paginamento de Dados
**Esforço:** M · **Prioridade:** Alta · **Foco:** Redução de Consumo de RAM Heap · **Status:** ✅ Concluído
- [x] Desacoplamento na leitura: listagens de atividades carregam apenas sumários leves (`ActivitySummary`), sem desserializar arrays gigantes de trackpoints
- [x] Carregamento de trackpoints sob demanda (`getStoredActivity(id)`) exclusivamente na abertura de detalhes/flyover
- [x] Implementação de cursor paginado indexado por data (`by-started`) para manter uso de memória constante mesmo com centenas de treinos

---

### 7. Virtualização de Listas Longas & Redução da Árvore DOM
**Esforço:** M · **Prioridade:** Alta · **Foco:** Scrolling Fluido 60/120fps · **Status:** ✅ Concluído
- [x] Virtualização de listas no `ActivityList`, `BikeGarageManager` e tabelas de splits com dezenas de voltas
- [x] Reutilização eficiente de nós DOM, eliminando engasgos de renderização (INP/FID < 50ms) e reduzindo a pressão do Garbage Collector em aparelhos de 4GB RAM

---

### 8. Ciclo de Vida e Desalocação Estrita de Memória em WebGL / Three.js (Flyover 3D)
**Esforço:** M · **Prioridade:** Alta · **Foco:** Prevenção de Memory Leaks · **Status:** ✅ Concluído
- [x] Rotina completa de desalocação (`dispose()` de geometrias, materiais, texturas e buffers) ao fechar o Flyover 3D
- [x] Liberação explícita de contexto WebGL (`renderer.dispose()`) e pausa do `requestAnimationFrame` em background (`visibilitychange`)
- [x] Recuperação de até 150MB+ de memória VRAM/RAM imediatamente após a reprodução

---

### 9. Simplificação Adaptativa de Trajetos GPS (Douglas-Peucker) & Leaflet
**Esforço:** M · **Prioridade:** Média · **Foco:** Eficiência Gráfica em Mapas · **Status:** ✅ Concluído
- [x] Implementação do algoritmo Douglas-Peucker com tolerância dinâmica conforme nível de zoom (redução de até 85% dos pontos renderizados na PolyLine)
- [x] Desalocação imediata de TileLayers e PolyLines no Leaflet e `PersonalHeatmap` ao desmontar componentes

---

### 10. Memoização Estratégica, Code Splitting Dinâmico & Redução de Bundle
**Esforço:** S · **Prioridade:** Média · **Foco:** Tempo de Inicialização & CPU · **Status:** ✅ Concluído
- [x] Code splitting dinâmico (`next/dynamic` com SSR desativado) para bibliotecas pesadas (`leaflet`, `three`, `canvas-confetti`, `peerjs`)
- [x] Memoização com `useMemo`/`useCallback`/`React.memo` em cálculos intensivos (NP™ Coggan, Zonas de Potência, ClimbPro, VO2 Max)

---

## 📱 Pilar 3: Modernização Android 13-17 & Limpeza de Legado (2 Etapas) — ✅ Concluído

### 11. Elevação de Linha de Base: Android 13 a 17 (minSdkVersion = 33, targetSdk = 35+)
**Esforço:** S · **Prioridade:** Alta · **Foco:** Arquitetura Nativa Atual · **Status:** ✅ Concluído
- [x] Atualização do `variables.gradle`: `minSdkVersion = 33` e `compileSdkVersion` / `targetSdkVersion = 35` (com suporte e validação para APIs 36 e 37)
- [x] Habilitação de Predictive Back Gestures (`android:enableOnBackInvokedCallback="true"`)
- [x] Configuração nativa de suporte a idiomas por app (Per-App Language Preferences) e permissão em tempo de execução `POST_NOTIFICATIONS`

---

### 12. Limpeza de Permissões e Fallbacks Legados (Android 12 para baixo)
**Esforço:** S · **Prioridade:** Alta · **Foco:** Higienização de Código · **Status:** ✅ Concluído
- [x] Remoção de permissões legadas de Bluetooth (`android.permission.BLUETOOTH` e `BLUETOOTH_ADMIN` maxSdkVersion 30) do `AndroidManifest.xml`
- [x] Remoção de flags obsoletas de storage legado (`requestLegacyExternalStorage`), adotando estritamente Scoped Storage nativo
- [x] Remoção de flags de debug (`android:debuggable="true"`) e exclusão de polyfills CSS/JS redundantes em WebViews modernos (Chromium 106+)

---

# 🚀 Fase Final: Publicação na Google Play Store & Release de Produção

### 13. Publicação na Play Store & Release Final Assinado
**Esforço:** M · **Prioridade:** Conclusão do Ciclo de Lançamento
- [ ] Geração de chave de assinatura `keystore` criptografada para builds de produção
- [ ] Configuração do Gradle para build de **Android App Bundle (`.aab`)** otimizado com Proguard/R8 para a Google Play Store
- [ ] Geração de APK de Release assinado para download direto (GitHub Releases / F-Droid)
- [ ] Ícones adaptativos em alta resolução (Material You Themed Icons + Adaptive Icons) e splash screen nativa
- [ ] Documento formal de Política de Privacidade Local-First (declaração de dados 100% locais sem telemetria externa)

---

## 🗺️ Fluxograma de Dependências da Fase 4.0 & Lançamento

```mermaid
flowchart TD
  subgraph Fase4["Fase 4.0: Fine-Tuning & Performance E2E"]
    V1[1 Multi-Resoluções 360-1440dp] --> V2[2 Bottom Nav Bar Mobile]
    V2 --> V3[3 Safe Areas & Edge-to-Edge Android 15+]
    V3 --> V4[4 HUDs Retrato/Paisagem & 48dp+ Targets]
    V4 --> V5[5 Bottom Sheets & Gráficos/Mapas]
    
    V5 --> P6[6 IndexedDB & Paginamento RAM]
    P6 --> P7[7 Virtualização de Listas 4GB-8GB]
    P7 --> P8[8 Desalocação WebGL / Three.js 3D]
    P8 --> P9[9 Simplificação GPS Douglas-Peucker]
    P9 --> P10[10 Code Splitting & Memoização]
    
    P10 --> M11[11 Android 13 a 17 minSdk 33]
    M11 --> M12[12 Limpeza de Permissões & Legado]
  end

  subgraph ReleaseFinal["Fase Final: Distribuição"]
    M12 --> PUB[13 Publicação Play Store & AAB Assinado]
  end
```

*Última atualização: agosto 2026 — Início da Fase 4.0: Fine-Tuning, Performance E2E & Modernização Android (13 a 17)*

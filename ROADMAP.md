# RunFlow — Roadmap & Benchmark de Mercado

Pesquisa de mercado e análise comparativa baseada nos aplicativos líderes da categoria (**Strava**, **Adidas Running / Runtastic**, **Nike Run Club - NRC** e **Garmin Connect**), mantendo o compromisso central do RunFlow: **100% offline, local-first, gratuito e com privacidade total de dados**.

---

## 🏆 Benchmark de Mercado & Tendências (2025–2026)

| Aplicativo | Pontos Fortes em UI/UX & Features | O que o RunFlow pode aprender / superar |
|---|---|---|
| **Strava** | • Cards de compartilhamento social belíssimos<br>• Heatmaps pessoais sobrepostos<br>• Análise detalhada de ritmo e segmentos | • No Strava, Heatmaps e análises profundas são pagos ($$$). No RunFlow, tudo é 100% gratuito e local.<br>• Compartilhamento visual direto para Instagram Stories sem marcas forçadas. |
| **Adidas Running** | • Gamificação com streaks de chamas 🔥<br>• Treinos intervalados guiados com áudio<br>• Design clean com foco no botão de início | • Feedback tátil e sonoro durante o treino.<br>• Contador visual de consistência semanal na Home. |
| **Nike Run Club (NRC)** | • Foco em superar a si mesmo (Past Self)<br>• Feedback de voz (Audio Cues) fluido e motivador<br>• Planos de treino estruturados e gratuitos | • Avisos por voz configuráveis (tempo/distância/FC/pace).<br>• Previsões de prova e metas claras de evolução. |
| **Garmin Connect** | • Zonas de Frequência Cardíaca (Z1-Z5) detalhadas<br>• Carga de treino cardiovascular (TRIMP/Stress)<br>• Estimativa de VO2 Max e previsão de provas (5K, 10K, 21K, 42K) | • Trazer a profundidade métrica dos relógios Garmin direto para o celular sem precisar de hardware caro ou nuvem proprietária. |

---

## 🚀 Status das Features Implementadas (Top 1–17)

| Feature | Descrição | Status |
|---|---|---|
| **1. Exportar treinos em GPX** | Download direto e compartilhamento nativo no Android | ✅ Concluído |
| **2. Gráficos de ritmo, elevação e FC** | Gráficos interativos com hover e dados detalhados | ✅ Concluído |
| **3. Metas semanais e progresso** | Metas de distância e quantidade com barras de progresso | ✅ Concluído |
| **4. Recordes pessoais (PRs)** | Troféus automáticos para melhores marcas (ritmo, distância, duração) | ✅ Concluído |
| **5. Splits por km** | Parciais de tempo, ritmo e elevação quilômetro a quilômetro | ✅ Concluído |
| **Extra: Internacionalização (PT & EN)** | Suporte completo a múltiplos idiomas com troca instantânea | ✅ Concluído |
| **6. Histórico e estatísticas avançadas** | Painel acumulado anual com filtros por período e esporte | ✅ Concluído |
| **7. Modo treino com tela escura** | Interface de alta visibilidade com Screen Wake Lock | ✅ Concluído |
| **8. Backup e restauração de dados** | Exportação e importação de JSON completo sem perdas | ✅ Concluído |
| **9. Integração com FC ao vivo (BLE)** | Conexão com cintas cardíacas e smartwatches via Bluetooth LE | ✅ Concluído |
| **11. Assistente Wizard de Onboarding** | Configuração guiada em 3 passos no primeiro acesso | ✅ Concluído |
| **12. Conquistas & Analytics de Tênis** | 10 insígnias dinâmicas e controle de desgaste de calçados | ✅ Concluído |
| **13. Competidor Virtual (Ghost Runner)** | Comparação em tempo real com atividades anteriores e alertas TTS | ✅ Concluído |
| **14. Correção e Enriquecimento Topográfico** | Merge de altimetria aberta e junção de GPX com FC de FITs | ✅ Concluído |
| **15. Sincronização Multidispositivo P2P & WebDAV** | Sincronização direta por WebRTC e nuvens privadas sem servidor central | ✅ Concluído |
| **16. Navegação Offline & Alerta de Desvio** | Alertas sonoros/visuais ao sair da rota e criador de trajetos no mapa | ✅ Concluído |
| **17. Replay e Flyover 3D** | Visualização imersiva 3D com WebGL/Three.js, 3 câmeras e telemetria | ✅ Concluído |
| **18. Card de Compartilhamento Social** | Gerador em Canvas para Stories (9:16) e Feed (1:1) com temas e share nativo | ✅ Concluído |
| **19. Zonas de FC & Carga de Treino** | Distribuição Z1-Z5, cálculo TRIMP, efeito do treino e fórmulas Tanaka/Karvonen | ✅ Concluído |
| **20. Assistente de Voz em Tempo Real** | Audio Cues periódicos com métricas de distância, tempo, ritmo, FC e splits | ✅ Concluído |
| **21. Auto-Pause Inteligente** | Detecção de paradas em semáforos, tempo em movimento e recálculo de ritmo | ✅ Concluído |
| **24. Previsão de Provas & VO2 Max Local** | Estimativa de VO2 Max, Idade de Condicionamento e Previsões (5K, 10K, 21K, 42K) | ✅ Concluído |

---

## 🎯 Próximas Features Prioritárias (Fase 2.0)

Legenda de esforço: **S** (pequeno: 1-2 dias) · **M** (médio: 3-5 dias) · **L** (grande: 1-2 semanas)

---

### 18. Gerador de Card de Compartilhamento Social (Stories & Feed) — ✅ Concluído
**Esforço:** M · **Prioridade:** Alta · **Inspiração:** Strava / NRC

Permitir que o corredor crie imagens estilizadas com os dados do treino para postar no Instagram Stories, WhatsApp, Strava ou salvar na galeria.

- [x] Motor de renderização local via HTML5 Canvas / SVG (sem envio para servidor)
- [x] 5 temas visuais: *Dark Cyberpunk/Neon*, *Minimalist Clean*, *Sunset Flow*, *Topo Map Contour*, *Foto da Galeria*
- [x] Opção de usar o mapa traçado em gradiente ou carregar uma foto da galeria como plano de fundo
- [x] Exibição harmônica de dados: Distância, Ritmo Médio, Duração, Ganho de Elevação, FC Média e Calorias
- [x] Proporções: 9:16 (Instagram Stories / WhatsApp Status) e 1:1 (Feed)
- [x] Botão de compartilhamento nativo via Capacitor Share / Web Share API e download PNG

---

### 19. Zonas de Frequência Cardíaca (Z1–Z5) & Análise de Carga de Treino — ✅ Concluído
**Esforço:** M · **Prioridade:** Alta · **Inspiração:** Garmin Connect / Strava Summit

Aprofundar a análise cardiovascular dos treinos com dados de batimentos cardíacos (BLE ou importados via FIT).

- [x] Configuração de FC Máxima e FC de Repouso no Perfil (com cálculo automático via Tanaka/Karvonen)
- [x] Distribuição de tempo e % gasto nas 5 Zonas (Z1 Recuperação, Z2 Base Aeróbica, Z3 Ritmo, Z4 Limiar, Z5 Anaeróbico)
- [x] Gráfico de barras horizontais colorido e stacked bar na tela de detalhe da atividade
- [x] Cálculo da Carga Cardiovascular (TRIMP - Training Impulse / Training Load)
- [x] Indicador de impacto do treino (ex.: "Treino Regenerativo", "Desenvolvimento Aeróbico", "Treino de Limiar", "Pico Anaeróbico & VO2 Max")

---

### 20. Assistente de Voz em Tempo Real (Audio Cues / Voice Coach) — ✅ Concluído
**Esforço:** M · **Prioridade:** Alta · **Inspiração:** Nike Run Club / Adidas Running

Feedback em áudio periódico nos fones de ouvido durante a corrida sem precisar olhar para a tela do celular.

- [x] Síntese de voz nativa e offline usando a Web Speech API / Capacitor TTS com engine de pronúncia natural fonética
- [x] Gatilho configurável: Por distância (ex.: a cada 500m, 1km, 2km, 5km) ou Por tempo (ex.: a cada 1min, 2min, 3min, 5min, 10min)
- [x] Métricas faladas customizáveis: Distância total, Tempo decorrido, Pace médio, Pace instantâneo, Split do último km, FC (bpm) e Zona de FC atual (Z1-Z5)
- [x] Controles avançados de áudio: sliders de velocidade da fala (0.7x - 1.5x) e volume (20% - 100%)
- [x] Botão de prévia instantânea da voz (*"Ouvir Prévia da Voz"*) para testar antes de correr
- [x] Acesso rápido com modal na tela de gravação (modo normal e modo treino) e configurações salvas no Perfil
- [x] Suporte completo aos idiomas Português (PT-BR) e Inglês (EN-US)

---

### 21. Auto-Pause Inteligente & Detecção Automática de Paradas — ✅ Concluído
**Esforço:** S · **Prioridade:** Média · **Inspiração:** Strava / Garmin

Pausar o cronômetro automaticamente ao parar em semáforos ou cruzamentos urbanos, evitando distorções no ritmo médio.

- [x] Algoritmo de detecção de velocidade mínima (< 1.5 km/h por mais de 3 segundos consecutivos)
- [x] Distinção clara entre Tempo Total Decorrido (Elapsed Time) e Tempo em Movimento (Moving Time)
- [x] Ritmo Médio baseado exclusivamente no tempo em movimento
- [x] Opção ativável/desativável na tela de gravação ou nas configurações do perfil
- [x] Alertas sonoros / por voz ao pausar e retomar automaticamente
- [x] Ajuste de sensibilidade de parada (Corrida 1.5 km/h, Caminhada 0.8 km/h, Parada total 0.5 km/h) e delay (2s, 3s, 5s)
- [x] Feedback sonoro e de fala natural ao pausar e ao retomar

---

### 22. Mapa de Calor Pessoal (Personal Heatmap) — ✅ Concluído
**Esforço:** M · **Prioridade:** Média · **Inspiração:** Strava Summit (Recurso Pro)

Visualizar todas as corridas e rotas já realizadas sobrepostas em um único mapa da cidade, revelando a intensidade das ruas mais percorridas (estilo Strava Heatmap Pro, 100% offline e gratuito).

- [x] Renderização local de alta performance com Leaflet Polyline Glow Multi-camada (Outer Glow + Core Crisp) para mesclagem térmica cumulativa
- [x] 5 temas visuais térmicos selecionáveis: *Fogo Neon*, *Ciano Cyber*, *Sunset Magenta*, *Solar Lime* e *Laranja Strava*
- [x] 4 estilos de mapa base: *CartoDB Dark Matter*, *CartoDB Voyager (Claro)*, *OpenStreetMap Padrão* e *Satélite Esri World Imagery*
- [x] Filtros interativos instantâneos: Por modalidade (Todas, Corrida, Caminhada, Ciclismo, Outros) e Por ano de realização
- [x] Ajustes finos de espessura de traçado (Fino, Médio, Grosso), slider de opacidade e alternância para incluir rotas salvas
- [x] Popups informativos ao tocar nas rotas com data, distância, ritmo, modalidade e link direto para detalhes da atividade
- [x] Banner de telemetria com contagem de treinos renderizados, km totais mapeados e total de pontos GPS
- [x] Modo de tela cheia (Fullscreen) e botão de recentralização inteligente com ajuste automático de limites (fitBounds)
- [x] 100% processado no dispositivo localmente via IndexedDB/Dexie, garantindo privacidade absoluta dos locais de treino

---

### 23. Criador de Treinos Estruturados & Intervalados (Interval Builder) — ✅ Concluído
**Esforço:** L · **Prioridade:** Média · **Inspiração:** Garmin Workouts / NRC

Permitir que o corredor crie e execute treinos intervalados (tiros, fartlek, pirâmide) com avisos na tela e por voz.

- [x] Editor visual de etapas: Aquecimento, Repetições (ex.: $6 \times 400\text{m}$ tiro @ ritmo alvo com $1\text{min}$ descanso) e Desaquecimento
- [x] 5 Presets Oficiais integrados: *6x 400m Clássico*, *Pirâmide 100m a 800m*, *Fartlek Urbano*, *Tempo Run 4km*, *Regenerativo Z2*
- [x] Biblioteca de treinos com abas (*Todos*, *Oficiais*, *Meus Treinos*), criação, duplicação, edição e exclusão
- [x] Interface de gravação dedicada ao treino estruturado (HUD com barra de progresso da série atual, contagem regressiva, ritmo instantâneo vs alvo)
- [x] Alertas sonoros (bips 3..2..1 sintetizados via Web Audio API) e de voz anunciando a transição de cada bloco (*"Início do tiro 2 de 6. Mantenha ritmo abaixo de 4:30!"*)
- [x] Botão de avanço manual de série (*Avançar Série / Lap*) e suporte a voltas abertas (Open Lap)
- [x] Relatório pós-treino com análise de cumprimento de metas em cada parcial do intervalo exibido nos detalhes da atividade

---

### 24. Previsão de Tempo de Prova & Estimativa de VO2 Max Local — ✅ Concluído
**Esforço:** M · **Prioridade:** Baixa–Média · **Inspiração:** Garmin Connect / Runalyze

Estimativas científicas de condicionamento e previsões para distâncias populares baseadas no histórico recente.

- [x] Estimativa local de VO2 Max calculada a partir do ritmo sustentado e FC cardíaca (Jack Daniels VDOT, Uth HR ratio, Running Economy)
- [x] Previsão de tempo para provas clássicas: **5 km**, **10 km**, **21.1 km (Meia Maratona)** e **42.2 km (Maratona)** usando a fórmula de Peter Riegel
- [x] Painel de "Idade de Condicionamento Físico" (Fitness Age) e medidor visual no Dashboard e no Perfil
- [x] Pontuação de VO2 Max individual calculada e exibida nos detalhes de cada treino

---

### 25. Polimento Visual Neo-Athletic & Micro-Interações Táteis
**Esforço:** S · **Prioridade:** Média · **Inspiração:** Apple Fitness+ / Adidas Running 2026

Elevar o nível sensorial e visual do aplicativo com animações fluidas e feedback físico.

- [ ] Feedback tátil háptico (Capacitor Haptics) nos botões de Play/Pause, fechamento de split e conquistas
- [ ] Contador de Consistência Semanal (*Streaks*) na Home com ícone de chama animada 🔥 (ex.: "4 semanas seguidas!")
- [ ] Efeito de confetes / celebração visual ao bater um Recorde Pessoal (PR) ou concluir um treino longo
- [ ] Modo de alto contraste / Outdoor Sun Mode na tela de gravação para dias ensolarados

---

### 10. Publicação na Play Store & Release Assinado (Fase Final de Distribuição)
**Esforço:** M · **Prioridade:** Conclusão do Ciclo

- [ ] Geração de chave de assinatura `keystore` protegida
- [ ] Configuração do Gradle para build otimizado de Release (`assembleRelease` / `bundleRelease` AAB)
- [ ] Splash screen nativa adaptativa e ícones nos formatos Android
- [ ] Política de privacidade (declaração de dados 100% locais sem rastreamento)
- [ ] Pacote F-Droid / GitHub Releases como canal open-source

---

## 🗺️ Fluxograma de Dependências da Fase 2.0

```mermaid
flowchart TD
  F18[18 Card de Compartilhamento Social] --> F25[25 Polimento Visual & Haptics]
  F19[19 Zonas de FC & TRIMP] --> F24[24 VO2 Max & Previsão de Provas]
  F20[20 Voice Coach / Audio Cues] --> F23[23 Treinos Intervalados]
  F21[21 Auto-Pause Inteligente] --> F23
  F22[22 Mapa de Calor Pessoal] --> F10[10 Play Store Release]
  F25 --> F10
  F24 --> F10
  F23 --> F10
```

*Última atualização: agosto 2026 — Criador de Treinos Estruturados & Intervalados (Feature 23) concluído*


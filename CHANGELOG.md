# Changelog

## 2026-08-23 — Etapa 9: Cards Sociais & Heatmap Térmico Dedicados para Ciclismo

### Features
- **Cards Sociais de Ciclismo (`SocialShareCardModal` & `social-card.ts`)**: Renderização inteligente para Stories (9:16) e Feed (1:1) com dados exclusivos de bike (Velocidade Média km/h, Velocidade Máxima, Altimetria, Potência Watts, Cadência RPM, FC e Calorias).
- **Tema Visual *Peloton Tech***: Novo tema de card social estilo fibra de carbono escuro com grid tecnológico, brilho neon âmbar e ciano.
- **Suporte a Foto da Bike como Background**: Upload e ajuste automático com overlay gradiente escuro de alta legibilidade.
- **Heatmap com Filtro Rápido Multi-Esporte (`PersonalHeatmap`)**: Barra de pílulas rápidas no topo do mapa (Todos, 🏃 Corrida, 🚴 Ciclismo, 🚶 Caminhada) para visualização instantânea da malha viária pedalada.
- **Tema Térmico *Velo Gold***: Paleta de cores exclusiva para rotas de pedal com traçado neon em dourado âmbar `#f59e0b` e ciano `#06b6d4`.
- **Popups de Atividade no Heatmap**: Detalhamento contextual no clique da rota mostrando velocidade média (km/h) e potência média (Watts) para treinos de ciclismo.

## 2026-08-23 — Etapa 8: Gráficos Avançados & Análise Pós-Pedal (Power Curve, Cadence & PRs)

### Features
- **Curva de Potência-Duração & Melhores Esforços (`PowerDurationCurve` & `power-curve.ts`)**: Motor algorítmico de Potência Média Máxima (MMP) segundo a segundo com cálculo de melhores esforços contínuos (Pico 5s, 15s, 30s, 1m, 2m, 5m, 10m, 20m, 30m, 60m), relação W/kg e % FTP do ciclista em gráfico semi-logarítmico na tela de detalhes da atividade.
- **Gráficos Interativos Sincronizados com Crosshair & HUD de Telemetria**: Cursor de sincronização vertical com arrasto por toque/mouse entre todos os gráficos (Velocidade, Ritmo, Potência, Cadência, Elevação, Frequência Cardíaca) com barra de telemetria instantânea no topo exibindo km, vel, W, RPM, altimetria e bpm simultaneamente.
- **Gráfico de Cadência de Pedalada (RPM)**: Série temporal de cadência renderizada na tela de detalhes para ciclistas e corredores com sensores.
- **Recordes Pessoais (PRs) Exclusivos de Ciclismo**: Suporte completo a 6 categorias de recordes para bike (Maior Distância, Maior Velocidade Média em treinos $\ge 10\text{ km}$, Velocidade Máxima Registrada, Maior Altimetria, Melhor Potência Média em $\ge 10\text{ min}$ e Maior Duração) com abas de modalidade na Home (`PersonalRecordsCard`), badges nas listagens e celebração com confetes.

## 2026-08-23 — Etapa 7: Treinos Estruturados de Ciclismo & Zonas de Potência (Coggan)

### Features
- **Configuração de FTP & Zonas de Potência (Watts)**: Adicionado campo de Potência Limiar Funcional (FTP em Watts) no perfil de usuário com cálculo dinâmico de W/kg e calculadoras embutidas (Teste de 20 min com $P_{20} \times 0.95$ e Estimativa por Nível de Aptidão/Peso).
- **Zonas de Potência de Andrew Coggan (Z1 a Z7)**: Motor completo das 7 zonas clássicas de potência (Z1 Recuperação Ativa até Z7 Potência Neuromuscular), com cálculo de Potência Normalizada (NP™), Fator de Intensidade (IF), Training Stress Score (TSS) e Relação Potência/Peso.
- **Painel Analítico de Potência (`PowerZonesPanel`)**: Gráfico empilhado das 7 zonas, métricas avançadas de carga (NP, IF, TSS, VI, W/kg) e detalhamento de tempo em cada zona na tela de detalhes da atividade.
- **Presets Oficiais de Treinos de Ciclismo**: 5 novos treinos estruturados para ciclistas (*Sprints de Cadência*, *Tiros VO2 Max*, *Sweet Spot*, *Resistência Z2* e *Protocolo Teste de FTP 20 Min*).
- **HUD e Ciclocomputador com Metas em Tempo Real**: Telemetria em tempo real no Ciclocomputador e HUD com status dinâmico de Potência (Watts) e Cadência (RPM), botão de avançar etapa (lap) e feedback por voz contextual do Voice Coach em Português e Inglês.
- **Biblioteca e Construtor de Treinos Multi-Esporte**: Filtros rápidos por modalidade (Corrida vs Ciclismo) e suporte a metas de Watts, % FTP, Zonas Coggan e RPM.

## 2026-07-09

### Features
- Added **offline route navigation** with spoken off-route alerts while running.
- Added **altitude correction** and the ability to **merge GPX routes with FIT heart-rate data**.
- Added full **backup and restore** so users can export and import their local data safely.
- Added an offline **Virtual Partner (Ghost Runner)** to pace against goals or previous workouts.
- Added **Bluetooth heart-rate monitor support** for compatible watches and chest straps.
- Added a **fullscreen training mode** with large metrics and screen wake lock during recording.
- Added **personal achievements** and **equipment analytics** to track progress and gear usage.
- Added an **advanced statistics dashboard** with richer charts and historical insights.
- Added an **onboarding wizard** for first-time setup.
- Added **multilingual support** for Brazilian Portuguese and English.
- Added automatic **Personal Records (PRs)** tracking.

### Bug Fixes
- Improved BLE integration by moving workout recording to a native-compatible `BleClient`, improving Android reliability.

### Chores
- Updated README and roadmap documentation to reflect delivered features.
- Added and refined project build rules/documentation.
- Improved app performance in GPS calculations, database read loops, map rendering, and pagination responsiveness.
- Updated onboarding/profile regional flag assets for localization consistency.

### Breaking Changes
- None.

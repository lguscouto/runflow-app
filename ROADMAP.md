# RunFlow — Roadmap

Prioridades sugeridas para as **10 próximas features**, com base no que o app já faz hoje (gravar treino, importar GPX/FIT, perfil, calorias estimadas, APK Android).

Legenda de esforço: **S** (pequeno) · **M** (médio) · **L** (grande)

---

## 1. Exportar treinos em GPX ✅

**Esforço:** S · **Prioridade:** Alta · **Status:** Concluído

Permitir exportar qualquer atividade gravada ou importada para `.gpx`, para backup ou uso em outros apps (Strava, Komoot, etc.).

- [x] Botão “Exportar GPX” na tela de detalhe do treino
- [x] Compartilhar arquivo no Android (share sheet)
- [x] Download direto no navegador

---

## 2. Gráficos de ritmo, elevação e FC ✅

**Esforço:** M · **Prioridade:** Alta · **Status:** Concluído

Visualizar a evolução ao longo do treino, como no Strava.

- [x] Gráfico de ritmo por km ou por distância
- [x] Gráfico de altitude (quando houver dados)
- [x] Gráfico de frequência cardíaca (treinos FIT)

---

## 3. Metas semanais e progresso ✅

**Esforço:** M · **Prioridade:** Alta · **Status:** Concluído

Motivar uso contínuo com metas configuráveis.

- [x] Meta de distância (km/semana) e/ou número de treinos (Perfil)
- [x] Barra de progresso na home
- [x] Aviso visual ao atingir 100% da meta

---

## 4. Recordes pessoais (PRs) ✅

**Esforço:** M · **Prioridade:** Média · **Status:** Concluído

Destacar melhores marcas automaticamente.

- [x] Maior distância em um treino
- [x] Melhor ritmo médio (distância mínima configurável, ex. 5 km)
- [x] Maior duração / maior elevação
- [x] Badge “PR” (troféu dourado) na lista, detalhe e home

---

## 5. Divisão por voltas / km (splits) ✅

**Esforço:** M · **Prioridade:** Média · **Status:** Concluído

Tabela de parciais automáticos.

- [x] Splits por quilômetro (tempo, ritmo, elevação)
- [x] Exibir na tela de detalhe abaixo do mapa
- [ ] Suporte a voltas manuais (botão “Volta” durante gravação) — pendente/futuro

---

## Extra: Suporte Multilíngue (Português & Inglês) ✅

**Esforço:** M · **Prioridade:** Alta · **Status:** Concluído

Tradução e internacionalização completa do aplicativo para Português (PT) e Inglês (EN).

- [x] Dicionários completos para PT e EN
- [x] Hook de tradução client-side (`useI18n`) e Context Provider
- [x] Configuração e preferência de idioma na tela de Perfil com salvamento dinâmico
- [x] Tradução de toda a interface, gráficos, mapas, e guias de importação


---

## 6. Histórico e estatísticas avançadas ✅

**Esforço:** M · **Prioridade:** Média · **Status:** Concluído

Painel além do resumo atual da home.

- [x] Gráfico de volume semanal/mensal (km e tempo)
- [x] Média de ritmo e calorias no período
- [x] Filtro por tipo: corrida, caminhada, ciclismo
- [x] Total acumulado no ano

---

## 7. Tela escura durante gravação (modo treino) ✅

**Esforço:** S · **Prioridade:** Média · **Status:** Concluído

Experiência focada e imersiva enquanto corre.

- [x] UI fullscreen com tempo, distância e ritmo em fonte gigante
- [x] Manter tela ligada (`Screen Wake Lock API`) no Android e Chrome
- [x] Botão toggle entre Modo Treino e Modo Completo (com mapa)
- [x] Indicador de status GPS/pausa minimalista no topo
- [x] Botões Pausar / Finalizar grandes e bem espaçados no rodapé
- [x] Fallback silencioso para browsers sem suporte à Wake Lock (Firefox etc.)

---

## 8. Backup e restauração de dados ✅

**Esforço:** M · **Prioridade:** Média · **Status:** Concluído

Evitar perda ao trocar de celular.

- [x] Exportar backup JSON (atividades + perfil + pontos GPS)
- [x] Importar backup no mesmo ou outro dispositivo
- [ ] Opcional: backup automático para pasta do celular (futuro)

---

## 9. Integração com frequência cardíaca em tempo real ✅

**Esforço:** L · **Prioridade:** Baixa–média · **Status:** Concluído

Melhorar gravação e calorias com FC ao vivo.

- [x] Conectar relógio/pulseira ou cinta cardíaca genérica via Bluetooth Low Energy (BLE)
- [x] Abstração multiplataforma (Web Bluetooth API + Plugin nativo do Android/iOS via Capacitor)
- [x] Exibir FC ao vivo e salvar no treino gravado
- [x] Obter médias (avgHr) e máximos (maxHr) de frequência cardíaca no resumo das atividades

---

## 10. Publicação na Play Store (release assinado)

**Esforço:** M · **Prioridade:** Baixa (quando estável)

Distribuir para mais pessoas sem instalar APK manualmente.

- Build de release assinado (keystore)
- Ícone e splash screen dedicados
- Política de privacidade (dados 100% locais)
- Listagem F-Droid como alternativa open source

---

## 11. Assistente de configuração inicial (Wizard de Boas-vindas) ✅

**Esforço:** S · **Prioridade:** Alta · **Status:** Concluído

Melhorar a experiência de onboarding do usuário logo no primeiro uso do aplicativo.

- [x] Detectar se é o primeiro acesso ao aplicativo (ausência de perfil configurado no IndexedDB)
- [x] Apresentar um modal ou tela passo a passo (Wizard) amigável com design premium dark e glassmorphic
- [x] Solicitar nome, preferência de idioma (com tradução reativa imediata), dados físicos (peso, altura, idade) e metas semanais
- [x] Salvar automaticamente essas informações no perfil para personalização imediata (como o cálculo de calorias dos treinos) e exibir saudação personalizada

---

## 12. Conquistas Pessoais e Analytics de Equipamentos ✅

**Esforço:** S · **Prioridade:** Média · **Dificuldade:** Fácil · **Status:** Concluído

Gamificação introspectiva e controle estatístico de tênis/calçados.

- [x] 10 conquistas (insígnias) calculadas dinamicamente com base no histórico de treinos
- [x] Cadastro e gerenciamento de tênis/calçados com limite de km recomendado e barra de desgaste
- [x] Associação automática do tênis padrão a novos treinos (gravação e importação GPX/FIT)
- [x] Seletor de tênis na tela de detalhe do treino para alterar ou remover associação
- [x] Abas de "Dados do Perfil", "Tênis / Equipamentos" e "Minhas Conquistas" na tela de Perfil
- [x] Banco de dados IndexedDB atualizado para v3 com store `gear`

---

## 13. Competidor Virtual / Ghost Runner Offline ✅

**Esforço:** M · **Prioridade:** Média · **Dificuldade:** Média · **Status:** Concluído

Correr contra o ritmo de atividades anteriores ou contra uma meta fixa.

- [x] Comparar distâncias e ritmos acumulados em tempo real com o treino de referência
- [x] Avisos de voz dinâmicos (Web Speech API / Capacitor TTS) ditando atraso/vantagem em metros ou segundos

---

## 14. Motor de Enriquecimento e Correção de Altimetria

**Esforço:** M · **Prioridade:** Baixa · **Dificuldade:** Média

Melhorar e unificar dados de sensores locais.

- [x] Mesclar dados de arquivos de GPS (.gpx) com dados de batimentos cardíacos (.fit) de relógios locais
- [x] Obter altitudes corretas consultando APIs de mapeamento topográfico aberto
- [x] Merge de HR (FIT) em atividade GPX já existente (pós-importação)
- [x] Retry e tratamento de rate-limit na correção de altimetria
- [x] Feedback de progresso na correção de elevação

---

## 15. Sincronização Multidispositivo Sem Servidor

**Esforço:** L · **Prioridade:** Média · **Dificuldade:** Alta

Manter dados atualizados em vários aparelhos sem usar um banco de dados centralizado do RunFlow.

- [ ] Sincronização local-first com nuvens do usuário (Google Drive, Nextcloud, iCloud)
- [ ] Sincronização via rede local (P2P Wi-Fi Sync) entre computador e celular

---

## 16. Navegação Offline e Alerta de Desvio de Rota

**Esforço:** L · **Prioridade:** Baixa · **Dificuldade:** Alta

Seguir rotas importadas sem conexão à internet.

- [x] Store `routes` no IndexedDB (SavedRoute, RouteConfig, OffRouteState)
- [x] Importar GPX como rota (não como atividade)
- [x] Algoritmo de proximidade geométrica (point-to-polyline)
- [x] Detecção de desvio de rota + alertas de voz durante gravação
- [x] Página "Minhas Rotas" (`/rotas/`)
- [x] Seletor de rota na tela de gravação
- [x] Indicador visual "Na rota / Fora da rota!" durante treino
- [x] Ferramenta de desenho de rotas no mapa (`/rotas/criar/`)
- [x] Overlay da rota planejada no mapa de detalhe da atividade
- [x] Link "Rotas" na navbar
- [ ] Testes de validação completa no emulador (importar GPX, desenhar, navegar)

---

## 17. Replay e Visualização da Atividade em 3D (Flyover)

**Esforço:** L · **Prioridade:** Baixa · **Dificuldade:** Alta

Uma visualização premium e interativa do percurso.

- [ ] Renderizar o trajeto do treino em 3D (Three.js / WebGL) com dados topográficos locais
- [ ] Animação de câmera (flyover) e mapa de calor de velocidade ao longo da rota

---

## Ideias para depois do top 17

- Modo escuro/claro configurável
- Múltiplos perfis no mesmo aparelho
- Planejamento de treino (ex.: plano 5K / 10K)
- Comparar dois treinos lado a lado
- Widget Android com resumo da semana
- Suporte a TCX além de GPX/FIT
- Zonas de ritmo e FC configuráveis no perfil

---

## Ordem sugerida de implementação

```mermaid
flowchart LR
  F1[1 Exportar GPX] --> F2[2 Gráficos]
  F2 --> F3[3 Metas semanais]
  F3 --> F5[5 Splits]
  F5 --> F4[4 PRs]
  F4 --> F11[11 Wizard]
  F11 --> F6[6 Estatísticas]
  F6 --> F7[7 Modo treino]
  F7 --> F8[8 Backup]
  F8 --> F9[9 FC BLE]
  F9 --> F10[10 Play Store]
  F10 --> F12[12 Conquistas & Gear]
  F12 --> F13[13 Ghost Runner]
  F13 --> F14[14 Enriquecimento]
  F14 --> F15[15 Cloud Sync]
  F15 --> F16[16 Rota Offline]
  F16 --> F17[17 Flyover 3D]
```

| Fase | Features | Objetivo |
|------|----------|----------|
| **v0.2** | 1, 2 | Dados portáveis e análise visual |
| **v0.3** | 3, 4, 5 | Engajamento e detalhe de treino |
| **v0.4** | 11, 6, 7, 8 | Polimento, onboarding e confiança nos dados |
| **v0.5** | 9, 10 | Hardware e distribuição |
| **v0.6** | 12 | Gamificação e controle de equipamentos ✅ |
| **v0.6.1** | 7 | Modo Treino fullscreen + Wake Lock ✅ |
| **v0.6.2** | — | Otimização de Código e Desempenho (Android/Capacitor) ✅ |
| **v0.7** | 13 | Competidor Virtual / Ghost Runner Offline ✅ |
| **v0.7.1** | 8 | Backup e Restauração de Dados ✅ |
| **v0.7.2** | 14 | Motor de Enriquecimento e Correção de Altimetria ✅ |
| **v0.8** | 16 | Navegação Offline e Alerta de Desvio de Rota ✅ (implementação) |
| **v0.8+** | 15, 17 | Sincronização avançada e recursos 3D (cloud sync, flyover) |

---

*Última atualização: junho 2026 — Navegação Offline (Feature 16) implementada — validação pendente*


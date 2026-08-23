import type { StructuredWorkout } from "./types";

export const BUILTIN_WORKOUT_PRESETS: StructuredWorkout[] = [
  {
    id: "preset-6x400m",
    name: "6 x 400m Clássico (VO2 Max)",
    description: "Séries clássicas de velocidade para ganho de potência aeróbica e tolerância ao lactato.",
    sport: "running",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "w-warmup",
        type: "warmup",
        name: "Aquecimento Progressivo",
        targetType: "distance",
        targetValue: 1000,
        notes: "Comece em ritmo bem leve e aumente gradualmente.",
      },
      {
        id: "w-repeat-block-1",
        type: "repeat",
        repeats: 6,
        steps: [
          {
            id: "step-work",
            type: "work",
            name: "Tiro 400m",
            targetType: "distance",
            targetValue: 400,
            paceTarget: {
              minPaceSecKm: 250, // 4:10/km
              maxPaceSecKm: 275, // 4:35/km
            },
            notes: "Mantenha postura firme e ritmo uniforme.",
          },
          {
            id: "step-rec",
            type: "recovery",
            name: "Recuperação Ativa",
            targetType: "time",
            targetValue: 90, // 90 segundos
            notes: "Caminhe ou trote bem suave para baixar os batimentos.",
          },
        ],
      },
      {
        id: "w-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "distance",
        targetValue: 1000,
        notes: "Trote regenerativo e soltura muscular.",
      },
    ],
  },
  {
    id: "preset-pyramid",
    name: "Pirâmide de Velocidade (100m a 800m)",
    description: "Subida e descida de distâncias com intensidades dinâmicas para explosão e resistência.",
    sport: "running",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "p-warmup",
        type: "warmup",
        name: "Aquecimento",
        targetType: "distance",
        targetValue: 1000,
      },
      {
        id: "p-100",
        type: "work",
        name: "Tiro 100m (Sprint)",
        targetType: "distance",
        targetValue: 100,
        paceTarget: { minPaceSecKm: 220, maxPaceSecKm: 245 },
      },
      {
        id: "p-rec-1",
        type: "recovery",
        name: "Recuperação",
        targetType: "time",
        targetValue: 60,
      },
      {
        id: "p-200",
        type: "work",
        name: "Tiro 200m",
        targetType: "distance",
        targetValue: 200,
        paceTarget: { minPaceSecKm: 235, maxPaceSecKm: 260 },
      },
      {
        id: "p-rec-2",
        type: "recovery",
        name: "Recuperação",
        targetType: "time",
        targetValue: 75,
      },
      {
        id: "p-400",
        type: "work",
        name: "Tiro 400m",
        targetType: "distance",
        targetValue: 400,
        paceTarget: { minPaceSecKm: 250, maxPaceSecKm: 275 },
      },
      {
        id: "p-rec-3",
        type: "recovery",
        name: "Recuperação",
        targetType: "time",
        targetValue: 90,
      },
      {
        id: "p-800",
        type: "work",
        name: "Tiro 800m (Topo)",
        targetType: "distance",
        targetValue: 800,
        paceTarget: { minPaceSecKm: 265, maxPaceSecKm: 290 },
      },
      {
        id: "p-rec-4",
        type: "recovery",
        name: "Recuperação Longa",
        targetType: "time",
        targetValue: 120,
      },
      {
        id: "p-400-down",
        type: "work",
        name: "Tiro 400m",
        targetType: "distance",
        targetValue: 400,
        paceTarget: { minPaceSecKm: 250, maxPaceSecKm: 275 },
      },
      {
        id: "p-rec-5",
        type: "recovery",
        name: "Recuperação",
        targetType: "time",
        targetValue: 90,
      },
      {
        id: "p-200-down",
        type: "work",
        name: "Tiro 200m (Final)",
        targetType: "distance",
        targetValue: 200,
        paceTarget: { minPaceSecKm: 230, maxPaceSecKm: 255 },
      },
      {
        id: "p-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "distance",
        targetValue: 1000,
      },
    ],
  },
  {
    id: "preset-fartlek-30min",
    name: "Fartlek Urbano (6x 2min Forte / 2min Leve)",
    description: "Treino sueco de variação livre de ritmo baseado em tempo, perfeito para ruas da cidade.",
    sport: "running",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "f-warmup",
        type: "warmup",
        name: "Aquecimento",
        targetType: "time",
        targetValue: 300, // 5 min
      },
      {
        id: "f-repeat-block",
        type: "repeat",
        repeats: 6,
        steps: [
          {
            id: "f-work",
            type: "work",
            name: "Bloco Forte (Z4/Z5)",
            targetType: "time",
            targetValue: 120, // 2 min
            notes: "Aumente o ritmo para a zona de limiar.",
          },
          {
            id: "f-rec",
            type: "recovery",
            name: "Trote Suave (Z2)",
            targetType: "time",
            targetValue: 120, // 2 min
            notes: "Recupere o fôlego sem parar totalmente.",
          },
        ],
      },
      {
        id: "f-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "time",
        targetValue: 300, // 5 min
      },
    ],
  },
  {
    id: "preset-tempo-run",
    name: "Treino de Limiar / Tempo Run (4 km Firme)",
    description: "Desenvolvimento do limiar anaeróbico para sustentar ritmos rápidos em provas de 10k e Meia Maratona.",
    sport: "running",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "tr-warmup",
        type: "warmup",
        name: "Aquecimento Leve",
        targetType: "distance",
        targetValue: 1500,
      },
      {
        id: "tr-work",
        type: "work",
        name: "Bloco de Limiar Contínuo",
        targetType: "distance",
        targetValue: 4000,
        paceTarget: {
          minPaceSecKm: 275, // 4:35/km
          maxPaceSecKm: 300, // 5:00/km
        },
        notes: "Ritmo desconfortavelmente sustentável durante todos os 4 km.",
      },
      {
        id: "tr-cooldown",
        type: "cooldown",
        name: "Desaquecimento e Trote",
        targetType: "distance",
        targetValue: 1500,
      },
    ],
  },
  {
    id: "preset-recovery-z2",
    name: "Regenerativo Base Aeróbica Z2 (35 min)",
    description: "Corrida leve para estimular a capilarização muscular e recuperação ativa entre treinos fortes.",
    sport: "running",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "rec-step",
        type: "work",
        name: "Corrida Contínua em Zona 2",
        targetType: "time",
        targetValue: 2100, // 35 min
        hrZoneTarget: 2,
        notes: "Ritmo de conversa. Se a respiração ficar ofegante, diminua a velocidade.",
      },
    ],
  },
  // ── Presets Oficiais de Ciclismo (Etapa 7) ──────────────────────────────────
  {
    id: "preset-cycling-cadence-drills",
    name: "Sprints de Cadência (High Cadence Drills)",
    description: "Exercício clássico de eficiência neuromuscular para pedalada fluida, coordenação motora e economia de energia.",
    sport: "cycling",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "cad-warmup",
        type: "warmup",
        name: "Aquecimento Progressivo",
        targetType: "time",
        targetValue: 600, // 10 min
        powerZoneTarget: 2,
        cadenceTarget: { minCadenceRpm: 85, maxCadenceRpm: 95 },
        notes: "Giro fácil e solto para aquecer as pernas.",
      },
      {
        id: "cad-repeat-block",
        type: "repeat",
        repeats: 4,
        steps: [
          {
            id: "cad-work",
            type: "work",
            name: "Giro Rápido (105-120 RPM)",
            targetType: "time",
            targetValue: 60, // 1 min
            powerZoneTarget: 3,
            percentFtpTarget: { minPct: 76, maxPct: 90 },
            cadenceTarget: { minCadenceRpm: 105, maxCadenceRpm: 120 },
            notes: "Mantenha o quadril firme no selim sem quicar.",
          },
          {
            id: "cad-rec",
            type: "recovery",
            name: "Giro Leve de Recuperação",
            targetType: "time",
            targetValue: 120, // 2 min
            powerZoneTarget: 1,
            cadenceTarget: { minCadenceRpm: 80, maxCadenceRpm: 90 },
            notes: "Respire fundo e gire suave.",
          },
        ],
      },
      {
        id: "cad-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "time",
        targetValue: 300, // 5 min
        powerZoneTarget: 1,
        notes: "Soltura muscular final.",
      },
    ],
  },
  {
    id: "preset-cycling-vo2max",
    name: "Tiros VO2 Max (3x 3min @ 115% FTP)",
    description: "Estímulos acima do limiar funcional para expandir o teto aeróbico (VO2 Max) e a capacidade de suportar acelerações.",
    sport: "cycling",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "vo2-warmup",
        type: "warmup",
        name: "Aquecimento com Progressão",
        targetType: "time",
        targetValue: 600, // 10 min
        powerZoneTarget: 2,
        notes: "Aumente gradualmente a intensidade nos últimos 3 minutos.",
      },
      {
        id: "vo2-repeat-block",
        type: "repeat",
        repeats: 3,
        steps: [
          {
            id: "vo2-work",
            type: "work",
            name: "Tiro VO2 Max (Z5 110-120% FTP)",
            targetType: "time",
            targetValue: 180, // 3 min
            powerZoneTarget: 5,
            percentFtpTarget: { minPct: 110, maxPct: 120 },
            cadenceTarget: { minCadenceRpm: 90, maxCadenceRpm: 105 },
            notes: "Esforço muito forte e consistente até o último segundo.",
          },
          {
            id: "vo2-rec",
            type: "recovery",
            name: "Recuperação Ativa Z1",
            targetType: "time",
            targetValue: 180, // 3 min
            powerZoneTarget: 1,
            notes: "Giro super leve para limpar o lactato.",
          },
        ],
      },
      {
        id: "vo2-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "time",
        targetValue: 600, // 10 min
        powerZoneTarget: 1,
      },
    ],
  },
  {
    id: "preset-cycling-sweet-spot",
    name: "Sweet Spot (2x 15min @ 90% FTP)",
    description: "O equilíbrio perfeito entre benefício fisiológico e fadiga. Ideal para construir sustentação em subidas longas e contra-relógio.",
    sport: "cycling",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "ss-warmup",
        type: "warmup",
        name: "Aquecimento",
        targetType: "time",
        targetValue: 600, // 10 min
        powerZoneTarget: 2,
      },
      {
        id: "ss-repeat-block",
        type: "repeat",
        repeats: 2,
        steps: [
          {
            id: "ss-work",
            type: "work",
            name: "Bloco Sweet Spot (88-94% FTP)",
            targetType: "time",
            targetValue: 900, // 15 min
            powerZoneTarget: 4,
            percentFtpTarget: { minPct: 88, maxPct: 94 },
            cadenceTarget: { minCadenceRpm: 85, maxCadenceRpm: 95 },
            notes: "Ritmo concentrado e firme. Foco na respiração rítmica.",
          },
          {
            id: "ss-rec",
            type: "recovery",
            name: "Recuperação Leve Z1",
            targetType: "time",
            targetValue: 300, // 5 min
            powerZoneTarget: 1,
          },
        ],
      },
      {
        id: "ss-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "time",
        targetValue: 600, // 10 min
        powerZoneTarget: 1,
      },
    ],
  },
  {
    id: "preset-cycling-z2-endurance",
    name: "Resistência Z2 / Base Aeróbica (45 min)",
    description: "Pedal contínuo em Zona 2 para queima de gordura como substrato energético e aumento da densidade mitocondrial.",
    sport: "cycling",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "z2-warmup",
        type: "warmup",
        name: "Aquecimento Leve",
        targetType: "time",
        targetValue: 300, // 5 min
        powerZoneTarget: 1,
      },
      {
        id: "z2-work",
        type: "work",
        name: "Base Aeróbica Contínua (60-75% FTP)",
        targetType: "time",
        targetValue: 2100, // 35 min
        powerZoneTarget: 2,
        percentFtpTarget: { minPct: 60, maxPct: 75 },
        cadenceTarget: { minCadenceRpm: 85, maxCadenceRpm: 95 },
        notes: "Ritmo que você conseguiria manter conversando com tranquilidade.",
      },
      {
        id: "z2-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "time",
        targetValue: 300, // 5 min
        powerZoneTarget: 1,
      },
    ],
  },
  {
    id: "preset-cycling-ftp-test-20min",
    name: "Protocolo Teste de FTP (20 Min All-Out)",
    description: "Protocolo científico oficial para determinar seu Functional Threshold Power (FTP) e calibrar todas as suas 7 Zonas de Coggan.",
    sport: "cycling",
    isPreset: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "ftp-warmup",
        type: "warmup",
        name: "Aquecimento Z2",
        targetType: "time",
        targetValue: 900, // 15 min
        powerZoneTarget: 2,
      },
      {
        id: "ftp-opener",
        type: "work",
        name: "Abertura / Limpeza Z4",
        targetType: "time",
        targetValue: 300, // 5 min
        powerZoneTarget: 4,
        notes: "Aceleração controlada para preparar o sistema neuromuscular.",
      },
      {
        id: "ftp-recovery",
        type: "recovery",
        name: "Giro Leve Z1",
        targetType: "time",
        targetValue: 300, // 5 min
        powerZoneTarget: 1,
      },
      {
        id: "ftp-test-main",
        type: "work",
        name: "TESTE 20 MIN ALL-OUT",
        targetType: "time",
        targetValue: 1200, // 20 min
        notes: "Esforço MÁXIMO e uniforme que você puder sustentar durante os 20 minutos completos!",
      },
      {
        id: "ftp-cooldown",
        type: "cooldown",
        name: "Desaquecimento Regenerativo",
        targetType: "time",
        targetValue: 600, // 10 min
        powerZoneTarget: 1,
      },
    ],
  },
];
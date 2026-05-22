import type { ActivitySummary, UserProfile } from "./types";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progressCurrent: number;
  progressTarget: number;
  progressPercentage: number;
  unit: string;
}

interface AchievementDef {
  id: string;
  icon: string;
  titlePt: string;
  titleEn: string;
  descPt: string;
  descEn: string;
  target: number;
  unitPt: string;
  unitEn: string;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first_step",
    icon: "👣",
    titlePt: "Primeiro Passo",
    titleEn: "First Step",
    descPt: "Complete sua primeira atividade no app",
    descEn: "Complete your first activity in the app",
    target: 1,
    unitPt: "atividade",
    unitEn: "activity",
  },
  {
    id: "consistent_week",
    icon: "📅",
    titlePt: "Semana Consistente",
    titleEn: "Consistent Week",
    descPt: "Complete 3 ou mais treinos na mesma semana (Seg-Dom)",
    descEn: "Complete 3 or more workouts in the same week (Mon-Sun)",
    target: 3,
    unitPt: "treinos",
    unitEn: "workouts",
  },
  {
    id: "goal_reached",
    icon: "🎯",
    titlePt: "Meta Batida",
    titleEn: "Goal Reached",
    descPt: "Atinja a sua meta semanal de distância",
    descEn: "Reach your weekly distance goal",
    target: 1,
    unitPt: "meta",
    unitEn: "goal",
  },
  {
    id: "half_marathon",
    icon: "🥈",
    titlePt: "Meia-Maratona",
    titleEn: "Half Marathon",
    descPt: "Complete uma corrida de 21.1 km ou mais",
    descEn: "Complete a run of 21.1 km or more",
    target: 21.1,
    unitPt: "km",
    unitEn: "km",
  },
  {
    id: "marathon",
    icon: "🥇",
    titlePt: "Maratona",
    titleEn: "Marathon",
    descPt: "Complete uma corrida de 42.2 km ou mais",
    descEn: "Complete a run of 42.2 km or more",
    target: 42.2,
    unitPt: "km",
    unitEn: "km",
  },
  {
    id: "climber",
    icon: "⛰️",
    titlePt: "Escalador",
    titleEn: "Climber",
    descPt: "Treino com 150m ou mais de ganho de elevação",
    descEn: "Workout with 150m or more elevation gain",
    target: 150,
    unitPt: "m",
    unitEn: "m",
  },
  {
    id: "early_bird",
    icon: "🌅",
    titlePt: "Madrugador",
    titleEn: "Early Bird",
    descPt: "Inicie um treino antes das 6h da manhã",
    descEn: "Start a workout before 6:00 AM",
    target: 1,
    unitPt: "treino",
    unitEn: "workout",
  },
  {
    id: "night_rider",
    icon: "🌃",
    titlePt: "Corredor Noturno",
    titleEn: "Night Rider",
    descPt: "Inicie um treino depois das 20h",
    descEn: "Start a workout after 8:00 PM",
    target: 1,
    unitPt: "treino",
    unitEn: "workout",
  },
  {
    id: "century",
    icon: "💯",
    titlePt: "Centenário",
    titleEn: "Century",
    descPt: "Acumule 100 km de distância total no app",
    descEn: "Accumulate 100 km of total distance in the app",
    target: 100,
    unitPt: "km",
    unitEn: "km",
  },
  {
    id: "collector",
    icon: "🎖️",
    titlePt: "Colecionador",
    titleEn: "Collector",
    descPt: "Pratique pelo menos 3 tipos de esportes diferentes",
    descEn: "Practice at least 3 different types of sports",
    target: 3,
    unitPt: "esportes",
    unitEn: "sports",
  },
];

// Helper to get local YYYY-MM-DD Monday for a date string
function getWeekMondayId(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export function calculateAchievements(
  activities: ActivitySummary[],
  profile: UserProfile | undefined,
  language: "pt" | "en" = "pt"
): Achievement[] {
  // Sort activities chronologically to determine correct unlockedAt dates
  const sorted = [...activities].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  // States to keep track of unlocking conditions chronologically
  let unlockedFirstStep = false;
  let unlockedFirstStepAt: string | undefined;

  // Consistent week
  const workoutsByWeek = new Map<string, string[]>(); // weekId -> list of activity dates
  let unlockedConsistentWeek = false;
  let unlockedConsistentWeekAt: string | undefined;
  let maxWorkoutsInSingleWeek = 0;

  // Goal reached
  const distanceByWeek = new Map<string, number>(); // weekId -> total distance in meters
  let unlockedGoalReached = false;
  let unlockedGoalReachedAt: string | undefined;
  let maxDistanceInSingleWeekM = 0;
  const weeklyDistanceKm = profile?.weeklyDistanceKm || 0;
  const weeklyDistanceM = weeklyDistanceKm * 1000;

  // Half Marathon & Marathon
  let unlockedHalfMarathon = false;
  let unlockedHalfMarathonAt: string | undefined;
  let maxRunDistanceM = 0;

  let unlockedMarathon = false;
  let unlockedMarathonAt: string | undefined;

  // Climber
  let unlockedClimber = false;
  let unlockedClimberAt: string | undefined;
  let maxElevationGainM = 0;

  // Early bird & Night rider
  let unlockedEarlyBird = false;
  let unlockedEarlyBirdAt: string | undefined;
  let unlockedNightRider = false;
  let unlockedNightRiderAt: string | undefined;

  // Century (100km total)
  let accumulatedDistanceM = 0;
  let unlockedCentury = false;
  let unlockedCenturyAt: string | undefined;

  // Collector (3 unique sports)
  const uniqueSports = new Set<string>();
  let unlockedCollector = false;
  let unlockedCollectorAt: string | undefined;

  // Process activities chronologically
  for (const act of sorted) {
    const actDate = new Date(act.startedAt);
    const dateStr = actDate.toLocaleDateString();

    // 1. First step
    if (!unlockedFirstStep) {
      unlockedFirstStep = true;
      unlockedFirstStepAt = dateStr;
    }

    // 2. Consistent week (3 activities in a single Monday-Sunday week)
    const weekId = getWeekMondayId(act.startedAt);
    if (!workoutsByWeek.has(weekId)) {
      workoutsByWeek.set(weekId, []);
    }
    const weekWorkouts = workoutsByWeek.get(weekId)!;
    weekWorkouts.push(act.startedAt);
    maxWorkoutsInSingleWeek = Math.max(maxWorkoutsInSingleWeek, weekWorkouts.length);

    if (weekWorkouts.length >= 3 && !unlockedConsistentWeek) {
      unlockedConsistentWeek = true;
      unlockedConsistentWeekAt = dateStr;
    }

    // 3. Goal Reached (reached weekly distance meta)
    if (weeklyDistanceM > 0) {
      const currentWeekDist = (distanceByWeek.get(weekId) || 0) + act.distanceM;
      distanceByWeek.set(weekId, currentWeekDist);
      maxDistanceInSingleWeekM = Math.max(maxDistanceInSingleWeekM, currentWeekDist);

      if (currentWeekDist >= weeklyDistanceM && !unlockedGoalReached) {
        unlockedGoalReached = true;
        unlockedGoalReachedAt = dateStr;
      }
    }

    // 4 & 5. Half Marathon & Marathon (running only)
    if (act.sport === "running") {
      maxRunDistanceM = Math.max(maxRunDistanceM, act.distanceM);
      if (act.distanceM >= 21100 && !unlockedHalfMarathon) {
        unlockedHalfMarathon = true;
        unlockedHalfMarathonAt = dateStr;
      }
      if (act.distanceM >= 42200 && !unlockedMarathon) {
        unlockedMarathon = true;
        unlockedMarathonAt = dateStr;
      }
    }

    // 6. Climber (elevationGain >= 150m)
    if (act.elevationGainM !== null) {
      maxElevationGainM = Math.max(maxElevationGainM, act.elevationGainM);
      if (act.elevationGainM >= 150 && !unlockedClimber) {
        unlockedClimber = true;
        unlockedClimberAt = dateStr;
      }
    }

    // 7. Early bird (started before 6 AM local)
    const hour = actDate.getHours();
    if (hour < 6 && !unlockedEarlyBird) {
      unlockedEarlyBird = true;
      unlockedEarlyBirdAt = dateStr;
    }

    // 8. Night rider (started after 8 PM local)
    if (hour >= 20 && !unlockedNightRider) {
      unlockedNightRider = true;
      unlockedNightRiderAt = dateStr;
    }

    // 9. Century (100km total)
    accumulatedDistanceM += act.distanceM;
    if (accumulatedDistanceM >= 100000 && !unlockedCentury) {
      unlockedCentury = true;
      unlockedCenturyAt = dateStr;
    }

    // 10. Collector (3 different sports)
    uniqueSports.add(act.sport);
    if (uniqueSports.size >= 3 && !unlockedCollector) {
      unlockedCollector = true;
      unlockedCollectorAt = dateStr;
    }
  }

  // Map to final Achievement structure
  return ACHIEVEMENT_DEFS.map((def) => {
    let unlocked = false;
    let unlockedAt: string | undefined;
    let progressCurrent = 0;
    let progressTarget = def.target;

    switch (def.id) {
      case "first_step":
        unlocked = unlockedFirstStep;
        unlockedAt = unlockedFirstStepAt;
        progressCurrent = activities.length;
        break;

      case "consistent_week":
        unlocked = unlockedConsistentWeek;
        unlockedAt = unlockedConsistentWeekAt;
        progressCurrent = maxWorkoutsInSingleWeek;
        break;

      case "goal_reached":
        unlocked = unlockedGoalReached;
        unlockedAt = unlockedGoalReachedAt;
        progressCurrent = weeklyDistanceKm > 0 ? Number((maxDistanceInSingleWeekM / 1000).toFixed(1)) : 0;
        progressTarget = weeklyDistanceKm > 0 ? weeklyDistanceKm : 0;
        break;

      case "half_marathon":
        unlocked = unlockedHalfMarathon;
        unlockedAt = unlockedHalfMarathonAt;
        progressCurrent = Number((maxRunDistanceM / 1000).toFixed(1));
        break;

      case "marathon":
        unlocked = unlockedMarathon;
        unlockedAt = unlockedMarathonAt;
        progressCurrent = Number((maxRunDistanceM / 1000).toFixed(1));
        break;

      case "climber":
        unlocked = unlockedClimber;
        unlockedAt = unlockedClimberAt;
        progressCurrent = Math.round(maxElevationGainM);
        break;

      case "early_bird":
        unlocked = unlockedEarlyBird;
        unlockedAt = unlockedEarlyBirdAt;
        progressCurrent = unlockedEarlyBird ? 1 : 0;
        break;

      case "night_rider":
        unlocked = unlockedNightRider;
        unlockedAt = unlockedNightRiderAt;
        progressCurrent = unlockedNightRider ? 1 : 0;
        break;

      case "century":
        unlocked = unlockedCentury;
        unlockedAt = unlockedCenturyAt;
        progressCurrent = Number((accumulatedDistanceM / 1000).toFixed(1));
        break;

      case "collector":
        unlocked = unlockedCollector;
        unlockedAt = unlockedCollectorAt;
        progressCurrent = uniqueSports.size;
        break;
    }

    const title = language === "pt" ? def.titlePt : def.titleEn;
    const description = language === "pt" ? def.descPt : def.descEn;
    const unit = language === "pt" ? def.unitPt : def.unitEn;

    let progressPercentage = 0;
    if (progressTarget > 0) {
      progressPercentage = Math.min(100, Math.round((progressCurrent / progressTarget) * 100));
    } else if (unlocked) {
      progressPercentage = 100;
    }

    return {
      id: def.id,
      title,
      description,
      icon: def.icon,
      unlocked,
      unlockedAt,
      progressCurrent,
      progressTarget,
      progressPercentage,
      unit,
    };
  });
}

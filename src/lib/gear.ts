import {
  getAllStoredGear,
  getAllStoredActivities,
  putGear,
  getStoredGear,
  getStoredActivity,
  putActivity,
} from "./storage";
import type {
  Gear,
  GearType,
  BikeType,
  BikeComponent,
  BikeComponentType,
  BikeComponentMaintenanceLog,
} from "./types";
import { v4 as uuidv4 } from "uuid";

export interface GearWithUsage extends Gear {
  accumulatedDistanceM: number;
}

export interface ComponentWearStatus {
  component: BikeComponent;
  usageDistanceM: number;
  maxDistanceM: number;
  wearPercentage: number;
  remainingDistanceM: number;
  status: "good" | "warning" | "exceeded";
}

/**
 * Calcula o desgaste de um componente de bicicleta em relação à quilometragem acumulada da bike.
 */
export function calculateComponentWear(
  component: BikeComponent,
  bikeAccumulatedDistanceM: number
): ComponentWearStatus {
  const usageDistanceM = Math.max(
    0,
    bikeAccumulatedDistanceM - (component.installedDistanceM || 0)
  );
  const maxDistanceM = component.maxDistanceM || 2500000; // default 2500 km
  const wearPercentage = Math.min(
    200,
    Math.round((usageDistanceM / maxDistanceM) * 100)
  );
  const remainingDistanceM = Math.max(0, maxDistanceM - usageDistanceM);

  let status: "good" | "warning" | "exceeded" = "good";
  if (wearPercentage >= 100) {
    status = "exceeded";
  } else if (wearPercentage >= 80) {
    status = "warning";
  }

  return {
    component,
    usageDistanceM,
    maxDistanceM,
    wearPercentage,
    remainingDistanceM,
    status,
  };
}

/**
 * Retorna os componentes padrão sugeridos ao cadastrar uma bicicleta por tipo.
 */
export function getDefaultComponentsForBikeType(
  bikeType: BikeType = "road"
): BikeComponent[] {
  const now = new Date().toISOString();
  const components: BikeComponent[] = [
    {
      id: uuidv4(),
      name: "Corrente de Transmissão",
      type: "chain",
      installedDistanceM: 0,
      maxDistanceM: 2500 * 1000, // 2.500 km
      installedAt: now,
    },
    {
      id: uuidv4(),
      name: "Pneu Dianteiro",
      type: "front_tire",
      installedDistanceM: 0,
      maxDistanceM: 4500 * 1000, // 4.500 km
      installedAt: now,
    },
    {
      id: uuidv4(),
      name: "Pneu Traseiro",
      type: "rear_tire",
      installedDistanceM: 0,
      maxDistanceM: 3500 * 1000, // 3.500 km (desgaste maior na tração)
      installedAt: now,
    },
    {
      id: uuidv4(),
      name: "Pastilhas / Sapatas de Freio",
      type: "brake_pads",
      installedDistanceM: 0,
      maxDistanceM: 3000 * 1000, // 3.000 km
      installedAt: now,
    },
    {
      id: uuidv4(),
      name: "Revisão Geral Preventiva",
      type: "general_service",
      installedDistanceM: 0,
      maxDistanceM: 5000 * 1000, // 5.000 km
      installedAt: now,
    },
  ];

  if (bikeType === "mtb" || bikeType === "gravel") {
    components.push({
      id: uuidv4(),
      name: "Selante Tubeless",
      type: "tubeless_sealant",
      installedDistanceM: 0,
      maxDistanceM: 1500 * 1000, // 1.500 km ou ~4 meses
      installedAt: now,
      notes: "Repor ou verificar fluidez do líquido",
    });
  }

  return components;
}

/**
 * Lista todos os equipamentos enriquecidos com a quilometragem calculada a partir das atividades salvas.
 */
export async function listGearWithUsage(
  filterType?: GearType
): Promise<GearWithUsage[]> {
  const gears = await getAllStoredGear();
  const activities = await getAllStoredActivities();

  // Calcular distância acumulada por equipamento
  const distanceByGear = new Map<string, number>();
  for (const act of activities) {
    if (act.gearId) {
      const current = distanceByGear.get(act.gearId) || 0;
      distanceByGear.set(act.gearId, current + act.distanceM);
    }
  }

  const enriched = gears.map((gear) => {
    const activityDist = distanceByGear.get(gear.id) || 0;
    const gearType = gear.type || "shoes";
    return {
      ...gear,
      type: gearType,
      accumulatedDistanceM: (gear.initialDistanceM || 0) + activityDist,
    };
  });

  if (filterType) {
    return enriched.filter((g) => (g.type || "shoes") === filterType);
  }

  return enriched;
}

/**
 * Lista apenas Bicicletas com quilometragem e componentes.
 */
export async function listBikesWithUsage(): Promise<GearWithUsage[]> {
  return listGearWithUsage("bike");
}

/**
 * Lista apenas Tênis de corrida com quilometragem.
 */
export async function listShoesWithUsage(): Promise<GearWithUsage[]> {
  return listGearWithUsage("shoes");
}

/**
 * Define o equipamento padrão para Corrida (shoes).
 */
export async function setDefaultRunningGear(id: string | null): Promise<void> {
  const gears = await getAllStoredGear();
  for (const gear of gears) {
    const isShoe = (gear.type || "shoes") === "shoes";
    if (isShoe) {
      gear.isDefault = gear.id === id;
      await putGear(gear);
    }
  }
}

/**
 * Define o equipamento padrão para Ciclismo (bike).
 */
export async function setDefaultCyclingGear(id: string | null): Promise<void> {
  const gears = await getAllStoredGear();
  for (const gear of gears) {
    const isBike = gear.type === "bike";
    if (isBike) {
      gear.isDefaultCycling = gear.id === id;
      await putGear(gear);
    }
  }
}

/**
 * Mantém retrocompatibilidade com setDefaultGear.
 */
export async function setDefaultGear(id: string | null): Promise<void> {
  const target = id ? await getStoredGear(id) : null;
  if (target?.type === "bike") {
    await setDefaultCyclingGear(id);
  } else {
    await setDefaultRunningGear(id);
  }
}

/**
 * Registra a troca / substituição de um componente de bike, resetando o contador de desgaste
 * para a quilometragem atual da bike e adicionando registro ao histórico de manutenção.
 */
export async function replaceBikeComponent(
  bikeId: string,
  componentId: string,
  newMaxDistanceKm?: number,
  notes?: string
): Promise<GearWithUsage | null> {
  const bikes = await listBikesWithUsage();
  const bike = bikes.find((b) => b.id === bikeId);
  if (!bike) return null;

  const components = bike.components || [];
  const compIndex = components.findIndex((c) => c.id === componentId);
  if (compIndex === -1) return null;

  const comp = components[compIndex];
  const now = new Date().toISOString();

  // Histórico de manutenções
  const history: BikeComponentMaintenanceLog[] = comp.maintenanceHistory || [];
  history.push({
    id: uuidv4(),
    replacedAt: now,
    odometerKm: Math.round(bike.accumulatedDistanceM / 1000),
    notes: notes || comp.notes,
  });

  const updatedComp: BikeComponent = {
    ...comp,
    installedDistanceM: bike.accumulatedDistanceM, // Novo ponto zero para a peça nova
    maxDistanceM:
      newMaxDistanceKm != null && newMaxDistanceKm > 0
        ? newMaxDistanceKm * 1000
        : comp.maxDistanceM,
    lastServiceAt: now,
    notes: notes ?? comp.notes,
    maintenanceHistory: history,
  };

  const updatedComponents = [...components];
  updatedComponents[compIndex] = updatedComp;

  const updatedBike: Gear = {
    ...bike,
    components: updatedComponents,
  };

  await putGear(updatedBike);

  return {
    ...updatedBike,
    accumulatedDistanceM: bike.accumulatedDistanceM,
  };
}

/**
 * Adiciona um novo componente mecânico à bicicleta.
 */
export async function addBikeComponent(
  bikeId: string,
  componentData: {
    name: string;
    type: BikeComponentType;
    brandModel?: string;
    maxDistanceKm: number;
    notes?: string;
  }
): Promise<GearWithUsage | null> {
  const bikes = await listBikesWithUsage();
  const bike = bikes.find((b) => b.id === bikeId);
  if (!bike) return null;

  const now = new Date().toISOString();
  const newComponent: BikeComponent = {
    id: uuidv4(),
    name: componentData.name,
    type: componentData.type,
    brandModel: componentData.brandModel,
    installedDistanceM: bike.accumulatedDistanceM,
    maxDistanceM: componentData.maxDistanceKm * 1000,
    installedAt: now,
    notes: componentData.notes,
    maintenanceHistory: [],
  };

  const updatedComponents = [...(bike.components || []), newComponent];
  const updatedBike: Gear = {
    ...bike,
    components: updatedComponents,
  };

  await putGear(updatedBike);

  return {
    ...updatedBike,
    accumulatedDistanceM: bike.accumulatedDistanceM,
  };
}

/**
 * Remove um componente mecânico da bicicleta.
 */
export async function removeBikeComponent(
  bikeId: string,
  componentId: string
): Promise<GearWithUsage | null> {
  const bikes = await listBikesWithUsage();
  const bike = bikes.find((b) => b.id === bikeId);
  if (!bike) return null;

  const updatedComponents = (bike.components || []).filter(
    (c) => c.id !== componentId
  );
  const updatedBike: Gear = {
    ...bike,
    components: updatedComponents,
  };

  await putGear(updatedBike);

  return {
    ...updatedBike,
    accumulatedDistanceM: bike.accumulatedDistanceM,
  };
}

/**
 * Associa um equipamento a uma atividade existente.
 */
export async function associateGearToActivity(
  activityId: string,
  gearId: string | null
): Promise<void> {
  const activity = await getStoredActivity(activityId);
  if (activity) {
    activity.gearId = gearId;
    await putActivity(activity);
  }
}

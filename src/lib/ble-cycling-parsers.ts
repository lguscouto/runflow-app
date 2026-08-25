/**
 * ble-cycling-parsers.ts — Parsers BLE para sensores de ciclismo
 *
 * Cycling Speed & Cadence (CSC) Service 0x1816
 * Cycling Power (CPS) Service 0x1818
 *
 * Ref: Bluetooth SIG GATT Specifications
 */

// ─── UUIDs ──────────────────────────────────────────────────────────────────
export const CSC_SERVICE = "00001816-0000-1000-8000-00805f9b34fb";
export const CSC_MEASUREMENT_CHAR = "00002a5b-0000-1000-8000-00805f9b34fb";

export const POWER_SERVICE = "00001818-0000-1000-8000-00805f9b34fb";
export const POWER_MEASUREMENT_CHAR = "00002a63-0000-1000-8000-00805f9b34fb";

export function hasValidCscMeasurementPayload(dataView: DataView): boolean {
  if (dataView.byteLength < 1) return false;
  const flags = dataView.getUint8(0);
  let requiredBytes = 1;
  if ((flags & 0x01) !== 0) requiredBytes += 6;
  if ((flags & 0x02) !== 0) requiredBytes += 4;
  return dataView.byteLength >= requiredBytes;
}

export function hasValidCyclingPowerMeasurementPayload(dataView: DataView): boolean {
  if (dataView.byteLength < 4) return false;
  const flags = dataView.getUint16(0, true);
  let requiredBytes = 4;
  if ((flags & 0x0001) !== 0) requiredBytes += 1;
  if ((flags & 0x0004) !== 0) requiredBytes += 2;
  if ((flags & 0x0010) !== 0) requiredBytes += 6;
  if ((flags & 0x0020) !== 0) requiredBytes += 4;
  if ((flags & 0x0040) !== 0) requiredBytes += 4;
  if ((flags & 0x0080) !== 0) requiredBytes += 4;
  if ((flags & 0x0100) !== 0) requiredBytes += 3;
  if ((flags & 0x0200) !== 0) requiredBytes += 2;
  if ((flags & 0x0400) !== 0) requiredBytes += 2;
  if ((flags & 0x0800) !== 0) requiredBytes += 2;
  return dataView.byteLength >= requiredBytes;
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface CSCData {
  cadenceRpm: number | null;
  cumulativeCrankRevs?: number;
  lastCrankEventTime?: number;
  speedKmh: number | null;
  cumulativeWheelRevs?: number;
  lastWheelEventTime?: number;
}

export interface CyclingPowerData {
  instantaneousPowerWatts: number;
  cadenceRpm: number | null;
  pedalBalance?: {
    leftPercent: number;
    rightPercent: number;
  };
  accumulatedEnergyKj?: number;
  cumulativeCrankRevs?: number;
  lastCrankEventTime?: number;
}

// ─── CSC Parser (Cycling Speed & Cadence Service 0x1816) ────────────────────

/**
 * Parser stateful para a característica CSC Measurement (0x2A5B).
 *
 * Calcula cadência RPM e velocidade km/h a partir de deltas de
 * revoluções cumulativas e timestamps de alta resolução (1/1024s).
 *
 * Trata rollover de uint16 (65536) e uint32 (4294967296),
 * detecção de coasting (sem pedalada) e filtro de glitch (>250 RPM).
 */
export class CSCParser {
  private prevCrankRevs: number | null = null;
  private prevCrankEventTime: number | null = null;
  private lastCrankWallTimestamp: number = 0;

  private prevWheelRevs: number | null = null;
  private prevWheelEventTime: number | null = null;

  /** Circunferência da roda em metros (ex: 700x25c ≈ 2.105m) */
  constructor(private wheelCircumferenceMeters: number = 2.105) {}

  /**
   * Parseia um pacote CSC Measurement DataView.
   *
   * Byte layout:
   * [Flags 8bit] [Wheel Revs 32bit?] [Wheel Event 16bit?] [Crank Revs 16bit?] [Crank Event 16bit?]
   *
   * Flags:
   *  - Bit 0 (0x01): Wheel Revolution Data Present
   *  - Bit 1 (0x02): Crank Revolution Data Present
   */
  public parse(dataView: DataView): CSCData {
    let offset = 0;
    const flags = dataView.getUint8(offset);
    offset += 1;

    const hasWheelData = (flags & 0x01) !== 0;
    const hasCrankData = (flags & 0x02) !== 0;

    let cumulativeWheelRevs: number | undefined;
    let lastWheelEventTime: number | undefined;
    let speedKmh: number | null = null;

    if (hasWheelData) {
      cumulativeWheelRevs = dataView.getUint32(offset, true);
      offset += 4;
      lastWheelEventTime = dataView.getUint16(offset, true);
      offset += 2;

      speedKmh = this.calculateSpeed(cumulativeWheelRevs, lastWheelEventTime);
    }

    let cumulativeCrankRevs: number | undefined;
    let lastCrankEventTime: number | undefined;
    let cadenceRpm: number | null = null;

    if (hasCrankData) {
      cumulativeCrankRevs = dataView.getUint16(offset, true);
      offset += 2;
      lastCrankEventTime = dataView.getUint16(offset, true);
      offset += 2;

      cadenceRpm = this.calculateCadence(cumulativeCrankRevs, lastCrankEventTime);
    }

    return {
      cadenceRpm,
      cumulativeCrankRevs,
      lastCrankEventTime,
      speedKmh,
      cumulativeWheelRevs,
      lastWheelEventTime,
    };
  }

  /**
   * Calcula cadência instantânea em RPM a partir de deltas.
   * RPM = (ΔRevs × 61440) / ΔTimeTicks
   * onde ΔTimeTicks usa resolução de 1/1024s.
   */
  private calculateCadence(crankRevs: number, eventTime: number): number | null {
    const now = Date.now();

    // Primeira medição: estabelece baseline, sem cadência ainda
    if (this.prevCrankRevs === null || this.prevCrankEventTime === null) {
      this.prevCrankRevs = crankRevs;
      this.prevCrankEventTime = eventTime;
      this.lastCrankWallTimestamp = now;
      return null;
    }

    // Rollover uint16 (65536)
    let deltaRevs = crankRevs - this.prevCrankRevs;
    if (deltaRevs < 0) deltaRevs += 65536;

    let deltaTimeTicks = eventTime - this.prevCrankEventTime;
    if (deltaTimeTicks < 0) deltaTimeTicks += 65536;

    this.prevCrankRevs = crankRevs;
    this.prevCrankEventTime = eventTime;

    // Sem nova revolução ou sem delta de tempo → coasting / parado
    if (deltaRevs === 0 || deltaTimeTicks === 0) {
      // Se mais de 2s sem atividade, força cadência 0
      if (now - this.lastCrankWallTimestamp > 2000) {
        return 0;
      }
      return 0;
    }

    this.lastCrankWallTimestamp = now;

    // RPM = (ΔRevs / (ΔTimeTicks / 1024)) × 60 = (ΔRevs × 61440) / ΔTimeTicks
    const rpm = Math.round((deltaRevs * 61440) / deltaTimeTicks);

    // Filtro de sanidade: valores > 250 RPM são provavelmente glitch
    return rpm > 250 ? 0 : rpm;
  }

  /**
   * Calcula velocidade instantânea em km/h a partir de revoluções de roda.
   * v(km/h) = (ΔRevs × circumferência(m)) / (ΔTimeTicks / 1024) × 3.6
   */
  private calculateSpeed(wheelRevs: number, eventTime: number): number | null {
    if (this.prevWheelRevs === null || this.prevWheelEventTime === null) {
      this.prevWheelRevs = wheelRevs;
      this.prevWheelEventTime = eventTime;
      return null;
    }

    // Wheel revs são uint32 (rollover em 2^32)
    let deltaRevs = wheelRevs - this.prevWheelRevs;
    if (deltaRevs < 0) deltaRevs += 4294967296;

    // Wheel event time é uint16 (rollover em 65536, unidade 1/1024s)
    let deltaTimeTicks = eventTime - this.prevWheelEventTime;
    if (deltaTimeTicks < 0) deltaTimeTicks += 65536;

    this.prevWheelRevs = wheelRevs;
    this.prevWheelEventTime = eventTime;

    if (deltaRevs === 0 || deltaTimeTicks === 0) return 0;

    const timeSec = deltaTimeTicks / 1024.0;
    const distanceMeters = deltaRevs * this.wheelCircumferenceMeters;
    const speedMps = distanceMeters / timeSec;
    return Number((speedMps * 3.6).toFixed(1));
  }

  /** Reseta o estado interno (ex: ao desconectar/reconectar) */
  public reset(): void {
    this.prevCrankRevs = null;
    this.prevCrankEventTime = null;
    this.lastCrankWallTimestamp = 0;
    this.prevWheelRevs = null;
    this.prevWheelEventTime = null;
  }
}

// ─── Cycling Power Parser (CPS Service 0x1818) ─────────────────────────────

/**
 * Parser stateful para a característica Cycling Power Measurement (0x2A63).
 *
 * Extrai potência instantânea (sint16, Watts — sempre presente),
 * cadência do pedivela (se bit 5 do flags estiver set),
 * balanço de pedal L/R (se bit 0) e energia acumulada (se bit 11).
 *
 * Pula campos opcionais não utilizados (torque, extreme forces, etc).
 */
export class CyclingPowerParser {
  private prevCrankRevs: number | null = null;
  private prevCrankEventTime: number | null = null;
  private lastCrankWallTimestamp: number = 0;

  /**
   * Parseia um pacote Cycling Power Measurement DataView.
   *
   * Byte layout:
   * [Flags 16bit] [Inst Power 16bit] [optional fields based on flags...]
   */
  public parse(dataView: DataView): CyclingPowerData {
    let offset = 0;

    // 1. Flags (16-bit uint, Little-Endian)
    const flags = dataView.getUint16(offset, true);
    offset += 2;

    // 2. Potência Instantânea (16-bit sint, Watts) — SEMPRE PRESENTE
    const instantaneousPowerWatts = dataView.getInt16(offset, true);
    offset += 2;

    const result: CyclingPowerData = {
      instantaneousPowerWatts: Math.max(0, instantaneousPowerWatts),
      cadenceRpm: null,
    };

    // 3. Pedal Power Balance (Bit 0: 0x0001)
    if ((flags & 0x0001) !== 0) {
      const rawBalance = dataView.getUint8(offset);
      offset += 1;
      const isLeftReference = (flags & 0x0002) !== 0;
      const percentage = rawBalance * 0.5; // resolução 0.5%

      result.pedalBalance = {
        leftPercent: isLeftReference ? percentage : 100 - percentage,
        rightPercent: isLeftReference ? 100 - percentage : percentage,
      };
    }

    // 4. Accumulated Torque (Bit 2: 0x0004) — skip
    if ((flags & 0x0004) !== 0) {
      offset += 2;
    }

    // 5. Wheel Revolution Data (Bit 4: 0x0010) — skip
    if ((flags & 0x0010) !== 0) {
      offset += 6; // uint32 + uint16
    }

    // 6. Crank Revolution Data (Bit 5: 0x0020) → Cadência do Power Meter!
    if ((flags & 0x0020) !== 0) {
      const crankRevs = dataView.getUint16(offset, true);
      offset += 2;
      const crankEventTime = dataView.getUint16(offset, true); // unidade 1/1024s
      offset += 2;

      result.cumulativeCrankRevs = crankRevs;
      result.lastCrankEventTime = crankEventTime;
      result.cadenceRpm = this.calculateCadence(crankRevs, crankEventTime);
    }

    // 7. Extreme Force Magnitudes (Bit 6: 0x0040) — skip
    if ((flags & 0x0040) !== 0) {
      offset += 4;
    }

    // 8. Extreme Torque Magnitudes (Bit 7: 0x0080) — skip
    if ((flags & 0x0080) !== 0) {
      offset += 4;
    }

    // 9. Extreme Angles (Bit 8: 0x0100) — skip (3 bytes)
    if ((flags & 0x0100) !== 0) {
      offset += 3;
    }

    // 10. Top Dead Spot Angle (Bit 9: 0x0200) — skip
    if ((flags & 0x0200) !== 0) {
      offset += 2;
    }

    // 11. Bottom Dead Spot Angle (Bit 10: 0x0400) — skip
    if ((flags & 0x0400) !== 0) {
      offset += 2;
    }

    // 12. Accumulated Energy (Bit 11: 0x0800) — kJ
    if ((flags & 0x0800) !== 0) {
      result.accumulatedEnergyKj = dataView.getUint16(offset, true);
      offset += 2;
    }

    return result;
  }

  /**
   * Calcula cadência RPM a partir de crank revolution data do Power Meter.
   * Mesma lógica do CSCParser.calculateCadence().
   */
  private calculateCadence(crankRevs: number, eventTime: number): number | null {
    const now = Date.now();

    if (this.prevCrankRevs === null || this.prevCrankEventTime === null) {
      this.prevCrankRevs = crankRevs;
      this.prevCrankEventTime = eventTime;
      this.lastCrankWallTimestamp = now;
      return null;
    }

    let deltaRevs = crankRevs - this.prevCrankRevs;
    if (deltaRevs < 0) deltaRevs += 65536;

    let deltaTimeTicks = eventTime - this.prevCrankEventTime;
    if (deltaTimeTicks < 0) deltaTimeTicks += 65536;

    this.prevCrankRevs = crankRevs;
    this.prevCrankEventTime = eventTime;

    if (deltaRevs === 0 || deltaTimeTicks === 0) {
      if (now - this.lastCrankWallTimestamp > 2000) return 0;
      return 0;
    }

    this.lastCrankWallTimestamp = now;

    const rpm = Math.round((deltaRevs * 61440) / deltaTimeTicks);
    return rpm > 250 ? 0 : rpm;
  }

  /** Reseta o estado interno */
  public reset(): void {
    this.prevCrankRevs = null;
    this.prevCrankEventTime = null;
    this.lastCrankWallTimestamp = 0;
  }
}

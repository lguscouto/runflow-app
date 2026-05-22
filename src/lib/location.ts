import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";

export type PositionCallback = (position: {
  lat: number;
  lng: number;
  elevation?: number;
  accuracy?: number;
  timestamp: Date;
}) => void;

export async function requestLocationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (!navigator.geolocation) return false;
    return true;
  }
  const status = await Geolocation.checkPermissions();
  if (status.location === "granted") return true;
  const req = await Geolocation.requestPermissions();
  return req.location === "granted";
}

function fromCapacitorPosition(pos: Position): Parameters<PositionCallback>[0] {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    elevation: pos.coords.altitude ?? undefined,
    accuracy: pos.coords.accuracy,
    timestamp: new Date(pos.timestamp),
  };
}

export async function startWatchingPosition(
  onPosition: PositionCallback,
  onError?: (message: string) => void
): Promise<() => void> {
  if (Capacitor.isNativePlatform()) {
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15000 },
      (pos, err) => {
        if (err) {
          onError?.(err.message);
          return;
        }
        if (pos) onPosition(fromCapacitorPosition(pos));
      }
    );
    return () => {
      Geolocation.clearWatch({ id: watchId }).catch(() => {});
    };
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        elevation: pos.coords.altitude ?? undefined,
        accuracy: pos.coords.accuracy,
        timestamp: new Date(pos.timestamp),
      });
    },
    (err) => onError?.(err.message),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

export async function getCurrentPosition(): Promise<Parameters<PositionCallback>[0] | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      return fromCapacitorPosition(pos);
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            elevation: pos.coords.altitude ?? undefined,
            accuracy: pos.coords.accuracy,
            timestamp: new Date(pos.timestamp),
          }),
        reject,
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  } catch {
    return null;
  }
}

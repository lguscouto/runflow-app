export interface GpsWatchLifecycle {
  begin(): number;
  invalidate(): void;
  isCurrent(token: number): boolean;
}

export interface MountedLifecycle {
  mount(): void;
  unmount(): void;
  isMounted(): boolean;
}

export function createMountedLifecycle(): MountedLifecycle {
  let mounted = true;

  return {
    mount() {
      mounted = true;
    },
    unmount() {
      mounted = false;
    },
    isMounted() {
      return mounted;
    },
  };
}

export function createGpsWatchLifecycle(): GpsWatchLifecycle {
  let generation = 0;

  return {
    begin() {
      generation += 1;
      return generation;
    },
    invalidate() {
      generation += 1;
    },
    isCurrent(token) {
      return token === generation;
    },
  };
}
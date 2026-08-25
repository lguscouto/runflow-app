export type AndroidBackHandler = () => boolean;

const handlers: AndroidBackHandler[] = [];

export function registerAndroidBackHandler(handler: AndroidBackHandler | null): () => void {
  if (handler === null) {
    handlers.length = 0;
    return () => {};
  }

  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  };
}

export function dispatchAndroidBack(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]?.() === true) {
      return true;
    }
  }
  return false;
}

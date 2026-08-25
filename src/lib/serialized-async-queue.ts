export function createSerializedAsyncQueue<T>(
  operation: (value: T) => Promise<void>,
): (value: T) => Promise<void> {
  let tail = Promise.resolve();

  return (value: T) => {
    const next = tail.catch(() => undefined).then(() => operation(value));
    tail = next.catch(() => undefined);
    return next;
  };
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * deepMerge - merge objects deeply
 *
 * @param target - target object
 * @param sources - source objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (source === undefined) return target;

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key] as Record<string, unknown>, source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    });
  }

  return deepMerge(target, ...sources);
}

/**
 * isObject - check if an item is an object
 * @param item - item to check
 */
export function isObject(item: unknown): item is object {
  return Boolean(item && typeof item === "object" && !Array.isArray(item));
}

/**
 * compact - remove null, undefined, false, "" and 0 values from an array
 *
 * @param arr - array to compact
 */
export function compact<T>(arr: (T | null | undefined | false | "" | 0)[]): T[] {
  return arr.filter(Boolean) as T[];
}

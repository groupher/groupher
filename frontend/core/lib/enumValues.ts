/** Converts a generated enum map into a value-keyed map with uppercase keys. */
export const valueKeyedEnum = <T extends Record<string, string>>(
  source: T,
): { [K in T[keyof T]]: K } =>
  Object.fromEntries(Object.values(source).map((value) => [value, value])) as {
    [K in T[keyof T]]: K
  }

/** Lowercases one generated enum value while preserving its literal type. */
export const lowerEnumValue = <T extends string>(value: T): Lowercase<T> =>
  value.toLowerCase() as Lowercase<T>

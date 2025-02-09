/* eslint-disable import/no-unresolved */
// see: https://github.com/sindresorhus/type-fest#template-literal-types

export type {
  ScreamingSnakeCase as TSnakeUpperCase,
  NegativeInteger as TNegativeInteger,
  NonNegativeInteger as TNonNegativeInteger,
  ValueOf as TValueOf,
} from 'type-fest'

// see https://www.raygesualdo.com/posts/flattening-object-keys-with-typescript-types
export type TFlattenObjectKeys<
  T extends Record<string, unknown>,
  Key = keyof T,
> = Key extends string
  ? T[Key] extends Record<string, unknown>
    ? `${Key}.${TFlattenObjectKeys<T[Key]>}`
    : `${Key}`
  : never

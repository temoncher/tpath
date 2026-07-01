/**
 * Keeps the same nested key shape as the source locale while widening every
 * leaf to `string`. TPath needs `typeof en` with literal leaves to infer
 * interpolation arguments, but runtime dictionaries like `ru` need to provide
 * different translated text at those same leaves.
 */
export type Messages<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Messages<T[K]>;
};

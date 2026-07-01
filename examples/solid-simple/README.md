# Solid Simple Example

This example is the smallest useful Solid shape for TPath.

It creates one translator factory with `tpath<typeof en>()`, binds nested messages through `ctx`,
and lets `App` switch between `en` and `ru` at runtime. The app shows typed paths, ICU
interpolation, debug-key rendering, and one small `$exists` extension.

## What It Shows

- `src/translations/en.ts` is the source translation tree used for type inference.
- `src/translations/ru.ts` keeps the same nested shape with different text.
- The language selector swaps the nested dictionary passed into `createT`.
- `ctx.messages` owns nested lookup data instead of a closure around a module variable.
- `ctx.debug()` makes the same factory render joined keys.
- The `$exists` extension is opt-in and receives the same bound context as the formatter.
- Solid owns form state; TPath owns path collection and formatting.

## Run It

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Files To Read

- `src/App.tsx` contains the translator factory, nested lookup, and notes UI.
- `src/translations/` contains the nested dictionaries.
- `src/main.tsx` binds the browser messages.
- `src/App.test.tsx` verifies translation, interpolation, and debug behavior.

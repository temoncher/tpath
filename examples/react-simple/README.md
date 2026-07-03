# React Simple Example

This example is the smallest useful React shape for tpath.

It creates one translator factory with the local `TranslationPath<typeof en>` type, binds nested
messages through `ctx`, and lets `App` switch between `en` and `ru` at runtime. The app shows typed
paths, a small local formatter, and debug-key rendering.

## What It Shows

- [`src/translations/types.ts`](./src/translations/types.ts) contains the small local `TranslationPath` adapter.
- [`src/translations/formatMessage.ts`](./src/translations/formatMessage.ts) contains the deliberately small demo formatter.
- [`src/translations/ru.ts`](./src/translations/ru.ts) keeps the same nested shape with different text.
- The language selector swaps the nested dictionary passed into `createT`.
- `ctx.messages` owns nested lookup data instead of a closure around a module variable.
- `ctx.debug` makes the same factory render joined keys.
- The resolve function owns missing-message behavior; tpath does not add a fallback.
- React owns form state; tpath owns path collection and formatting.

## Run It

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Files To Read

- [`src/App.tsx`](./src/App.tsx) contains the translator factory, nested lookup, and notes UI.
- [`src/translations/`](./src/translations/) contains the nested dictionaries.
- [`src/main.tsx`](./src/main.tsx) binds the browser messages.
- [`src/App.test.tsx`](./src/App.test.tsx) verifies translation, interpolation, and debug behavior.

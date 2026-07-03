# React Complex Example

This example shows tpath in a heavier React app shape.

Repo Lens is split into an eagerly loaded app shell and three lazy GitHub route domains:

- `dashboard`
- `commits`
- `issues`

The app loads flat translation JSON from
[`public/translations/<locale>/<namespace>.json`](./public/translations), generates a
nested [`src/__translationMocks__/<namespace>.gen.ts`](./src/__translationMocks__) file for each English namespace file, and uses those
generated objects for type inference and test mocks. Runtime translations still come from static
JSON, so the shell and each lazy route can show loading shimmers while their own locale file is in
flight.

## What It Shows

- Static translation JSON served by Vite from [`public/translations`](./public/translations).
- [`tools/generate-translations.ts`](./tools/generate-translations.ts), which turns each flat English JSON file into
  [`<namespace>.gen.ts`](./src/__translationMocks__).
- Generated nested messages adapted with [`src/shared/TranslationPath.ts`](./src/shared/TranslationPath.ts) for tpath inference.
- Generated English messages imported in tests as stable mock values.
- Async translation loading owned by React, with the shell and every route fetching only its own
  namespace file.
- Missing translations, loading, and errors are represented by the caller-owned resolve function and `$...`
  methods instead of built-in tpath fallback behavior.
- `$loading`, an opt-in method used to render text shimmers while translations load.
- `$key`, an opt-in method used to derive stable metadata keys from translation paths.
- `$error`, an opt-in method used to read namespace-level translation loading errors.
- `$`, an opt-in id lookup method used for server-provided issue status ids.
- A GitHub API app split by feature folder, with route components, services, and stories living
  together.
- Shell-owned deps for routing, GitHub HTTP, and static translation loading.

## Translation Generation

English is the base locale:

```sh
pnpm generate:translations
```

The generator reads [`public/translations/en/*.json`](./public/translations/en) and writes matching
[`src/__translationMocks__/<namespace>.gen.ts`](./src/__translationMocks__) files. Those generated files are not the runtime delivery
format; they exist so TypeScript can infer nested paths and ICU interpolation from the English base.

## Dynamic Id Translation

The issues route pretends the server returns `status_id` values such as `needs-triage`. The UI
resolves those ids with:

```ts
t.issues.status.$(issue.statusId);
```

That keeps ordinary keys statically typed while still showing how caller-owned ids can index into a
known translation namespace.

## Run It

```sh
pnpm install
pnpm dev
pnpm test
pnpm test:types
pnpm storybook
pnpm build
```

## Files To Read

- [`tools/generate-translations.ts`](./tools/generate-translations.ts) contains the flat-JSON to nested-TS generator.
- [`src/shared/TranslationPath.ts`](./src/shared/TranslationPath.ts) contains the full translation path type adapter.
- [`src/shared/createT.ts`](./src/shared/createT.ts) contains the tpath factory, resolve function, `$`, `$key`, `$error`, and
  `$loading`.
- [`src/shared/useT.ts`](./src/shared/useT.ts) contains async locale query composition.
- [`src/app/shellDeps.ts`](./src/app/shellDeps.ts) contains static translation JSON loading for the app shell.
- [`src/app/AppShell.tsx`](./src/app/AppShell.tsx) builds shell services and displays translation shimmers.
- [`src/issues/IssuesRoute.tsx`](./src/issues/IssuesRoute.tsx) shows id-based translation from fetched issue data.

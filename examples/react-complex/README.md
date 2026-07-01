# React Complex Example

This example shows TPath in a heavier React app shape.

Repo Lens is split into an eagerly loaded app shell and three lazy GitHub route domains:

- `dashboard`
- `commits`
- `issues`

The app loads flat translation JSON from `public/translations/<locale>/<namespace>.json`, generates a
nested `src/__translationMocks__/<namespace>.gen.ts` file for each English namespace file, and uses those
generated objects for type inference and test mocks. Runtime translations still come from static
JSON, so the shell and each lazy route can show loading shimmers while their own locale file is in
flight.

## What It Shows

- Static translation JSON served by Vite from `public/translations`.
- `tools/generate-translations.ts`, which turns each flat English JSON file into
  `<namespace>.gen.ts`.
- Generated nested messages used as `typeof en` for TPath inference.
- Generated English messages imported in tests as stable mock values.
- Async translation loading owned by React, with the shell and every route fetching only its own
  namespace file.
- Missing translations, loading, and errors are represented by the caller-owned formatter and
  extensions instead of built-in TPath fallback behavior.
- `$loading`, an opt-in extension used to render text shimmers while translations load.
- `$key`, an opt-in extension used to derive stable metadata keys from translation paths.
- `$error`, an opt-in extension used to read namespace-level translation loading errors.
- `$`, an opt-in id lookup extension used for server-provided issue status ids.
- A GitHub API app split by feature folder, with route components, services, and stories living
  together.
- Shell-owned deps for routing, GitHub HTTP, and static translation loading.

## Translation Generation

English is the base locale:

```sh
pnpm generate:translations
```

The generator reads `public/translations/en/*.json` and writes matching
`src/__translationMocks__/<namespace>.gen.ts` files. Those generated files are not the runtime delivery
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

- `tools/generate-translations.ts` contains the flat-JSON to nested-TS generator.
- `src/shared/createT.ts` contains the TPath factory, formatter, `$`, `$key`,
  `$error`, and `$loading`.
- `src/shared/useT.ts` contains async locale query composition.
- `src/app/shellDeps.ts` contains static translation JSON loading for the app shell.
- `src/app/AppShell.tsx` builds shell services and displays translation shimmers.
- `src/issues/IssuesRoute.tsx` shows id-based translation from fetched issue data.

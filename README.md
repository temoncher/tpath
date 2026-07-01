# TPath

TPath is a tiny TypeScript translation helper for building typed translation paths with almost no
runtime machinery.

It is intentionally small enough to copy into a project. There is no npm package to install and no
published package workflow in this repository. Copy [`tpath.ts`](./tpath.ts) into your source tree,
install `intl-messageformat`, import it from a local path, and keep the copy close to the application
code that uses it.

## Copy Into A Project

1. Copy `tpath.ts` into your project, for example `src/tpath.ts`.
2. Install `intl-messageformat`.
3. Import it with a local path.
4. Commit the copied file with your project.

```sh
pnpm add intl-messageformat
```

```ts
import { tpath } from './tpath';
```

## Basic Usage

Describe your translation tree as a TypeScript type, then build a translator factory. TPath only
collects the path keys. Your resolver decides how those keys map to dictionaries, namespaces,
locales, remote data, or anything else.

```ts
import { tpath } from './tpath';

interface Translations {
  readonly common: {
    readonly home: {
      readonly title: 'Home';
      readonly greeting: 'Hello, {name}!';
    };
  };
}

const messages = {
  'common.home.title': 'Home',
  'common.home.greeting': 'Hello, {name}!',
};

const createT = tpath<Translations>()
  .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
  .resolve((keys, ctx) => ctx.messages[keys.join('.')]);

const t = createT({ messages });

t.common.home.title(); // "Home"
t.common.home.greeting({ name: 'Ada' }); // "Hello, Ada!"
```

Missing translations fall back to the joined key:

```ts
t.common.home.missing(); // TypeScript error
t.common.home.title(); // "common.home.title" if the resolver returns undefined
```

## Caller-Owned Resolution

The resolver function receives the collected key path as an array and the context passed to the
factory. TPath does not decide which part of the path is a namespace.

```ts
const dictionaries = {
  common: {
    'home.title': 'Home',
  },
};

const createT = tpath<Translations>()
  .ctx<{ readonly dictionaries: typeof dictionaries }>()
  .resolve((keys, ctx) => {
    const [namespace, ...messagePath] = keys;

    if (namespace === undefined) {
      return undefined;
    }

    return ctx.dictionaries[namespace]?.[messagePath.join('.')];
  });

const t = createT({ dictionaries });

t.common.home.title(); // lookup receives ["common", "home", "title"]
```

That keeps storage policy outside the helper. You can join with dots, split on the first namespace,
load by locale, merge several dictionaries, or use a completely different key strategy.

## Extension Patterns

Extensions are ordinary `$...` functions registered on the builder. TPath calls them with an
extension context first, then forwards the user arguments from the proxy call.

```ts
const loadingKeys = new Set(['common.home.title']);

const createT = tpath<Translations>()
  .ctx<{
    readonly loadingKeys: ReadonlySet<string>;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .extend({
    $exists({ keys, resolve }, child?: string) {
      return resolve(child === undefined ? keys : [...keys, child]) !== undefined;
    },
    $loading({ ctx, keys }, child?: string) {
      return ctx.loadingKeys.has((child === undefined ? keys : [...keys, child]).join('.'));
    },
  })
  .resolve((keys, ctx) => ctx.messages[keys.join('.')]);

const t = createT({ loadingKeys, messages });

t.common.home.title.$exists(); // true
t.common.home.$exists('title'); // true
t.common.home.title.$loading(); // true
```

If you want a dynamic-key escape hatch, provide it as another extension:

```ts
const createT = tpath<Translations>()
  .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
  .extend({
    $({ keys, translate }, child: string, interpolation?: object) {
      return translate([...keys, child], interpolation);
    },
  })
  .resolve((keys, ctx) => ctx.messages[keys.join('.')]);

const t = createT({ messages });

t.common.$('home.greeting', { name: 'Ada' }); // "Hello, Ada!"
```

TPath does not include built-in `$` or `$exists` methods. If an extension is not provided, it is not
part of the typed proxy.

The resolver and extensions receive the same context object passed to the factory:

```ts
const createT = tpath<Translations>()
  .ctx<{
    readonly debug: boolean;
    readonly locale: string;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .extend({
    $locale: ({ ctx }) => ctx.locale,
    $debug: ({ ctx }) => ctx.debug,
  })
  .resolve((keys, ctx) => {
    if (ctx.debug) return keys.join('.');

    return ctx.messages[keys.join('.')];
  });

const t = createT({ debug: false, locale: 'en', messages });

t.common.home.title.$locale(); // "en"
```

## Debug Pattern

TPath does not have built-in debug behavior. If you want every call to return the joined key, make
that part of your resolver policy:

```ts
const createT = tpath<Translations>()
  .ctx<{
    readonly debug: boolean;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .resolve((keys, ctx) => {
    if (ctx.debug) return keys.join('.');

    return ctx.messages[keys.join('.')];
  });

const t = createT({ debug: true, messages });

t.common.home.title(); // "common.home.title"
```

## Development

This repository exists to keep the copyable source tested and formatted.

```sh
pnpm install
pnpm test
pnpm test:types
pnpm typecheck
pnpm lint
pnpm format
```

## Examples

The `examples/react-simple` app shows the builder API in a small React app with typed paths,
context-bound messages, interpolation, debug-key rendering, and an opt-in extension.

```sh
pnpm --dir examples/react-simple install
pnpm --dir examples/react-simple dev
pnpm --dir examples/react-simple test
pnpm --dir examples/react-simple build
```

The `examples/solid-simple` app mirrors `react-simple` in a small Solid app scaffolded with Vite.
It uses the same nested dictionaries, translator context, interpolation, debug-key rendering, and
opt-in extension.

```sh
pnpm --dir examples/solid-simple install
pnpm --dir examples/solid-simple dev
pnpm --dir examples/solid-simple test
pnpm --dir examples/solid-simple build
```

The `examples/vue-simple` app mirrors `react-simple` in a small Vue app scaffolded with Vite.
It uses the same nested dictionaries, translator context, interpolation, debug-key rendering, and
opt-in extension.

```sh
pnpm --dir examples/vue-simple install
pnpm --dir examples/vue-simple dev
pnpm --dir examples/vue-simple test
pnpm --dir examples/vue-simple build
```

The `examples/react-complex` app shows a heavier GitHub UI with async static JSON translations split
by namespace, generated nested type fixtures, id-based status labels, `$loading` shimmer text, lazy
feature routes, and stories.

```sh
pnpm --dir examples/react-complex install
pnpm --dir examples/react-complex generate:translations
pnpm --dir examples/react-complex dev
pnpm --dir examples/react-complex test
pnpm --dir examples/react-complex build
```

The package is marked `"private": true` because TPath is intended to be copied, not published.

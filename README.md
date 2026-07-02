# TPath

TPath is a tiny TypeScript translation helper for building typed translation paths with almost no
runtime machinery.

It is intentionally small enough to copy into a project. There is no npm package to install and no
published package workflow in this repository. Copy [`tpath.ts`](./tpath.ts) into your source tree,
import it from a local path, and keep the copy close to the application code that uses it.

## Copy Into A Project

1. Copy `tpath.ts` into your project, for example `src/tpath.ts`.
2. Import it with a local path.
3. Commit the copied file with your project.

```ts
import { tpath } from './tpath';
```

## Basic Usage

Describe your translation tree as a TypeScript type, then build a translator factory. TPath collects
the path keys and calls your `__call` definition when a leaf is invoked. That definition decides
how those keys map to dictionaries, namespaces, locales, remote data, parsing libraries, or anything
else.

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
  .define({
    __call(ctx, keys) {
      return ctx.messages[keys.join('.')];
    },
  });

const t = createT({ messages });

t.common.home.title(); // "Home"
t.common.home.greeting({ name: 'Ada' }); // "Hello, {name}!"
```

The `__call` definition is required before the builder can create translators. TPath does not
parse messages at runtime by itself. Interpolation types are still inferred from ICU
MessageFormat-shaped string literals. The type-level parser is designed around the
[ICU message format](https://unicode-org.github.io/icu/userguide/format_parse/messages/?utm_source=chatgpt.com),
but runtime parsing is deliberately caller-owned.

The call definition also owns missing-translation and error behavior. TPath returns the definition
result as-is: if `__call` returns `undefined`, the translated call returns `undefined`; if `__call`
throws, the error propagates to the caller.

If you want ICU formatting with `intl-messageformat`, call it inside `__call`:

```sh
pnpm add intl-messageformat
```

```ts
import { IntlMessageFormat } from 'intl-messageformat';
import { tpath } from './tpath';

const createT = tpath<Translations>()
  .ctx<{
    readonly locale: string;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .define({
    __call(ctx, keys, interpolation) {
      const message = ctx.messages[keys.join('.')];

      if (message === undefined) {
        return undefined;
      }

      return new IntlMessageFormat(message, ctx.locale, undefined, { ignoreTag: true }).format(
        interpolation as any,
      ) as string;
    },
  });

const t = createT({
  locale: 'en',
  messages,
});

t.common.home.greeting({ name: 'Ada' }); // "Hello, Ada!"
```

Missing translations are caller-owned:

```ts
t.common.home.missing(); // TypeScript error
t.common.home.title(); // undefined if __call returns undefined
```

If you want joined-key fallback or debug output, return `keys.join('.')` from `__call`.

## Caller-Owned Formatting

The `__call` definition receives a `ctx` first argument with the context fields passed to the
factory, then an explicit `keys` array for the collected path. The same path is also available on
`ctx.keys` for helper methods that inspect the current node. TPath does not decide which part of
the path is a namespace.

```ts
const dictionaries = {
  common: {
    'home.title': 'Home',
  },
};

const createT = tpath<Translations>()
  .ctx<{ readonly dictionaries: typeof dictionaries }>()
  .define({
    __call(ctx, keys) {
      const [namespace, ...messagePath] = keys;

      if (namespace === undefined) {
        return undefined;
      }

      return ctx.dictionaries[namespace]?.[messagePath.join('.')];
    },
  });

const t = createT({ dictionaries });

t.common.home.title(); // lookup receives ["common", "home", "title"]
```

That keeps storage policy outside the helper. You can join with dots, split on the first namespace,
load by locale, merge several dictionaries, provide a fallback, throw on missing keys, or use a
completely different key strategy.

## Definition Patterns

Definitions can include ordinary `$...` functions. TPath exposes them on every path node and passes
the current path plus the factory context as the first `ctx` argument.

```ts
const loadingKeys = new Set(['common.home.title']);

const createT = tpath<Translations>()
  .ctx<{
    readonly loadingKeys: ReadonlySet<string>;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .define({
    $exists(ctx, child?: string) {
      return (
        ctx.messages[(child === undefined ? ctx.keys : [...ctx.keys, child]).join('.')] !==
        undefined
      );
    },
    $loading(ctx, child?: string) {
      return ctx.loadingKeys.has((child === undefined ? ctx.keys : [...ctx.keys, child]).join('.'));
    },
    __call(ctx, keys) {
      return ctx.messages[keys.join('.')];
    },
  });

const t = createT({ loadingKeys, messages });

t.common.home.title.$exists(); // true
t.common.home.$exists('title'); // true
t.common.home.title.$loading(); // true
```

If you want a dynamic-key escape hatch, provide it as another `$...` method. Use the bound
`ctx.__call(keys, interpolation)` helper to call `__call` for an explicit path without mutating the
current path.

```ts
const createT = tpath<Translations>()
  .ctx<{ readonly messages: Readonly<Record<string, string | undefined>> }>()
  .define({
    __call(ctx, keys, interpolation) {
      const message = ctx.messages[keys.join('.')];
      const values = interpolation as { readonly name: string };

      return message?.replace('{name}', values.name);
    },
    $(ctx, child: string, interpolation?: object) {
      return ctx.__call([...ctx.keys, child], interpolation);
    },
  });

const t = createT({ messages });

t.common.$('home.greeting', { name: 'Ada' }); // "Hello, Ada!"
```

TPath does not include built-in `$` or `$exists` methods. If a `$...` method is not provided, it is not
part of the typed proxy.

The call definition and named `$...` methods receive the same context fields passed to the factory:

```ts
const createT = tpath<Translations>()
  .ctx<{
    readonly debug: boolean;
    readonly locale: string;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .define({
    $locale(ctx) {
      return ctx.locale;
    },
    $debug(ctx) {
      return ctx.debug;
    },
    __call(ctx, keys) {
      if (ctx.debug) return keys.join('.');

      return ctx.messages[keys.join('.')];
    },
  });

const t = createT({ debug: false, locale: 'en', messages });

t.common.home.title.$locale(); // "en"
```

## Debug Pattern

TPath does not have built-in debug behavior. If you want every call to return the joined key, make
that part of your `__call` policy:

```ts
const createT = tpath<Translations>()
  .ctx<{
    readonly debug: boolean;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }>()
  .define({
    __call(ctx, keys) {
      if (ctx.debug) return keys.join('.');

      return ctx.messages[keys.join('.')];
    },
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
context-bound messages, interpolation, debug-key rendering, and an opt-in `$...` method.

```sh
pnpm --dir examples/react-simple install
pnpm --dir examples/react-simple dev
pnpm --dir examples/react-simple test
pnpm --dir examples/react-simple build
```

The `examples/solid-simple` app mirrors `react-simple` in a small Solid app scaffolded with Vite.
It uses the same nested dictionaries, translator context, interpolation, debug-key rendering, and
opt-in `$...` method.

```sh
pnpm --dir examples/solid-simple install
pnpm --dir examples/solid-simple dev
pnpm --dir examples/solid-simple test
pnpm --dir examples/solid-simple build
```

The `examples/vue-simple` app mirrors `react-simple` in a small Vue app scaffolded with Vite.
It uses the same nested dictionaries, translator context, interpolation, debug-key rendering, and
opt-in `$...` method.

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

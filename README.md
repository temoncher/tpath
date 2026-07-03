# tpath

tpath is a tiny TypeScript helper for building typed translation paths.

- Type-checked object paths over string-backed translation keys
- Caller-owned lookup, interpolation, missing-message, and fallback behavior
- Explicit path collection for custom resolvers and helpers
- Optional path-bound helpers like `$key`, `$exists`, or dynamic `$`

## Why tpath?

Path-like APIs often start as strings:

```ts
translate('common.home.title');
translate('common.home.greeting', { name: 'Ada' });
```

That keeps the runtime simple, but the call sites are easy to mistype and hard for TypeScript to
check. You can wrap every path by hand, but then the wrapper code becomes the thing you maintain.

tpath keeps the runtime model as caller-owned strings and arrays, but lets call sites look like a
typed object:

```ts
t.common.home.title();
t.common.home.greeting({ name: 'Ada' });
```

Property access collects the path. Calling the leaf passes the collected keys and call arguments to
your resolve function. tpath does not decide where translations live, how interpolation works, or
what should happen when a translation is missing.

The tradeoff is deliberate: keep the helper simple, keep call sites concise, keep runtime policy
under your control, and let TypeScript check the paths and arguments you actually use.

## Installation

tpath is intentionally small enough to copy into a project. There is no npm package to install and
no published package workflow in this repository.

1. Copy [`tpath.ts`](./tpath.ts) into your project, for example `src/tpath.ts`.
2. Import it with a local path.
3. Commit the copied file with your project.

```ts
import { tpath } from './tpath';
```

If you want the copied file to feel like a small local library, you can also add a TypeScript path
alias:

```json
{
  "compilerOptions": {
    "paths": {
      "tpath": ["./src/tpath.ts"]
    }
  }
}
```

Then import it by that local name:

```ts
import { tpath } from 'tpath';
```

The examples below use the `tpath` alias. If you skip the alias, keep using your relative import
instead.

## Basic Translation Usage

Start with a hand-written translation hierarchy. Function leaves describe how each translation is
called.

```ts
import { tpath } from 'tpath';

// In real apps, you usually generate this shape from locale files.
// See the react-simple example for a compact generated-type adapter.
type Translations = {
  readonly common: {
    readonly home: {
      readonly title: () => string | undefined;
      readonly greeting: (interpolation: { readonly name: string }) => string | undefined;
    };
  };
};

const messages = {
  'common.home.title': 'Home',
  'common.home.greeting': 'Hello, {name}!',
};

function formatMessage(
  message: string,
  values: Readonly<Record<string, string | number | undefined>> = {},
) {
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];

    return value === undefined ? match : String(value);
  });
}

const createT = tpath<
  Translations,
  {
    readonly messages: Readonly<Record<string, string | undefined>>;
  }
>().define((ctx, keys, interpolation) => {
  const message = ctx.messages[keys.join('.')];

  if (message === undefined) {
    return undefined;
  }

  return formatMessage(message, interpolation);
});

const t = createT({ messages });

t.common.home.title(); // "Home"
t.common.home.greeting({ name: 'Ada' }); // "Hello, Ada!"
t.common.home.greeting(); // TypeScript error
```

At runtime, `t.common.home.greeting({ name: 'Ada' })` calls your resolve function with
`keys = ['common', 'home', 'greeting']` and the interpolation object. tpath collects the path and
keeps the call typed; your code owns lookup, interpolation, and missing-message behavior.

## Deriving Translation Types From Messages

If you do not want to write the translation hierarchy by hand, you can derive it from a source
locale object. This is regular TypeScript layered on top of tpath, not part of tpath itself.

```ts
import { tpath } from 'tpath';

const en = {
  common: {
    home: {
      title: 'Home',
      greeting: 'Hello, {name}!',
    },
  },
} as const;

type Translations = typeof en;

type TranslationPath<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? TranslationCall<T[K]>
    : T[K] extends object
      ? TranslationPath<T[K]>
      : never;
};

type TranslationCall<TMessage extends string> =
  InterpolationKey<TMessage> extends never
    ? () => string | undefined
    : (
        interpolation: Readonly<Record<InterpolationKey<TMessage>, string | number>>,
      ) => string | undefined;

type InterpolationKey<TMessage extends string> =
  TMessage extends `${string}{${infer TPlaceholder}}${infer TRest}`
    ? PlaceholderName<TPlaceholder> | InterpolationKey<TRest>
    : never;

type PlaceholderName<TPlaceholder extends string> =
  Trim<TPlaceholder> extends `${infer TName},${string}` ? Trim<TName> : Trim<TPlaceholder>;

type Trim<S extends string> = S extends ` ${infer R}` | `${infer R} ` ? Trim<R> : S;

type TranslationCalls = TranslationPath<Translations>;
```

Use `TranslationCalls` where the basic example used the hand-written `Translations` type.

The local `TranslationPath` adapter is just the type-level bridge between your message literals and
callable leaves. The simple examples keep a compact adapter in
[`examples/react-simple/src/translations/types.ts`](./examples/react-simple/src/translations/types.ts),
[`examples/solid-simple/src/translations/types.ts`](./examples/solid-simple/src/translations/types.ts),
and [`examples/vue-simple/src/translations/types.ts`](./examples/vue-simple/src/translations/types.ts);
the complex React example keeps a fuller parser in
[`examples/react-complex/src/shared/TranslationPath.ts`](./examples/react-complex/src/shared/TranslationPath.ts).

## Caller-Owned Lookup

The resolve function receives a `ctx` first argument with the context fields passed to the
factory, then an explicit `keys` array for the collected path. tpath does not decide which part of
the path is a namespace, how dictionaries are stored, or what should happen when a message is
missing.

```ts
const dictionaries = {
  common: {
    'home.title': 'Home',
    'home.greeting': 'Hello, {name}!',
  },
};

const createT = tpath<
  Translations,
  { readonly dictionaries: typeof dictionaries }
>().define((ctx, keys) => {
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
load by locale, merge several dictionaries, return `undefined`, throw on missing keys, or provide a
fallback string.

## Fallback And Debug Policy

tpath returns the resolve function result as-is. If it returns `undefined`, the translated call returns
`undefined`; if it throws, the error propagates. If you want joined-key fallback or debug-key
rendering, make that part of your definition.

```ts
const createT = tpath<
  Translations,
  {
    readonly debug: boolean;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }
>().define((ctx, keys) => {
  if (ctx.debug) {
    return keys.join('.');
  }

  return ctx.messages[keys.join('.')];
});

const t = createT({ debug: true, messages });

t.common.home.title(); // "common.home.title"
```

## Translation Helpers

The second `define` argument can include ordinary `$...` functions. tpath exposes them on every path
node and passes the current path plus the factory context as the first `ctx` argument.

```ts
const loadingKeys = new Set(['common.home.title']);

const createT = tpath<
  Translations,
  {
    readonly loadingKeys: ReadonlySet<string>;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }
>().define(
  (ctx, keys) => {
    return ctx.messages[keys.join('.')];
  },
  {
    $key(ctx, key?: string) {
      return (key === undefined ? ctx.keys : [...ctx.keys, key]).join('.');
    },
    $exists(ctx, key?: string) {
      return ctx.messages[ctx.$key(key)] !== undefined;
    },
    $loading(ctx, key?: string) {
      return ctx.loadingKeys.has(ctx.$key(key));
    },
  },
);

const t = createT({ loadingKeys, messages });

t.common.home.title.$key(); // "common.home.title"
t.common.home.$exists('title'); // true
t.common.home.title.$loading(); // true
```

If your translation tree has real `$...` keys, use a symbol-keyed helper so the string key can stay
part of the collected path.

```ts
const exists = Symbol('exists');

const createT = tpath<
  {
    readonly common: {
      readonly home: {
        readonly $exists: () => string | undefined;
      };
    };
  },
  { readonly messages: Readonly<Record<string, string | undefined>> }
>().define(
  (ctx, keys) => {
    return ctx.messages[keys.join('.')];
  },
  {
    [exists](ctx, key?: string) {
      const keys = key === undefined ? ctx.keys : [...ctx.keys, key];

      return ctx.messages[keys.join('.')] !== undefined;
    },
  },
);

const t = createT({ messages });

t.common.home.$exists(); // looks up "common.home.$exists"
t.common.home[exists]('$exists'); // true
```

If you need a dynamic-key escape hatch, provide it as another `$...` method. Use the bound
`ctx.resolve(keys, ...args)` helper to run the resolve function for an explicit path without mutating
the current path.

```ts
const createT = tpath<
  Translations,
  { readonly messages: Readonly<Record<string, string | undefined>> }
>().define(
  (ctx, keys, interpolation) => {
    const message = ctx.messages[keys.join('.')];
    const values = interpolation as { readonly name: string } | undefined;

    return values === undefined ? message : message?.replace('{name}', values.name);
  },
  {
    $(ctx, key: string, interpolation?: object) {
      return ctx.resolve([...ctx.keys, key], interpolation) as string | undefined;
    },
  },
);

const t = createT({ messages });

t.common.home.$('greeting', { name: 'Ada' }); // "Hello, Ada!"
```

tpath does not include built-in `$`, `$key`, `$exists`, or `$loading` methods. If a `$...` method is
not provided, it is not part of the typed proxy.

## Examples

The [`examples/react-simple`](./examples/react-simple) app shows the definer API in a small React app with typed translation
paths, context-bound messages, interpolation, and debug-key rendering.

```sh
pnpm --dir examples/react-simple install
pnpm --dir examples/react-simple dev
pnpm --dir examples/react-simple test
pnpm --dir examples/react-simple build
```

The [`examples/solid-simple`](./examples/solid-simple) app mirrors [`react-simple`](./examples/react-simple) in a small Solid app scaffolded with Vite.
It uses the same nested dictionaries, translator context, interpolation, and debug-key rendering.

```sh
pnpm --dir examples/solid-simple install
pnpm --dir examples/solid-simple dev
pnpm --dir examples/solid-simple test
pnpm --dir examples/solid-simple build
```

The [`examples/vue-simple`](./examples/vue-simple) app mirrors [`react-simple`](./examples/react-simple) in a small Vue app scaffolded with Vite.
It uses the same nested dictionaries, translator context, interpolation, and debug-key rendering.

```sh
pnpm --dir examples/vue-simple install
pnpm --dir examples/vue-simple dev
pnpm --dir examples/vue-simple test
pnpm --dir examples/vue-simple build
```

The [`examples/react-complex`](./examples/react-complex) app shows a heavier GitHub UI with async static JSON translations split
by namespace, generated nested type fixtures, id-based status labels, `$loading` shimmer text, lazy
feature routes, and stories.

```sh
pnpm --dir examples/react-complex install
pnpm --dir examples/react-complex generate:translations
pnpm --dir examples/react-complex dev
pnpm --dir examples/react-complex test
pnpm --dir examples/react-complex build
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

The package is marked `"private": true` because tpath is intended to be copied, not published.

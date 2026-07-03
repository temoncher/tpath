# TPath

TPath is a tiny TypeScript helper for building typed proxy paths. It collects property names into a
string path, then delegates the runtime behavior to your own `__call` definition.

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

## Basic Translation Usage

Start with your source locale as a literal object, then map that shape into callable translation
paths. TPath keeps the nested keys typed, while your `__call` definition decides how those keys map
to dictionaries, formatting, debug output, or missing-key behavior.

```ts
import { tpath } from './tpath';

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
  TranslationPath<Translations>,
  {
    readonly messages: Readonly<Record<string, string | undefined>>;
  }
>().define({
  __call(ctx, keys, interpolation) {
    const message = ctx.messages[keys.join('.')];

    if (message === undefined) {
      return undefined;
    }

    return formatMessage(message, interpolation);
  },
});

const t = createT({ messages });

t.common.home.title(); // "Home"
t.common.home.greeting({ name: 'Ada' }); // "Hello, Ada!"
t.common.home.greeting(); // TypeScript error
```

The local `TranslationPath` adapter is not part of TPath itself. It is just the type-level bridge
between your message literals and callable leaves. The simple examples keep a compact adapter in
`examples/*-simple/src/translations/types.ts`; the complex React example keeps a fuller parser in
`examples/react-complex/src/shared/TranslationPath.ts`.

## Caller-Owned Lookup

The `__call` definition receives a `ctx` first argument with the context fields passed to the
factory, then an explicit `keys` array for the collected path. TPath does not decide which part of
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
  TranslationPath<Translations>,
  { readonly dictionaries: typeof dictionaries }
>().define({
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
load by locale, merge several dictionaries, return `undefined`, throw on missing keys, or provide a
fallback string.

## Fallback And Debug Policy

TPath returns the `__call` result as-is. If `__call` returns `undefined`, the translated call returns
`undefined`; if `__call` throws, the error propagates. If you want joined-key fallback or debug-key
rendering, make that part of your definition.

```ts
const createT = tpath<
  TranslationPath<Translations>,
  {
    readonly debug: boolean;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }
>().define({
  __call(ctx, keys) {
    if (ctx.debug) {
      return keys.join('.');
    }

    return ctx.messages[keys.join('.')];
  },
});

const t = createT({ debug: true, messages });

t.common.home.title(); // "common.home.title"
```

## Translation Helpers

Definitions can include ordinary `$...` functions. TPath exposes them on every path node and passes
the current path plus the factory context as the first `ctx` argument.

```ts
const loadingKeys = new Set(['common.home.title']);

const createT = tpath<
  TranslationPath<Translations>,
  {
    readonly loadingKeys: ReadonlySet<string>;
    readonly messages: Readonly<Record<string, string | undefined>>;
  }
>().define({
  $key(ctx, key?: string) {
    return (key === undefined ? ctx.keys : [...ctx.keys, key]).join('.');
  },
  $exists(ctx, key?: string) {
    return ctx.messages[ctx.$key(key)] !== undefined;
  },
  $loading(ctx, key?: string) {
    return ctx.loadingKeys.has(ctx.$key(key));
  },
  __call(ctx, keys) {
    return ctx.messages[keys.join('.')];
  },
});

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
>().define({
  [exists](ctx, key?: string) {
    const keys = key === undefined ? ctx.keys : [...ctx.keys, key];

    return ctx.messages[keys.join('.')] !== undefined;
  },
  __call(ctx, keys) {
    return ctx.messages[keys.join('.')];
  },
});

const t = createT({ messages });

t.common.home.$exists(); // looks up "common.home.$exists"
t.common.home[exists]('$exists'); // true
```

If you need a dynamic-key escape hatch, provide it as another `$...` method. Use the bound
`ctx.__call<TReturn>(keys, ...args)` helper to call `__call` for an explicit path without mutating
the current path.

```ts
const createT = tpath<
  TranslationPath<Translations>,
  { readonly messages: Readonly<Record<string, string | undefined>> }
>().define({
  $(ctx, key: string, interpolation?: object) {
    return ctx.__call<string | undefined>([...ctx.keys, key], interpolation);
  },
  __call(ctx, keys, interpolation) {
    const message = ctx.messages[keys.join('.')];
    const values = interpolation as { readonly name: string } | undefined;

    return values === undefined ? message : message?.replace('{name}', values.name);
  },
});

const t = createT({ messages });

t.common.home.$('greeting', { name: 'Ada' }); // "Hello, Ada!"
```

TPath does not include built-in `$`, `$key`, `$exists`, or `$loading` methods. If a `$...` method is
not provided, it is not part of the typed proxy.

## Examples

The `examples/react-simple` app shows the definer API in a small React app with typed translation
paths, context-bound messages, interpolation, debug-key rendering, and an opt-in `$...` method.

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

## By The Way: Not Only Translations

TPath is translation-shaped because that is the main use case here, but the core does not know what
a translation is. It only turns property access into typed calls and passes the collected keys to
your definition.

For example, the same helper can describe a typed API path surface:

```ts
import { tpath } from './tpath';

interface User {
  readonly id: string;
  readonly name: string;
}

interface ApiPaths {
  readonly users: {
    readonly byId: (id: string) => Promise<User>;
    readonly search: (query: string, limit?: number) => Promise<readonly User[]>;
  };
}

const p = tpath<
  ApiPaths,
  { readonly request: (keys: readonly string[], args: readonly unknown[]) => unknown }
>().define({
  __call(ctx, keys, ...args) {
    return ctx.request(keys, args);
  },
})({ request });

p.users.byId('42'); // Promise<User>
p.users.search('ada', 10); // Promise<readonly User[]>
```

The same rule still applies: TPath gives you typed paths, and your `__call` definition owns the
runtime boundary.

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

The package is marked `"private": true` because TPath is intended to be copied, not published.

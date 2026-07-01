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

Describe your translation tree as a TypeScript type, then pass `tpath(...)` a resolver function.
TPath only collects the path keys. Your resolver decides how those keys map to dictionaries,
namespaces, locales, remote data, or anything else.

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

const t = tpath(
  (keys: tpath.Keys<Translations>) => messages[keys.join('.') as keyof typeof messages],
);

t.common.home.title(); // "Home"
t.common.home.greeting({ name: 'Ada' }); // "Hello, Ada!"
```

Missing translations fall back to the joined key:

```ts
t.common.home.missing(); // TypeScript error
t.common.home.title(); // "common.home.title" if the resolver returns undefined
```

## Caller-Owned Resolution

The resolver function receives the collected key path as an array. It does not receive a dictionary, and
TPath does not decide which part of the path is a namespace.

```ts
const dictionaries = {
  common: {
    'home.title': 'Home',
  },
};

const t = tpath((keys: tpath.Keys<Translations>) => {
  const [namespace, ...messagePath] = keys;

  if (namespace === undefined) {
    return undefined;
  }

  return dictionaries[namespace]?.[messagePath.join('.')];
});

t.common.home.title(); // lookup receives ["common", "home", "title"]
```

That keeps storage policy outside the helper. You can join with dots, split on the first namespace,
load by locale, merge several dictionaries, or use a completely different key strategy.

## Extension Patterns

Extensions are ordinary `$...` functions passed as the second argument. TPath calls them with a
context first, then forwards the user arguments from the proxy call.

```ts
const loadingKeys = new Set(['common.home.title']);

const t = tpath(
  (keys: tpath.Keys<Translations>) => messages[keys.join('.') as keyof typeof messages],
  {
    $exists({ keys, resolve }, child?: string) {
      return resolve(child === undefined ? keys : [...keys, child]) !== undefined;
    },
    $loading({ keys }, child?: string) {
      return loadingKeys.has((child === undefined ? keys : [...keys, child]).join('.'));
    },
  },
);

t.common.home.title.$exists(); // true
t.common.home.$exists('title'); // true
t.common.home.title.$loading(); // true
```

If you want a dynamic-key escape hatch, provide it as another extension:

```ts
const t = tpath(
  (keys: tpath.Keys<Translations>) => messages[keys.join('.') as keyof typeof messages],
  {
    $({ keys, translate }, child: string, interpolation?: object) {
      return translate([...keys, child], interpolation);
    },
  },
);

t.common.$('home.greeting', { name: 'Ada' }); // "Hello, Ada!"
```

TPath does not include built-in `$` or `$exists` methods. If an extension is not provided, it is not
part of the typed proxy.

The resolver and extensions receive the options object passed as the third argument:

```ts
const t = tpath(
  (keys: tpath.Keys<Translations>, options) => {
    if (options.debug()) return keys.join('.');

    return messages[keys.join('.') as keyof typeof messages];
  },
  {
    $locale: ({ options }) => options.locale,
    $debug: ({ options }) => options.debug?.() ?? false,
  },
  {
    debug: () => false,
    locale: 'en',
  },
);

t.common.home.title.$locale(); // "en"
```

## Debug Pattern

TPath does not have built-in debug behavior. If you want every call to return the joined key, make
that part of your resolver policy:

```ts
const t = tpath(
  (keys: tpath.Keys<Translations>, options) => {
    if (options.debug()) return keys.join('.');

    return messages[keys.join('.') as keyof typeof messages];
  },
  {},
  {
    debug: () => true,
  },
);

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

The package is marked `"private": true` because TPath is intended to be copied, not published.

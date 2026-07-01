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

Describe your translation tree as a TypeScript type, then pass `tpath(...)` a lookup function. TPath
only collects the path keys. Your lookup function decides how those keys map to dictionaries,
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

const t = tpath<Translations>((keys) => messages[keys.join('.') as keyof typeof messages]);

t.common.home.title(); // "Home"
t.common.home.greeting({ name: 'Ada' }); // "Hello, Ada!"
```

Missing translations fall back to the joined key:

```ts
t.common.home.missing(); // TypeScript error
t.$('common.home.missing'); // "common.home.missing"
```

## Caller-Owned Lookup

The lookup function receives the collected key path as an array. It does not receive a dictionary, and
TPath does not decide which part of the path is a namespace.

```ts
const dictionaries = {
  common: {
    'home.title': 'Home',
  },
};

const t = tpath<Translations>((keys) => {
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

## Dynamic Keys

Use `.$(...)` when a key is only known at runtime.

```ts
const key = 'common.home.title';

t.$(key); // "Home"
t.common.$('home.title'); // "Home"
```

Use `$exists(...)` when fallback text would hide whether a translation is present.

```ts
t.common.home.title.$exists(); // true
t.$exists('common.home.title'); // true
```

Empty strings count as existing translations.

## Debug Mode

Pass `debug` when you want every call to return the joined key without reading translations.

```ts
const t = tpath<Translations>(
  () => {
    throw new Error('not called');
  },
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

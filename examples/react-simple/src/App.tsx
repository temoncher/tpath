import { useState } from "react";
import type { FormEvent } from "react";

import { tpath } from "../../../tpath.ts";
import { en } from "./translations/en";
import { ru } from "./translations/ru";
import type { Messages } from "./translations/types";

type Translations = typeof en;

interface TranslationContext {
  readonly debug: boolean;
  readonly messages: Messages<Translations>;
}

export const createT = tpath<Translations>()
  .ctx<TranslationContext>()
  .extend({
    $exists({ keys, resolve }, child?: string) {
      const nextKeys = child === undefined ? keys : [...keys, child];

      return resolve(nextKeys) !== undefined;
    },
  })
  .resolve((keys, ctx) => {
    if (ctx.debug) {
      return keys.join(".");
    }

    return resolveNested(ctx.messages, keys);
  });

const translations = {
  en,
  ru,
} as const;

type Locale = keyof typeof translations;

interface AppProps {
  readonly initialLocale?: Locale;
}

export function App({ initialLocale = "en" }: AppProps = {}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [notes, setNotes] = useState<readonly string[]>([]);
  const [text, setText] = useState("");
  const t = createT({
    debug: false,
    messages: translations[locale],
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextText = text.trim();

    if (nextText.length === 0) {
      return;
    }

    setNotes((currentNotes) => [...currentNotes, nextText]);
    setText("");
  }

  return (
    <main className="simple-app">
      <header>
        <h1>{t.app.title()}</h1>
        <label>
          {t.app.localeSelect.label()}
          <select
            value={locale}
            onChange={(event) => {
              setLocale(event.currentTarget.value as Locale);
            }}
          >
            <option value="en">{t.app.localeSelect.en()}</option>
            <option value="ru">{t.app.localeSelect.ru()}</option>
          </select>
        </label>
      </header>

      <form onSubmit={submit}>
        <label htmlFor="note">{t.app.form.label()}</label>
        <input
          id="note"
          placeholder={t.app.form.placeholder.$exists() ? t.app.form.placeholder() : undefined}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <button type="submit">{t.app.form.submit()}</button>
      </form>

      <section aria-live="polite">
        {notes.length === 0 ? (
          <p>{t.app.notes.empty()}</p>
        ) : (
          <>
            <p>{t.app.notes.count({ count: notes.length })}</p>
            <ul>
              {notes.map((note, index) => (
                <li key={`${note}:${index}`}>
                  {t.app.notes.item({ index: index + 1, text: note })}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

function resolveNested(messages: Messages<Translations>, keys: readonly string[]) {
  let value: unknown = messages;

  for (const key of keys) {
    if (!isRecord(value)) {
      return undefined;
    }

    value = value[key];
  }

  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

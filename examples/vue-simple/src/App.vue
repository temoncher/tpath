<script lang="ts">
import { tpath } from "../../../tpath.ts";
import { en } from "./translations/en";
import { formatMessage } from "./translations/formatMessage";
import { ru } from "./translations/ru";
import type { Messages, TranslationPath } from "./translations/types";

type Translations = typeof en;
type Accessor<T> = () => T;

interface TranslationContext {
  readonly debug: Accessor<boolean>;
  readonly messages: Accessor<Messages<Translations>>;
}

export const createT = tpath<TranslationPath<Translations>, TranslationContext>().define(
  (ctx, keys, interpolation) => {
    if (ctx.debug()) {
      return keys.join(".");
    }

    const message = resolveNested(ctx.messages(), keys);

    if (message === undefined) {
      return undefined;
    }

    return formatMessage(message, interpolation);
  },
);

const translations = {
  en,
  ru,
} as const;

type Locale = keyof typeof translations;

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
</script>

<script setup lang="ts">
import { ref } from "vue";

defineOptions({
  name: "App",
});

const props = withDefaults(
  defineProps<{
    readonly initialLocale?: Locale;
  }>(),
  {
    initialLocale: "en",
  },
);

const locale = ref<Locale>(props.initialLocale);
const debug = ref(false);
const notes = ref<readonly string[]>([]);
const text = ref("");
const t = createT({
  debug: () => debug.value,
  messages: () => translations[locale.value],
});

function toggleDebug() {
  debug.value = !debug.value;
}

function submit() {
  const nextText = text.value.trim();

  if (nextText.length === 0) {
    return;
  }

  notes.value = [...notes.value, nextText];
  text.value = "";
}
</script>

<template>
  <main class="simple-app">
    <header>
      <h1>{{ t.app.title() }}</h1>
      <div class="header-controls">
        <label>
          {{ t.app.localeSelect.label() }}
          <select v-model="locale">
            <option value="en">{{ t.app.localeSelect.en() }}</option>
            <option value="ru">{{ t.app.localeSelect.ru() }}</option>
          </select>
        </label>
        <button type="button" @click="toggleDebug">
          {{ debug ? t.app.debugToggle.hide() : t.app.debugToggle.show() }}
        </button>
      </div>
    </header>

    <form @submit.prevent="submit">
      <label for="note">{{ t.app.form.label() }}</label>
      <input id="note" v-model="text" :placeholder="t.app.form.placeholder()" />
      <button type="submit">{{ t.app.form.submit() }}</button>
    </form>

    <section aria-live="polite">
      <p v-if="notes.length === 0">{{ t.app.notes.empty() }}</p>
      <template v-else>
        <p>{{ t.app.notes.count({ count: notes.length }) }}</p>
        <ul>
          <li v-for="(note, index) in notes" :key="`${note}:${index}`">
            {{ t.app.notes.item({ index: index + 1, text: note }) }}
          </li>
        </ul>
      </template>
    </section>
  </main>
</template>

import type { PartialMessages, Translations } from "../shared/createT";

export function flattenMessages(
  messages: PartialMessages<Translations>,
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};

  function visit(value: unknown, keys: readonly string[]) {
    if (typeof value === "string") {
      result[keys.join(".")] = value;
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, [...keys, key]);
    }
  }

  visit(messages, []);

  return result;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

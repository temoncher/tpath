type FormatValues = Readonly<Record<string, string | number | undefined>>;

const pluralPattern = /\{([A-Za-z0-9_]+),\s*plural,\s*one \{([^{}]*)\}\s*other \{([^{}]*)\}\}/g;
const placeholderPattern = /\{([A-Za-z0-9_]+)(?:,\s*[A-Za-z0-9_]+)?\}/g;

export function formatMessage(message: string, values: FormatValues = {}) {
  return formatPlaceholders(formatPlurals(message, values), values);
}

function formatPlurals(message: string, values: FormatValues) {
  return message.replace(pluralPattern, (match, key: string, one: string, other: string) => {
    const rawCount = values[key];
    const count = typeof rawCount === "number" ? rawCount : Number(rawCount);

    if (Number.isNaN(count)) {
      return match;
    }

    return (count === 1 ? one : other).split("#").join(String(count));
  });
}

function formatPlaceholders(message: string, values: FormatValues) {
  return message.replace(placeholderPattern, (match, key: string) => {
    const value = values[key];

    return value === undefined ? match : String(value);
  });
}

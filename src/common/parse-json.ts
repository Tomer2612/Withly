// Multipart forms send list fields as JSON strings. Parse them defensively:
// anything that isn't exactly the expected shape comes back as undefined
// ("field not sent") instead of passing arbitrary client data on to the
// database. Callers decide what a missing field means.

export function parseStringArray(
  json: string | undefined | null,
): string[] | undefined {
  if (!json) return undefined;
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) &&
      value.every((v): v is string => typeof v === 'string')
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseIdTextArray(
  json: string | undefined | null,
): { id: string; text: string }[] | undefined {
  if (!json) return undefined;
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return undefined;
    const ok = value.every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as { id?: unknown }).id === 'string' &&
        typeof (v as { text?: unknown }).text === 'string',
    );
    return ok ? (value as { id: string; text: string }[]) : undefined;
  } catch {
    return undefined;
  }
}

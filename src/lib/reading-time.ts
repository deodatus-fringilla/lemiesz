/** Minutes to read a text at an unhurried 200 words a minute; never less than one. */
export const readingMinutes = (text: string): number => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));

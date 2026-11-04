/** Link-check verdict, shared by the server checker and the pages: 2xx/3xx works; anything else, 0 or -1 is broken. */
export const isBroken = (status: number | null) => status !== null && (status < 200 || status >= 400);

/** Route geometry and API distances use metres; navigation labels use feet. */
export const metresToFeet = (metres: number) => Math.round(metres / 0.3048);

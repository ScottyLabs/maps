import { configure, getAnsiColorFormatter, getConsoleSink, getLogger } from "@logtape/logtape";

export const logger = getLogger("cmumaps-server");

export async function configureLogger() {
  await configure({
    sinks: {
      console: getConsoleSink({
        formatter: getAnsiColorFormatter({
          level: "FULL",
          timeZone: "America/New_York",
          timestamp: "date-time-timezone",
        }),
      }),
    },
    loggers: [
      { category: ["cmumaps-server"], lowestLevel: "info", sinks: ["console"] },
      { category: ["system"], lowestLevel: "info", sinks: ["console"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  });
}

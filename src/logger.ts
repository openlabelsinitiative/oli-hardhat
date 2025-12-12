import pino from "pino";
import { ResolvedConfig } from "./types.js";

export const buildLogger = (config: ResolvedConfig) => {
  const create = (pino as any);
  if (config.loggerLevel === "silent") {
    return create({ level: "silent" });
  }
  return create({
    level: config.loggerLevel ?? "info",
    base: undefined,
    timestamp: false
  });
};

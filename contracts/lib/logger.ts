import { createBaseLogger } from "@/common/lib/logger";
import { env } from "../env";

export const logger = createBaseLogger({
  env: env.NODE_ENV,
  version: process.env.npm_package_version || "1.0.0",
  logLevel: env.NODE_ENV === "development" ? "debug" : "info",
  serviceName: "onecurrency-contracts",
  betterStackToken: env.BETTERSTACK_SOURCE_TOKEN,
});

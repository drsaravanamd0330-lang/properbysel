import type { PrismaClient } from "@prisma/client";
import type { Config } from "./config";
import type { TokenService } from "./lib/auth";
import type { OtpSender } from "./lib/otp";
import type { Storage } from "./lib/storage";

export interface AppContext {
  cfg: Config;
  db: PrismaClient;
  tokens: TokenService;
  otp: OtpSender;
  storage: Storage;
}

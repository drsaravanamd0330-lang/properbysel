import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().default(30),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_PROVIDER: z.enum(["dev", "msg91", "twilio"]).default("dev"),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("ap-south-1"),
  S3_BUCKET_PRIVATE: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["sandbox", "razorpay"]).default("sandbox"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  BUSINESS_LEGAL_NAME: z.string().default("AAROVIN SOFTWARE SOLUTIONS"),
  BUSINESS_GSTIN: z.string().optional(),
  BUSINESS_ADDRESS: z.string().optional(),
});
export type Config = z.infer<typeof envSchema>;

export class UnsafeConfigError extends Error {}

/** Loads config and refuses unsafe combinations. Development substitutes can never run in production. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = envSchema.parse(env);
  if (c.APP_ENV === "production") {
    if (c.OTP_PROVIDER === "dev") throw new UnsafeConfigError("OTP_PROVIDER=dev is not allowed when APP_ENV=production");
    if (c.JWT_SECRET.length < 32 || /dev|change-me/i.test(c.JWT_SECRET)) throw new UnsafeConfigError("JWT_SECRET is too weak for production");
    if (c.PAYMENT_PROVIDER === "sandbox") throw new UnsafeConfigError("PAYMENT_PROVIDER=sandbox is not allowed when APP_ENV=production");
    if (c.STORAGE_PROVIDER === "local") throw new UnsafeConfigError("STORAGE_PROVIDER=local is not allowed when APP_ENV=production");
  }
  return c;
}

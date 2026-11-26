import type { Config } from "../config";

export interface OtpSender { name: string; send(phone: string, code: string): Promise<void> }

/** Development-only sender. loadConfig() refuses to start production with it. */
export class DevOtpSender implements OtpSender {
  name = "dev";
  outbox = new Map<string, string>();
  constructor(private log: (msg: string) => void) {}
  async send(phone: string, code: string) {
    this.outbox.set(phone, code);
    this.log(`[DEV OTP] ${phone.slice(0, 5)}***** code ${code} (development only)`);
  }
}

class NotConfiguredSender implements OtpSender {
  constructor(public name: string) {}
  async send(): Promise<void> {
    throw new Error(`OTP provider "${this.name}" is not configured yet. Add credentials and implement the adapter in src/lib/otp.ts.`);
  }
}

export function createOtpSender(cfg: Config, log: (m: string) => void): OtpSender {
  if (cfg.OTP_PROVIDER === "dev") return new DevOtpSender(log);
  // Real adapters (MSG91 / Twilio Verify) need provider accounts and DLT-registered templates in India.
  return new NotConfiguredSender(cfg.OTP_PROVIDER);
}

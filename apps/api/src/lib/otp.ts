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

/**
 * MSG91 Flow API (India). The template must be DLT-registered and contain a variable named "otp".
 * Not yet exercised against a live MSG91 account.
 */
export class Msg91Sender implements OtpSender {
  name = "msg91";
  constructor(private authKey: string, private templateId: string, private fetchImpl: typeof fetch = fetch) {}
  async send(phone: string, code: string) {
    const r = await this.fetchImpl("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { "content-type": "application/json", authkey: this.authKey, accept: "application/json" },
      body: JSON.stringify({ template_id: this.templateId, short_url: "0", recipients: [{ mobiles: phone.replace(/^\+/, ""), otp: code }] }),
    });
    if (!r.ok) throw new Error(`MSG91 send failed (${r.status})`);
  }
}

export function createOtpSender(cfg: Config, log: (m: string) => void): OtpSender {
  if (cfg.OTP_PROVIDER === "dev") return new DevOtpSender(log);
  if (cfg.OTP_PROVIDER === "msg91") {
    if (!cfg.MSG91_AUTH_KEY || !cfg.MSG91_OTP_TEMPLATE_ID) throw new Error("MSG91 needs MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID");
    return new Msg91Sender(cfg.MSG91_AUTH_KEY, cfg.MSG91_OTP_TEMPLATE_ID);
  }
  // Real adapters (MSG91 / Twilio Verify) need provider accounts and DLT-registered templates in India.
  return new NotConfiguredSender(cfg.OTP_PROVIDER);
}

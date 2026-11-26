import { describe, it, expect } from "vitest";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3Storage } from "../src/lib/storage";

/** Exercises the adapter against an in-memory fake. Not a substitute for a check against a real bucket. */
describe("S3Storage", () => {
  it("puts encrypted, gets and removes objects", async () => {
    const mem = new Map<string, Buffer>();
    const seen: unknown[] = [];
    const fake = { async send(cmd: unknown) {
      seen.push(cmd);
      if (cmd instanceof PutObjectCommand) { mem.set(cmd.input.Key!, cmd.input.Body as Buffer); return {}; }
      if (cmd instanceof GetObjectCommand) { const b = mem.get(cmd.input.Key!); return { Body: b && { transformToByteArray: async () => new Uint8Array(b) } }; }
      if (cmd instanceof DeleteObjectCommand) { mem.delete(cmd.input.Key!); return {}; }
      throw new Error("unexpected");
    } };
    const s = new S3Storage(fake, "pbs-private");
    await s.put("media/a.webp", Buffer.from("hello"));
    expect((seen[0] as PutObjectCommand).input).toMatchObject({ Bucket: "pbs-private", ServerSideEncryption: "AES256" });
    expect((await s.get("media/a.webp")).toString()).toBe("hello");
    await s.remove("media/a.webp");
    await expect(s.get("media/a.webp")).rejects.toThrow();
  });
});

import { Msg91Sender } from "../src/lib/otp";
describe("Msg91Sender", () => {
  it("posts the code to the flow API without the leading plus", async () => {
    let body: Record<string, unknown> = {}, headers: Record<string, string> = {};
    const fake = (async (_url: string, init: RequestInit) => { body = JSON.parse(String(init.body)); headers = init.headers as Record<string, string>; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await new Msg91Sender("key123", "tmpl1", fake).send("+919876543210", "123456");
    expect(headers.authkey).toBe("key123");
    expect(body).toMatchObject({ template_id: "tmpl1", recipients: [{ mobiles: "919876543210", otp: "123456" }] });
  });
});

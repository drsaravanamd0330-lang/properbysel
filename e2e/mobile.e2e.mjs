// Checks the mobile app (exported web build, phone viewport) against the same API and data as the website (#14).
// Usage: serve `expo export --platform web` output on :8081, API on :4000 (WEB_ORIGIN must include :8081), website on :3000.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const APP = process.env.APP_URL ?? "http://localhost:8081", WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API_LOG = process.env.API_LOG ?? "/tmp/claude-0/api.log", SHOTS = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(SHOTS, { recursive: true });
const step = (m) => console.log(`✓ ${m}`);
const BUYER = `96${String(Date.now()).slice(-8)}`;
const logLen = () => readFileSync(API_LOG, "utf8").split("\n").length;
const otpSince = (n) => readFileSync(API_LOG, "utf8").split("\n").slice(n - 1).map((l) => /code (\d{6})/.exec(l)?.[1]).filter(Boolean).at(-1);

const browser = await chromium.launch();
const phone = await (await browser.newContext({ ...devices["Pixel 7"] })).newPage();
const web = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await phone.goto(APP);
  await phone.getByText("properties").first().waitFor();
  await phone.getByText("Bright 2 BHK apartment near Adyar bus depot").first().waitFor();
  await phone.screenshot({ path: `${SHOTS}/m1-search.png` });
  step("mobile search shows the same listings as the website");

  await phone.getByText("Bright 2 BHK apartment near Adyar bus depot").first().click();
  await phone.getByText("About").waitFor();
  await phone.screenshot({ path: `${SHOTS}/m2-property.png`, fullPage: true });
  step("mobile property page opens");

  await phone.getByText("☆ Save").click();
  console.log("  .. tapped save");
  await phone.getByPlaceholder("98765 43210").waitFor();
  await phone.getByPlaceholder("98765 43210").fill(BUYER);
  await phone.locator("[aria-label^=\"I agree\"]").first().click({ force: true });
  console.log("  .. filled phone");
  const mark = logLen();
  await phone.getByText("Send code").click();
  console.log("  .. sent code");
  await phone.locator("input[autocomplete=\"sms-otp\"], input[autocomplete=\"one-time-code\"]").last().waitFor();
  await phone.waitForTimeout(300);
  await phone.locator("input[autocomplete=\"sms-otp\"], input[autocomplete=\"one-time-code\"]").last().fill(otpSince(mark));
  await phone.getByText("Verify and continue").click();
  await phone.getByText("☆ Save").waitFor();
  await phone.getByText("☆ Save").click();
  await phone.getByText("★ Saved").waitFor();
  step("buyer logged in on mobile and saved the property");

  // Same account on the website sees the favourite saved from mobile
  await web.goto(`${WEB}/login`);
  await web.fill("#phone", BUYER);
  await web.waitForLoadState("networkidle");
  await web.check("label:has-text('I agree to the') input");
  const m2 = logLen();
  await web.click("button:has-text('Send code')");
  await web.waitForSelector("#code"); await web.waitForTimeout(300);
  await web.fill("#code", otpSince(m2));
  await web.click("button:has-text('Verify and continue')");
  await web.waitForURL(/dashboard/);
  await web.goto(`${WEB}/dashboard/favourites`);
  await web.waitForSelector("text=Bright 2 BHK apartment near Adyar bus depot");
  step("website shows the favourite saved on mobile (#14 same persisted data)");

  await phone.goto(`${APP}/post`);
  await phone.getByText("Post a new property").waitFor();
  await phone.screenshot({ path: `${SHOTS}/m3-post.png` });
  step("mobile post tab loads for a signed-in user");
  console.log("\nMOBILE E2E PASSED");
} catch (e) {
  console.error("MOBILE E2E FAILED:", e.message.split("\n")[0]);
  await phone.screenshot({ path: `${SHOTS}/m-fail.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally { await browser.close(); }

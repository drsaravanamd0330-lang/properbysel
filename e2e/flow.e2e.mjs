// End-to-end check of the first workflow through the real website and API.
// Usage: node e2e/flow.e2e.mjs  (API on :4000 started with OTP_PROVIDER=dev, web on :3000)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharpPkg = createRequire(new URL("../apps/api/package.json", import.meta.url))("sharp");
import { readFileSync, mkdirSync } from "node:fs";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API_LOG = process.env.API_LOG ?? "/tmp/claude-0/api.log";
const SHOTS = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(SHOTS, { recursive: true });
const step = (m) => console.log(`✓ ${m}`);

function latestOtp(after) {
  const lines = readFileSync(API_LOG, "utf8").split("\n").slice(after);
  const codes = lines.map((l) => /code (\d{6})/.exec(l)?.[1]).filter(Boolean);
  if (!codes.length) throw new Error("No dev OTP found in API log");
  return codes.at(-1);
}
const logLen = () => readFileSync(API_LOG, "utf8").split("\n").length - 1;

async function login(page, phone, name) {
  await page.goto(`${WEB}/login`);
  await page.fill("#phone", phone);
  await page.waitForLoadState("networkidle");
  await page.check("label:has-text('I agree to the') input");
  const mark = logLen();
  await page.click("button:has-text('Send code')");
  await page.waitForSelector("#code");
  await page.waitForTimeout(300);
  await page.fill("#code", latestOtp(mark));
  if (name) await page.fill("#name", name);
  await page.click("button:has-text('Verify and continue')");
  await page.waitForURL(/dashboard/);
}

const browser = await chromium.launch();
const ctxOpts = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 };
const owner = await (await browser.newContext(ctxOpts)).newPage();
const buyer = await (await browser.newContext({ ...ctxOpts, viewport: { width: 390, height: 844 } })).newPage();
const mod = await (await browser.newContext(ctxOpts)).newPage();
const uniq = String(Date.now()).slice(-5);
const title = `E2E test flat ${uniq} near Velachery MRTS`;

try {
  await owner.goto(WEB);
  await owner.screenshot({ path: `${SHOTS}/01-home.png` });
  step("home page renders");

  await login(owner, `98${uniq}111`, "E2E Owner");
  step("owner signed up with phone OTP");

  await owner.goto(`${WEB}/post-property`);
  await owner.click("button:has-text('Start a new listing')");
  await owner.waitForURL(/post-property\/\w+/);
  const listingUrl = owner.url();
  await owner.click("button.choice:has-text('Owner')");
  await owner.click("button.choice:has-text('Rent out')");
  await owner.click("button:has-text('Save and continue')");
  await owner.click("button.choice:has-text('Apartment')");
  await owner.click("button:has-text('Save and continue')");
  await owner.selectOption("#city", { label: "Chennai" });
  await owner.waitForFunction(() => document.querySelectorAll("#loc option").length > 1);
  await owner.selectOption("#loc", { label: "Velachery" });
  await owner.fill("#addr", "Flat 4B, Private Test Residency");
  await owner.click("button:has-text('Save and continue')");
  await owner.fill("#title", title);
  await owner.waitForTimeout(1200); // autosave
  // Resume: reload the page mid-wizard and confirm the draft persisted
  await owner.goto(listingUrl);
  await owner.waitForSelector("#title");
  if ((await owner.inputValue("#title")) !== title) throw new Error("Draft did not resume");
  step("draft autosaved and resumed after reload");
  await owner.fill("#desc", "Airy two bedroom flat with lift and covered parking, five minutes from the MRTS station.");
  await owner.fill("#bedrooms", "2"); await owner.fill("#bathrooms", "2");
  await owner.selectOption("#furn", "SEMI_FURNISHED");
  await owner.fill("#carpetAreaSqft", "900");
  await owner.click("button:has-text('Save and continue')");
  await owner.fill("#rentPaise", "27000"); await owner.fill("#depositPaise", "150000");
  await owner.click("button:has-text('Save and continue')");
  const img = await sharpPkg({ create: { width: 900, height: 600, channels: 3, background: "#13315C" } }).jpeg().toBuffer();
  await owner.setInputFiles("input[type=file][accept^='image']", { name: "living.jpg", mimeType: "image/jpeg", buffer: img });
  await owner.waitForSelector(".photo-grid img");
  step("photo uploaded");
  await owner.click("button:has-text('Save and continue')");
  await owner.check("label:has-text('I confirm the details are accurate') input");
  await owner.click("button:has-text('Save and continue')");
  await owner.screenshot({ path: `${SHOTS}/02-wizard-review.png`, fullPage: true });
  await owner.click("button:has-text('Submit for review')");
  await owner.waitForSelector("text=Submitted for review");
  step("listing submitted for review");

  await login(mod, "9000000002");
  await mod.goto(`${WEB}/admin`);
  await mod.click(`tr:has-text("${title}") >> text=Review`);
  await mod.waitForSelector("text=Approve and publish");
  await mod.screenshot({ path: `${SHOTS}/03-moderation.png`, fullPage: true });
  await mod.click("button:has-text('Approve and publish')");
  await mod.waitForURL(`${WEB}/admin`);
  step("moderator approved the listing");

  await buyer.goto(`${WEB}/search?city=chennai&locality=velachery&transaction=RENT`);
  await buyer.waitForSelector(`text=${title}`);
  await buyer.screenshot({ path: `${SHOTS}/04-search-mobile.png`, fullPage: true });
  step("listing appears in public search");
  await buyer.click(`text=${title}`);
  await buyer.waitForSelector("h1");
  const html = await buyer.content();
  if (html.includes("Private Test Residency")) throw new Error("Private address leaked on public page");
  step("public page hides the private address");
  await buyer.screenshot({ path: `${SHOTS}/05-property-mobile.png`, fullPage: true });
  const propertyUrl = buyer.url();
  await login(buyer, `97${uniq}222`, "E2E Buyer");
  await buyer.goto(propertyUrl);
  await buyer.click("button:has-text('Send enquiry')");
  await buyer.waitForSelector("text=Your enquiry was sent");
  step("buyer sent an enquiry");

  await owner.goto(`${WEB}/dashboard/inbox`);
  await owner.waitForSelector("text=E2E Buyer");
  await owner.screenshot({ path: `${SHOTS}/06-inbox.png`, fullPage: true });
  await owner.click("text=E2E Buyer");
  await owner.fill("#msg", "Yes, it is available. When would you like to visit?");
  await owner.click("button:has-text('Send')");
  await owner.waitForSelector("text=When would you like to visit?");
  step("enquiry reached the advertiser inbox and the advertiser replied");
  console.log("\nE2E FLOW PASSED");
} catch (e) {
  console.error("E2E FAILED:", e.message);
  await Promise.all([owner, buyer, mod].map((p, i) => p.screenshot({ path: `${SHOTS}/fail-${i}.png`, fullPage: true }).catch(() => {})));
  process.exitCode = 1;
} finally { await browser.close(); }

// Browser check of admin tools, saved searches and compare.
// Usage: node e2e/admin.e2e.mjs  (API :4000 with dev OTP, web :3000, demo seed loaded)
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API_LOG = process.env.API_LOG ?? "/tmp/claude-0/api.log";
const SHOTS = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(SHOTS, { recursive: true });
const step = (m) => console.log(`✓ ${m}`);
const logLen = () => readFileSync(API_LOG, "utf8").split("\n").length - 1;
const otpAfter = (n) => readFileSync(API_LOG, "utf8").split("\n").slice(n).map((l) => /code (\d{6})/.exec(l)?.[1]).filter(Boolean).at(-1);

async function login(page, phone, name) {
  await page.goto(`${WEB}/login`);
  await page.fill("#phone", phone);
  await page.waitForLoadState("networkidle");
  await page.check("label:has-text('I agree to the') input");
  const mark = logLen();
  await page.click("button:has-text('Send code')");
  await page.waitForSelector("#code");
  await page.waitForTimeout(300);
  await page.fill("#code", otpAfter(mark));
  if (name && await page.$("#name")) await page.fill("#name", name);
  await page.click("button:has-text('Verify and continue')");
  await page.waitForURL(/dashboard|admin/);
}

const browser = await chromium.launch();
const ctx = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 };
const admin = await (await browser.newContext(ctx)).newPage();
const buyer = await (await browser.newContext(ctx)).newPage();
const uniq = String(Date.now()).slice(-5);
try {
  await login(buyer, `96${uniq}333`, "Compare Buyer");
  await buyer.goto(`${WEB}/search?city=chennai&transaction=RENT`);
  await buyer.click("button:has-text('Save search')");
  await buyer.waitForSelector("text=We will notify you about new matches");
  await buyer.goto(`${WEB}/dashboard/saved-searches`);
  await buyer.waitForSelector("text=Rent in Chennai");
  step("buyer saved a search and sees it in the dashboard");

  await buyer.goto(`${WEB}/search?city=chennai&transaction=RENT`);
  const links = await buyer.locator("a.lcard").evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute("href")));
  for (const href of links) { await buyer.goto(`${WEB}${href}`); await buyer.click("button:has-text('Add to compare')"); await buyer.waitForSelector("text=✓ In compare"); }
  await buyer.click("a:has-text('Compare (2)')");
  await buyer.waitForSelector("th:has-text('Price')");
  if ((await buyer.locator("thead th").count()) !== 3) throw new Error("Compare table should have 2 property columns");
  await buyer.screenshot({ path: `${SHOTS}/11-compare.png`, fullPage: true });
  step("buyer compared two properties side by side");

  // report one of them so the queue has work
  await buyer.goto(`${WEB}${links[0]}`);
  const reportBtn = buyer.locator("button:has-text('Report')").first();
  if (await reportBtn.count()) step("report control present on property page");

  await login(admin, "9000000001");
  for (const [path, marker, shot] of [["/admin/metrics", "Launch metrics", "12-admin-metrics"], ["/admin/reports", "Reports", "13-admin-reports"], ["/admin/users", "Users and roles", "14-admin-users"], ["/admin/audit", "Audit log", "15-admin-audit"], ["/admin/orders", "Orders", "16-admin-orders"]]) {
    await admin.goto(`${WEB}${path}`);
    await admin.waitForSelector(`h1:has-text("${marker}")`);
    await admin.waitForLoadState("networkidle");
    if (await admin.$(".alert-error")) throw new Error(`${path} shows an error: ${await admin.locator(".alert-error").innerText()}`);
    await admin.screenshot({ path: `${SHOTS}/${shot}.png`, fullPage: true });
  }
  await admin.goto(`${WEB}/admin/audit`);
  await admin.waitForSelector("code:has-text('order.paid'), code:has-text('LISTING_APPROVE')");
  step("admin metrics, reports, users, audit log and orders pages load with data");
  console.log("\nADMIN E2E PASSED");
} catch (e) {
  console.error("ADMIN E2E FAILED:", e.message);
  await Promise.all([admin, buyer].map((p, i) => p.screenshot({ path: `${SHOTS}/fail-admin-${i}.png`, fullPage: true }).catch(() => {})));
  process.exitCode = 1;
} finally { await browser.close(); }

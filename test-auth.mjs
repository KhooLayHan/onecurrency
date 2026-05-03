import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("request", (req) => {
    const cookies = req.headers()["cookie"] || "(none)";
    if (req.url().includes("onecurrency")) {
      console.log(`[REQ] ${req.method()} ${req.url().slice(0, 90)} | cookie: ${cookies.slice(0, 120)}`);
    }
  });
  page.on("response", (res) => {
    const setCookie = res.headers()["set-cookie"] || "(none)";
    if (res.url().includes("onecurrency")) {
      console.log(`[RES] ${res.status()} ${res.url().slice(0, 90)} | set-cookie: ${setCookie.slice(0, 120)}`);
    }
  });

  console.log("\n=== Going to login page ===");
  await page.goto("https://www.onecurrency.tech/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const cookiesBefore = await context.cookies();
  console.log(`\nCookies before login (${cookiesBefore.length}):`);
  for (const c of cookiesBefore) {
    console.log(`  ${c.name} domain=${c.domain}`);
  }

  console.log("\n=== Filling login form ===");
  await page.fill('input[type="email"]', "opencode_test_20260502a@test.com");
  await page.fill('input[type="password"]', "TestPass123!");

  console.log("\n=== Submitting form ===");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);

  const cookiesAfter = await context.cookies();
  console.log(`\nCookies after login (${cookiesAfter.length}):`);
  for (const c of cookiesAfter) {
    console.log(`  ${c.name} domain=${c.domain} path=${c.path} httpOnly=${c.httpOnly} secure=${c.secure} sameSite=${c.sameSite}`);
  }

  console.log(`\nCurrent URL: ${page.url()}`);

  console.log("\n=== Testing fetch from page context ===");
  const fetchResult = await page.evaluate(async () => {
    try {
      const res = await fetch("https://api.onecurrency.tech/api/v1/auth/get-session", {
        credentials: "include",
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log("Fetch result:", JSON.stringify(fetchResult, null, 2));

  await browser.close();
})();

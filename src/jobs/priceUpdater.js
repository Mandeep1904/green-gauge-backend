import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import scrapeAmazonWithPage from "../services/scraper.js";
import { fileURLToPath } from "url";

// --------------------
// PATH SETUP
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// src/data
const dataDir = path.resolve(__dirname, "../data");

// --------------------
// CONFIG
// --------------------
const files = [
  "toothpastes.json",
  "shampoos.json",
  "soaps.json",
  "hairoils.json",
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// Anti-spam guard (6 hours)
let lastRun = 0;
const MIN_INTERVAL = 1000 * 60 * 60 * 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------------
// MAIN UPDATER
// --------------------
const updatePrices = async () => {
  const now = Date.now();
  if (now - lastRun < MIN_INTERVAL) {
    console.log("|=| Skipped: updated recently |=|");
    return;
  }
  lastRun = now;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    locale: "en-IN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });

  const page = await context.newPage();

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const retryQueue = [];

    // =========================
    // FIRST PASS
    // =========================
    for (const category in data) {
      for (const product of data[category]) {
        try {
          const scraped = await scrapeAmazonWithPage(page, product.url);

          if (scraped.title) product.title = scraped.title;
          if (scraped.image) product.image = scraped.image;

          product.available = scraped.available;

          if (scraped.price !== null) {
            product.price = scraped.price;
            console.log("|=| Price updated |=| :", scraped.price, product.url);
          } else {
            product.price = null;
            console.log("|=| Price unavailable |=| :", product.url);
          }

          await sleep(3500 + Math.random() * 2000);
        } catch {
          console.warn("|=| Failed (queued) |=| :", product.url);
          retryQueue.push({ product, attempts: 1 });
        }
      }
    }

    // =========================
    // RETRY PASSES
    // =========================
    while (retryQueue.length > 0) {
      const item = retryQueue.shift();

      if (item.attempts >= MAX_RETRIES) {
        console.error("|=| Permanently failed |=| :", item.product.url);
        continue;
      }

      try {
        await sleep(RETRY_DELAY);
        const scraped = await scrapeAmazonWithPage(page, item.product.url);

        if (scraped.title) item.product.title = scraped.title;
        if (scraped.image) item.product.image = scraped.image;

        item.product.available = scraped.available;

        item.product.price = scraped.price !== null ? scraped.price : null;
      } catch {
        item.attempts++;
        retryQueue.push(item);
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`|=| ${file} fully processed |=|`);
  }

  await browser.close();
};

// =========================
// RUN ONLY IF EXECUTED DIRECTLY (LOCAL)
// =========================
const isDirectRun =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  (async () => {
    console.log("|=| Price updater started |=|");
    await updatePrices();
    console.log("|=| Price updater finished |=|");
  })();
}

export default updatePrices;

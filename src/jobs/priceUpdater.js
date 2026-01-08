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

const MAX_RETRIES = 2;
const RETRY_DELAY = 3000;
const BATCH_SIZE = 2;
const PRODUCT_TIMEOUT = 45000; // 45 seconds per product (was 60s) // Process 5 products per browser instance

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------------
// MAIN UPDATER
// --------------------
const updatePrices = async () => {
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Flatten all products with their category reference
    const allProducts = [];
    for (const category in data) {
      for (const product of data[category]) {
        allProducts.push({ product, category });
      }
    }

    console.log(`|=| Starting ${file} with ${allProducts.length} products |=|`);

    // Process in batches
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);

      console.log(`|=| Processing batch ${batchNum}/${totalBatches} for ${file} |=|`);

      // Create a new browser for each batch
      const browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
        ],
      });

      const context = await browser.newContext({
        locale: "en-IN",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      });

      const page = await context.newPage();
      const retryQueue = [];

      // =========================
      // FIRST PASS - BATCH
      // =========================
      for (const { product, category } of batch) {
        try {
          const scraped = await scrapeAmazonWithPage(page, product.url, PRODUCT_TIMEOUT);

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
        } catch (e) {
          console.warn("|=| Failed (queued) |=| :", product.url, e.message);
          retryQueue.push({ product, attempts: 1 });
        }
      }

      // =========================
      // RETRY PASSES - BATCH
      // =========================
      while (retryQueue.length > 0) {
        const item = retryQueue.shift();

        if (item.attempts >= MAX_RETRIES) {
          console.error("|=| Permanently failed |=| :", item.product.url);
          continue;
        }

        try {
          await sleep(RETRY_DELAY);
          const scraped = await scrapeAmazonWithPage(page, item.product.url, PRODUCT_TIMEOUT);

          if (scraped.title) item.product.title = scraped.title;
          if (scraped.image) item.product.image = scraped.image;

          item.product.available = scraped.available;

          item.product.price = scraped.price !== null ? scraped.price : null;
          console.log("|=| Retry succeeded |=| :", item.product.url);
        } catch (e) {
          item.attempts++;
          retryQueue.push(item);
          console.warn(
            `|=| Retry failed, attempt ${item.attempts}/${MAX_RETRIES} |=| :`,
            item.product.url
          );
        }
      }

      // Close browser after batch AND all retries are complete (releases memory)
      await browser.close();

      // Save progress after each batch
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`|=| Batch ${batchNum}/${totalBatches} complete, file saved |=|`);

      // Wait between batches to avoid rate limiting
      if (i + BATCH_SIZE < allProducts.length) {
        console.log("|=| Waiting 5 seconds before next batch |=|");
        await sleep(5000);
      }
    }

    console.log(`|=| ${file} fully processed |=|`);
  }
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
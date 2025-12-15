const scrapeAmazonWithPage = async (page, url) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // ----------------------------
  // TITLE (always try)
  // ----------------------------
  const title = await page
    .locator("span#productTitle")
    .first()
    .innerText()
    .catch(() => null);

  // ----------------------------
  // IMAGE (always try)
  // ----------------------------
  const image = await page
    .locator("#imgTagWrapperId img")
    .first()
    .getAttribute("src")
    .catch(() => null);

  // ----------------------------
  // PRICE - TRY MULTIPLE SELECTORS
  // ----------------------------
  let price = null;

  const priceSelectors = [
    // Standard price (most common)
    ".a-price .a-offscreen",
    // Deal price
    "#corePrice_desktop .a-offscreen",
    // Buy box price
    "#corePriceDisplay_desktop_feature_div .a-offscreen",
    // Price inside buy box
    "#buybox .a-price .a-offscreen",
    // Alternative price location
    ".priceToPay .a-offscreen",
    // Kindle/Digital content price
    "#kindle-price .a-offscreen",
    // Subscribe & Save price
    "#sns-base-price .a-offscreen",
  ];

  for (const selector of priceSelectors) {
    try {
      const priceNode = page.locator(selector);
      if ((await priceNode.count()) > 0) {
        const priceText = await priceNode.first().innerText();
        const parsed = parseFloat(priceText.replace(/[^\d.]/g, ""));

        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
          break; // Found valid price, stop searching
        }
      }
    } catch {
      continue; // Try next selector
    }
  }

  // ----------------------------
  // AVAILABILITY CHECK
  // ----------------------------
  let isAvailable = true;

  // Method 1: Check specific availability sections
  const availabilitySelectors = [
    "#availability span",
    "#availabilityInsideBuyBox_feature_div span",
    ".a-box-inner .a-alert-error",
  ];

  for (const selector of availabilitySelectors) {
    try {
      const availText = await page
        .locator(selector)
        .first()
        .innerText()
        .catch(() => "");

      if (availText) {
        const lowerText = availText.toLowerCase();
        const unavailableKeywords = [
          "currently unavailable",
          "temporarily out of stock",
          "out of stock",
          "unavailable",
        ];

        if (unavailableKeywords.some((k) => lowerText.includes(k))) {
          isAvailable = false;
          break;
        }
      }
    } catch {
      continue;
    }
  }

  // Method 2: Check if "Add to Cart" or "Buy Now" buttons exist
  if (isAvailable) {
    const hasAddToCart = await page
      .locator("#add-to-cart-button, #buy-now-button")
      .count()
      .catch(() => 0);

    if (hasAddToCart === 0) {
      // No buy buttons = likely unavailable
      isAvailable = false;
    }
  }

  // Method 3: If price is null but page looks available, mark as unavailable
  if (price === null && isAvailable) {
    isAvailable = false;
  }

  return {
    title: title?.trim() || null,
    image,
    price: isAvailable ? price : null,
    available: isAvailable,
  };
};

export default scrapeAmazonWithPage;

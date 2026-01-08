const scrapeAmazonWithPage = async (page, url, timeout = 45000) => {
  try {
    // Set page timeout with better error handling
    await Promise.race([
      page.goto(url, { waitUntil: "domcontentloaded", timeout }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Page load exceeded timeout")),
          timeout
        )
      ),
    ]);
  } catch (e) {
    console.warn("|=| Page load failed |=|:", url, e.message);
    return {
      title: null,
      image: null,
      price: null,
      available: false,
    };
  }

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
          break;
        }
      }
    } catch {
      continue;
    }
  }

  // ----------------------------
  // AVAILABILITY CHECK
  // ----------------------------
  let isAvailable = true;

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

  if (isAvailable) {
    const hasAddToCart = await page
      .locator("#add-to-cart-button, #buy-now-button")
      .count()
      .catch(() => 0);

    if (hasAddToCart === 0) {
      isAvailable = false;
    }
  }

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
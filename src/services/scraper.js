export const scrapeAmazonWithPage = async (page, url) => {
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
  // UNAVAILABLE TEXT CHECK
  // ----------------------------
  const pageText = (await page.locator("body").innerText()).toLowerCase();

  const unavailableKeywords = [
    "currently unavailable",
    "temporarily out of stock",
    "out of stock",
    "unavailable",
  ];

  const isUnavailable = unavailableKeywords.some(k =>
    pageText.includes(k)
  );

  // ----------------------------
  // IF UNAVAILABLE → STOP HERE
  // ----------------------------
  if (isUnavailable) {
    return {
      title: title?.trim() || null,
      image,
      price: null,
      available: false,
    };
  }

  // ----------------------------
  // PRICE (ONLY IF AVAILABLE)
  // ----------------------------
  let price = null;
  const priceNode = page.locator(".a-price .a-offscreen");

  if ((await priceNode.count()) > 0) {
    const priceText = await priceNode.first().innerText();
    price = parseFloat(priceText.replace(/[₹,]/g, ""));
  }

  return {
    title: title?.trim() || null,
    image,
    price,
    available: true,
  };
};

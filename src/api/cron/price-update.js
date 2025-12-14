import { updatePrices } from "../../jobs/priceUpdater.js";

export default async function handler(req, res) {
  
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("|=| Cron price update started |=|");
    await updatePrices();
    console.log("|=| Cron price update finished |=|");

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("|=| Cron failed |=|", err);
    res.status(500).json({ error: "Cron failed" });
  }
}

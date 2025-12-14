import express from "express";
import cors from "cors";
import env from "dotenv";

import productRoutes from "./routes/products.routes.js";
import { updatePrices } from "./jobs/priceUpdater.js";

// -----------------------------------------------

env.config();
const app = express();

// -----------------------------------------------
// Middlewares
app.use(cors());
app.use(express.json());

// -----------------------------------------------
// API routes
app.use("/api/products", productRoutes);

// Ping (Render / uptime check)
app.get("/ping", (req, res) => {
  res.send("pong");
});

// MANUAL / CRON-LIKE TRIGGER 
app.get("/api/cron/price-update", async (req, res) => {

  if (req.query.key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("|=| Manual price update triggered |=|");
    await updatePrices();
    res.json({ success: true });
  } catch (err) {
    console.error("|=| Price update failed |=|", err);
    res.status(500).json({ success: false });
  }
});

// Home route testing
app.use("/", (req, res) => {
  res.send("|=| Welcome to the backend! |=|");
});

// -----------------------------------------------
// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`|=| Backend running on port ${PORT} |=|`);
});

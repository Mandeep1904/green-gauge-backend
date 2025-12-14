import express from "express";
import cors from "cors";
import cron from "node-cron";
import env from "dotenv";

import productRoutes from "./routes/products.routes.js";
import { updatePrices } from "./jobs/priceUpdater.js";

//-----------------------------------------------

env.config();
const app = express();

//-----------------------------------------------

// Middlewares
app.use(cors());
app.use(express.json());

//-----------------------------------------------

// API routes
app.use("/api/products", productRoutes);

app.get("/ping", (req, res) => {
  res.send("pong");
});


// Home route testing
app.use("/", (req, res) => {
  res.send("|=| Welcome to the backend! |=|");
});

//-----------------------------------------------

// CRON JOB
cron.schedule("0 */8 * * *", async () => {
  try {
    console.log("|=| Running price update job |=|");
    await updatePrices();
  } catch (err) {
    console.error("|=| Price update failed |=|", err);
  }
});

//-----------------------------------------------

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`|=| Backend running on port ${PORT} |=|`);
});

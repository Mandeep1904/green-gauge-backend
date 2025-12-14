import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

// Base data directory
// const dataDir = path.resolve("src/data");
const dataDir = path.join(__dirname, "../data");

// Single dynamic route for ALL categories
// Examples:
// /api/products/toothpastes
// /api/products/soaps
// /api/products/shampoos
// /api/products/hairoils

router.get("/:category", (req, res) => {
  try {
    const { category } = req.params;
    const filePath = path.join(dataDir, `${category}.json`);

    // If category file doesn't exist
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const rawData = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(rawData);

    return res.json({
      success: true,
      category,
      data,
    });
  } catch (error) {
    console.error("Error reading product data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;

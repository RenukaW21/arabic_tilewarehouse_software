const express = require("express");
const router = express.Router();
const vendorController = require("./vendor.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const csvUpload = require("../../middlewares/csvUpload.middleware");

router.use(authenticate); // ✅ now correct middleware function

router.post("/import/csv", csvUpload.single("file"), vendorController.importCsv);

router.post("/", vendorController.createVendor);
router.get("/", vendorController.getVendors);
router.get("/:id", vendorController.getVendorById);
router.put("/:id", vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

module.exports = router;
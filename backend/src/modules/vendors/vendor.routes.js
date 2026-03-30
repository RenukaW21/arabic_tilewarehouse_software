const express = require("express");
const router = express.Router();
const vendorController = require("./vendor.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const csvUpload = require("../../middlewares/csvUpload.middleware");

router.use(authenticate);

const ADMIN_ONLY = requireRole(['super_admin', 'admin']);

router.post("/import/csv", ADMIN_ONLY, csvUpload.single("file"), vendorController.importCsv);

router.get("/",    vendorController.getVendors);
router.get("/:id", vendorController.getVendorById);
router.post("/",   ADMIN_ONLY, vendorController.createVendor);
router.put("/:id", ADMIN_ONLY, vendorController.updateVendor);
router.delete("/:id", ADMIN_ONLY, vendorController.deleteVendor);

module.exports = router;
'use strict';

const service = require('./services');

exports.getLowStockAlerts = async (req, res) => {
  try {

    const alerts = await service.getLowStockAlerts(req.tenantId);

    res.json({
      success: true,
      data: alerts
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
};



exports.updateAlertStatus = async (req, res, next) => {

  try {

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const alert = await service.updateAlertStatus(id, status, req.tenantId);

    return res.json({
      success: true,
      data: alert
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }

};


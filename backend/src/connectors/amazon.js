'use strict';
/**
 * Amazon SP-API Connector
 *
 * Skeleton ready for activation once the client confirms:
 *   1. Seller account credentials (Client ID, Client Secret, Refresh Token)
 *   2. Fulfillment type: 'fbm' (self-ship) or 'fba' (Amazon fulfils)
 *
 * FBM path: push stock qty to Amazon, receive orders, push tracking back.
 * FBA path: push inbound shipment batches to Amazon FBA centers; Amazon handles tracking.
 *
 * Auth: LWA (Login with Amazon) OAuth 2.0 — access tokens expire every 1 hour.
 */

const AMAZON_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const AMAZON_SP_API_BASE = 'https://sellingpartnerapi-eu.amazon.com'; // EU endpoint — update per marketplace

/**
 * Exchange a refresh token for a short-lived access token.
 * Call before any SP-API request; cache result until token_expires_at.
 */
async function getAccessToken(credentials) {
  const { api_key: clientId, api_secret: clientSecret, refresh_token: refreshToken } = credentials;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Amazon credentials incomplete: api_key (Client ID), api_secret (Client Secret), and refresh_token are required');
  }

  // Requires: npm install node-fetch (or use the built-in fetch in Node 18+)
  const response = await fetch(AMAZON_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Amazon token exchange failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return {
    access_token:     data.access_token,
    expires_in:       data.expires_in, // seconds
    token_expires_at: new Date(Date.now() + (data.expires_in - 60) * 1000),
  };
}

/**
 * Make an authenticated SP-API request.
 */
async function spRequest(credentials, method, path, body = null) {
  const { access_token } = await getAccessToken(credentials);

  const headers = {
    'x-amz-access-token': access_token,
    'Content-Type': 'application/json',
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${AMAZON_SP_API_BASE}${path}`, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`SP-API error ${response.status}: ${JSON.stringify(json.errors || json)}`);
  }

  return json;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * Pull orders created or updated after a given ISO datetime.
 * Docs: GET /orders/v0/orders
 */
async function getOrders(credentials, createdAfter) {
  const marketplaceId = credentials.marketplace_id || 'A21TJRUUN4KGV'; // India default
  const params = new URLSearchParams({
    MarketplaceIds: marketplaceId,
    CreatedAfter:   createdAfter || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
  return spRequest(credentials, 'GET', `/orders/v0/orders?${params}`);
}

/**
 * Get order items for a specific Amazon order.
 * Docs: GET /orders/v0/orders/{orderId}/orderItems
 */
async function getOrderItems(credentials, amazonOrderId) {
  return spRequest(credentials, 'GET', `/orders/v0/orders/${amazonOrderId}/orderItems`);
}

// ─── Stock (FBM only) ─────────────────────────────────────────────────────────

/**
 * Update available quantity for an FBM listing.
 * Docs: PUT /listings/2021-08-01/items/{sellerId}/{sku}
 * Only called when fulfillment_type = 'fbm'.
 */
async function updateFbmStock(credentials, sku, quantity) {
  if (credentials.fulfillment_type === 'fba') {
    throw new Error('updateFbmStock must not be called for FBA accounts — Amazon manages FBA stock');
  }
  const sellerId = credentials.seller_id;
  const marketplaceId = credentials.marketplace_id || 'A21TJRUUN4KGV';
  return spRequest(credentials, 'PUT',
    `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}`,
    {
      productType: 'PRODUCT',
      patches: [{ op: 'replace', path: '/attributes/fulfillment_availability', value: [{ quantity }] }],
    }
  );
}

// ─── Shipment Confirmation (FBM only) ─────────────────────────────────────────

/**
 * Confirm shipment for an FBM order item.
 * Docs: POST /shipping/v2/shipments
 * Only called when fulfillment_type = 'fbm'.
 */
async function confirmShipment(credentials, amazonOrderId, trackingNumber, carrierCode) {
  if (credentials.fulfillment_type === 'fba') {
    throw new Error('confirmShipment must not be called for FBA accounts — Amazon manages FBA fulfillment');
  }
  return spRequest(credentials, 'POST', '/shipping/v2/shipments', {
    clientReferenceId: amazonOrderId,
    shipTo:   {},
    shipFrom: {},
    packages: [{ trackingId: trackingNumber, dimensions: {}, weight: {} }],
  });
}

// ─── Returns ──────────────────────────────────────────────────────────────────

/**
 * Pull buyer return requests.
 * Docs: GET /orders/v0/orders/{orderId}/buyerInfo (returns info available via MCI API)
 * Amazon return events come via the Notifications API (SNS) in production.
 * This polling fallback is used until webhooks are configured.
 */
async function getReturns(credentials, createdAfter) {
  const marketplaceId = credentials.marketplace_id || 'A21TJRUUN4KGV';
  const params = new URLSearchParams({
    MarketplaceId:  marketplaceId,
    CreatedAfter:   createdAfter || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
  // Uses the Merchant Fulfillment Returns API
  return spRequest(credentials, 'GET', `/mfn/v0/sellerInputParameters?${params}`);
}

module.exports = {
  getAccessToken,
  getOrders,
  getOrderItems,
  updateFbmStock,
  confirmShipment,
  getReturns,
};

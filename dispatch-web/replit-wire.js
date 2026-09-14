"use strict";

/**
 * Drop-in wiring for the live Replit `server.js` (Google Frontend + GAESA).
 *
 * At the top of server.js:
 *   const billing = require("./dispatch-web/lib/replit-billing");
 *   // or copy dispatch-web/lib next to server.js and require("./lib/replit-billing")
 *
 * 1. First line of handle(req, res):
 *      if (billing.writeCanonicalRedirect(req, res)) return;
 *
 * 2. Replace publicUrl() with billing.publicUrl.
 *
 * 3. setSession cookie:
 *      billing.appendSetCookie(res, billing.sessionCookieHeader(token, req));
 *
 * 4. After creating an account, add the marker without clobbering the session:
 *      billing.appendSetCookie(res, billing.accountCreatedCookieHeader(req));
 *
 * 5. Logout clear:
 *      billing.appendSetCookie(res, billing.clearSessionCookieHeader(req));
 *
 * 6. Treat GET auth pages as HEAD-safe:
 *      if (p === "/__auth/subscribe" && billing.isSafeReadMethod(req.method))
 *
 * 7. Before create-checkout / billing-portal:
 *      if (billing.handleBillingMethodProbe(req, res, p, json)) return;
 *
 * 8. Webhook:
 *      if (billing.isStripeWebhookPath(p) && req.method === "POST")
 *
 * 9. serveStatic: refuse paths where billing.isServableStaticPath(p) is false.
 *
 * 10. In app.js, replace _startCheckout with dispatch-web/lib/start-checkout.js
 *     (browser build can inline the function; keep credentials:"include").
 *
 * Replit Secrets: set DISPATCH_PUBLIC_ORIGIN=https://thedispatch.uk
 * (production currently has https://www.thedispatch.uk, which is why Stripe
 * return URLs and recovery links can land on a host that does not hold the
 * apex session cookie). Stripe keys stay on the existing Replit connector.
 */

const billing = require("./lib/replit-billing");
const { startCheckout } = require("./lib/start-checkout");

module.exports = { billing, startCheckout };

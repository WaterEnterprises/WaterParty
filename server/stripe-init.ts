import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "./config";

let stripe: Stripe | null = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' as any });
  console.log("Stripe initialized successfully.");
} else {
  console.warn("STRIPE_SECRET_KEY not set — payment endpoints will return 503.");
}

export { stripe };

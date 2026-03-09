import { api } from "./client";

export async function createCheckoutSession(bookingId: string) {
  const res = await api.post("/payments/checkout", { bookingId });

  return res.data as {
    checkoutUrl: string;
    checkoutSessionId: string;
  };
}
import { api } from "./client";

export type SavedPaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  country: string | null;
};

export type SavedPaymentMethodsResponse = {
  customerId: string;
  paymentMethods: SavedPaymentMethod[];
};

export async function getSavedPaymentMethods() {
  const { data } = await api.get("/payments/methods");
  return data as SavedPaymentMethodsResponse;
}

export async function createCheckoutSession(bookingId: string) {
  const res = await api.post("/payments/checkout", { bookingId });

  return res.data as {
    checkoutUrl: string;
    checkoutSessionId: string;
  };
}
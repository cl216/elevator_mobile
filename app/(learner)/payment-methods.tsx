import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getSavedPaymentMethods,
  type SavedPaymentMethod,
} from "../../src/api/payments";

import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",

  divider: "rgba(255,255,255,0.06)",
};

function formatBrand(brand?: string | null) {
  if (!brand) return "Card";

  switch (brand.toLowerCase()) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "American Express";
    default:
      return brand.charAt(0).toUpperCase() + brand.slice(1);
  }
}

function formatExpiry(method: SavedPaymentMethod) {
  if (!method.exp_month || !method.exp_year) return "Expiry unavailable";

  const month = String(method.exp_month).padStart(2, "0");
  return `${month}/${method.exp_year}`;
}

export default function LearnerPaymentMethodsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPaymentMethods(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const result = await getSavedPaymentMethods();
      setCustomerId(result.customerId ?? null);
      setMethods(Array.isArray(result.paymentMethods) ? result.paymentMethods : []);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        "Could not load saved payment methods.";

      setError(Array.isArray(message) ? message.join("\n") : String(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const hasMethods = useMemo(() => methods.length > 0, [methods]);

  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPaymentMethods(true)}
              tintColor="#FFFFFF"
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Payments</Text>
            </View>

            <Text style={styles.title}>Payment methods</Text>
            <Text style={styles.subtitle}>
              Manage saved cards for quicker checkout next time.
            </Text>
          </View>

          {loading ? (
            <View style={styles.stateOuter}>
              <View style={styles.stateInner}>
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading payment methods…</Text>
                </View>
              </View>
            </View>
          ) : error ? (
            <View style={styles.stateOuter}>
              <View style={styles.stateInner}>
                <Text style={styles.sectionTitle}>Could not load payment methods</Text>
                <Text style={styles.bodyText}>{error}</Text>
              </View>
            </View>
          ) : !hasMethods ? (
            <>
              <View style={styles.cardOuter}>
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle}>No saved cards yet</Text>
                  <Text style={styles.bodyText}>
                    Your saved cards will appear here after you complete checkout
                    and Stripe saves a payment method for future use.
                  </Text>
                </View>
              </View>

              <View style={styles.cardOuter}>
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle}>How saved cards work</Text>
                  <Text style={styles.bodyText}>
                    After you pay for a booking through Stripe Checkout, your
                    card may be saved securely for faster checkout next time.
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.cardOuter}>
                <View style={[styles.cardInner, styles.cardInnerHighlighted]}>
                  <Text style={styles.cardTitle}>
                    {methods.length} saved {methods.length === 1 ? "card" : "cards"}
                  </Text>

                  <Text style={styles.bodyText}>
                    Stored securely by Stripe for quicker future checkout.
                  </Text>

                  {customerId ? (
                    <Text style={styles.metaText}>Stripe customer: {customerId}</Text>
                  ) : null}
                </View>
              </View>

              {methods.map((method) => (
                <View style={styles.cardOuter} key={method.id}>
                  <View style={styles.cardInner}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardTopText}>
                        <Text style={styles.cardTitle}>
                          {formatBrand(method.brand)}
                        </Text>
                        <Text style={styles.cardNumber}>
                          •••• {method.last4 ?? "----"}
                        </Text>
                      </View>

                      <View style={styles.expiryBadge}>
                        <Text style={styles.expiryBadgeText}>
                          {formatExpiry(method)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <Text style={styles.metaRow}>
                      Country: {method.country ?? "Unknown"}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  paddingHorizontal: 20,
  paddingTop: 24,
  paddingBottom: 40,
  flexGrow: 1,  },

  content: {
    paddingBottom: 20,
  },

  hero: {
    marginBottom: 18,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.25)",
    marginBottom: 12,
  },

  heroBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  stateOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    marginBottom: 14,
  },

  stateInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },

  loadingText: {
    color: COLORS.textSoft,
    fontSize: 14,
    marginTop: 10,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  cardInnerHighlighted: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(111,146,255,0.20)",
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },

  bodyText: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  cardTopText: {
    flex: 1,
  },

  cardNumber: {
    color: COLORS.textSoft,
    fontSize: 15,
    marginTop: 6,
  },

  expiryBadge: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  expiryBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  cardDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginTop: 14,
    marginBottom: 12,
  },

  metaRow: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },

  metaText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
});
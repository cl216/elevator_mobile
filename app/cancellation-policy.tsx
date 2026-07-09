import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import AppLayout from "@/src/components/layout/AppLayout";
import { AppScreen } from "@/src/components/ui/AppScreen";

const COLORS = {
  bg: "#05070F",
  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.75)",
  accent: "#6F92FF",
};

export default function CancellationPolicyScreen() {
  return (
    <AppLayout>
      <AppScreen>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>Cancellation Policy</Text>

          <Text style={styles.body}>
            By booking a lesson through Elevator you agree to the following
            cancellation policy.
          </Text>

          <Text style={styles.heading}>Learner cancellations</Text>

          <Text style={styles.body}>
            • Cancel more than 12 hours before the lesson and you will receive a
            refund of the lesson price and the Elevator platform fee.
            {"\n\n"}
            • Payment processing fees are non-refundable.
            {"\n\n"}
            • Cancelling within 12 hours of the lesson start time is not
            eligible for a refund.
          </Text>

          <Text style={styles.heading}>Teacher cancellations</Text>

          <Text style={styles.body}>
            If the teacher cancels the lesson or fails to attend, you will
            receive a full refund.
          </Text>

          <Text style={styles.heading}>Disputes</Text>

          <Text style={styles.body}>
            Elevator may investigate disputes and issue refunds where
            appropriate.
          </Text>
        </ScrollView>
      </AppScreen>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 20,
  },
  heading: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 10,
  },
  body: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 24,
  },
});
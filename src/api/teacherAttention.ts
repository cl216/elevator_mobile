import { api } from "@/src/api/client";

export type TeacherAttentionItem = {
  type: string;
  label: string;
  count: number;
  route: string;
  actionLabel: string;
  priority: "low" | "medium" | "high";
};

export type TeacherAttentionSummary = {
  total_action_items: number;
  items: TeacherAttentionItem[];
};

export type TeacherPayoutSummary = {
  pending_amount: number;
  pending_count: number;
  next_eligible_at: string | null;

  transferred_amount: number;
  transferred_count: number;

  latest_transferred_amount: number | null;
  latest_transferred_at: string | null;
  latest_funds_available_at: string | null;

  failed_amount: number;
  failed_count: number;

  currency: string;
};

export async function getTeacherAttentionSummary() {
  const res = await api.get("/teacher/attention-summary");
  return res.data as TeacherAttentionSummary;
}

export async function getTeacherPayoutSummary() {
  const res = await api.get("/teacher/payout-summary");
  return res.data as TeacherPayoutSummary;
}

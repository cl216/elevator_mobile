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

export async function getTeacherAttentionSummary() {
  const res = await api.get("/teacher/attention-summary");
  return res.data as TeacherAttentionSummary;
}
import { api } from "./client";

/** ===== TYPES ===== */

export type ApprovedCategory = {
  id: string;
  slug: string;
  label: string;
};

export type ProposedCategoryResponse = {
  id: string;
  slug: string;
  label: string;
  status: "pending" | "approved" | "rejected";
  message: string;
};

/** ===== API ===== */

export async function getApprovedCategories(): Promise<ApprovedCategory[]> {
  const { data } = await api.get("/categories");

  // Safety fallback (prevents crashes if backend ever misbehaves)
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item: any) => ({
    id: String(item.id),
    slug: String(item.slug),
    label: String(item.label),
  }));
}

export async function proposeCategory(
  label: string
): Promise<ProposedCategoryResponse> {
  const { data } = await api.post("/categories/propose", {
    label: label.trim(),
  });

  return {
    id: String(data.id),
    slug: String(data.slug),
    label: String(data.label),
    status: data.status,
    message: String(data.message ?? "Category proposal submitted"),
  };
}
import { api } from "./client";

export async function createClassRequest(input: {
  request_type: "existing_category" | "new_class";
  category?: string;
  custom_title?: string;
  note?: string;
  lat: number;
  lng: number;
}) {
  const { data } = await api.post("/class-requests", input);
  return data;
}

export async function getNearbyTeacherDemand() {
  const { data } = await api.get("/class-requests/nearby-for-teacher");
  return data as {
    existing_categories: Array<{ category: string; count: number }>;
    custom_ideas: Array<{ custom_title: string; count: number }>;
  };
}
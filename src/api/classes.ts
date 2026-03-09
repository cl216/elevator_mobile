import { api } from "./client";

export async function createClass(input: {
  title: string;
  category: string;
  description?: string;
  price: number;
}) {
  const res = await api.post("/classes", input);
  return res.data;
}

export async function getMyClasses() {
  const res = await api.get("/classes/mine");
  return res.data as Array<{
    id: string;
    title: string;
    category: string;
    description?: string | null;
    price: number;
  }>;
}
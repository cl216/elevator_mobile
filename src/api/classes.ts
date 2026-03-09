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
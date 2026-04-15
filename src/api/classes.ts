import { api } from "./client";

export async function createClass(input: {
  title: string;
  category: string;
  description?: string;
  price: number;
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
}) {
  const res = await api.post("/classes", input);
  return res.data;
}

export async function updateClass(
  classId: string,
  input: {
    title?: string;
    category?: string;
    description?: string;
    price?: number;
    image_url_1?: string;
    image_url_2?: string;
    image_url_3?: string;
  },
) {
  const res = await api.patch(`/classes/${classId}`, input);
  return res.data;
}

export async function getClassById(classId: string) {
  const res = await api.get(`/classes/${classId}`);
  return res.data as {
    id: string;
    title: string;
    category: string;
    description?: string | null;
    price: number;
    image_url_1?: string | null;
    image_url_2?: string | null;
    image_url_3?: string | null;
  };
}

export async function getMyClasses() {
  const res = await api.get("/classes/mine");
  return res.data as Array<{
    id: string;
    title: string;
    category: string;
    description?: string | null;
    price: number;
    image_url_1?: string | null;
    image_url_2?: string | null;
    image_url_3?: string | null;
  }>;
}
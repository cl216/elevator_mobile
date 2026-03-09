import { api } from "./client";

export async function createSession(input: {
  classId: string;
  start_time: string;
  duration: number;
  max_participants: number;
  lat: number;
  lng: number;
}) {
  const res = await api.post("/sessions", input);
  return res.data;
}
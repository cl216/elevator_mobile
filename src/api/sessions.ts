import { api } from "./client";

export async function createSession(input: {
  title: string;
  category: string;
  description?: string;
  price: number;
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
  start_time: string;
  duration: number;
  max_participants: number;
  lat: number;
  lng: number;
  rough_location?: string;
  arrival_instructions?: string;
}) {
  const res = await api.post("/sessions/teacher/create", input);
  return res.data;
}

export async function getMySessions() {
  const res = await api.get("/sessions/me");
  return res.data;
}

export async function getSessionById(sessionId: string) {
  const res = await api.get(`/sessions/${sessionId}`);
  return res.data;
}

export async function updateSession(
  sessionId: string,
  input: {
    title?: string;
    category?: string;
    description?: string;
    price?: number;
    image_url_1?: string;
    image_url_2?: string;
    image_url_3?: string;
    start_time?: string;
    duration?: number;
    max_participants?: number;
    lat?: number;
    lng?: number;
    rough_location?: string;
    arrival_instructions?: string;
  },
) {
  const res = await api.patch(`/sessions/${sessionId}`, input);
  return res.data;
}

export async function duplicateSession(
  sessionId: string,
  start_time: string,
) {
  const res = await api.post(`/sessions/${sessionId}/duplicate`, {
    start_time,
  });
  return res.data;
}

export async function updateArrivalInstructions(
  sessionId: string,
  arrival_instructions: string,
) {
  const res = await api.patch(`/sessions/${sessionId}/arrival-instructions`, {
    arrival_instructions,
  });
  return res.data;
}

export async function cancelSession(sessionId: string) {
  const res = await api.delete(`/sessions/${sessionId}`);
  return res.data;
}

export async function getSessionBookings(sessionId: string) {
  const res = await api.get(`/teacher/sessions/${sessionId}/bookings`);
  return res.data;
}
import { api } from "./client";

export type TeacherSessionRow = {
  id: string;
  start_time: string;
  end_time?: string;
  duration: number;
  max_participants: number;
  price: number;
  rough_location?: string | null;
  title: string;
  category: string;
  bookings_count?: string | number;
  status?: "ACTIVE" | "CANCELLED" | string;
  cancelled_at?: string | null;
  session_type?: "GROUP" | "PRIVATE" | string;
  private_invitee_user_id?: string | null;
};

export type SessionDetail = {
  id: string;
  class_id?: string;
  start_time: string;
  duration: number;
  price: number;
  max_participants: number;
  bookings_count?: number;
  spots_left?: number;
  attendee_first_names?: string[];
  status?: "ACTIVE" | "CANCELLED" | string;
  cancelled_at?: string | null;
  session_type?: "GROUP" | "PRIVATE" | string;
  private_invitee_user_id?: string | null;
  rough_location?: string | null;
  arrival_instructions?: string | null;
  image_urls?: string[];
  lat?: number;
  lng?: number;
  class?: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
  };
  teacher?: {
    id: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
};

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
  return (Array.isArray(res.data) ? res.data : []) as TeacherSessionRow[];
}

export async function getSessionById(sessionId: string) {
  const res = await api.get(`/sessions/${sessionId}`);
  return res.data as SessionDetail;
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

export async function duplicateSession(sessionId: string, start_time: string) {
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
  export async function getPendingReviewSessions() {
  const res = await api.get("/sessions/admin/pending-review");
  return res.data;
}

export async function approveSessionReview(sessionId: string) {
  const res = await api.patch(`/sessions/admin/${sessionId}/approve`);
  return res.data;
}

export async function rejectSessionReview(sessionId: string) {
  const res = await api.patch(`/sessions/admin/${sessionId}/reject`);
  return res.data;
}
export async function getMySessionById(sessionId: string) {
  const res = await api.get(`/sessions/teacher/${sessionId}`);
  return res.data as SessionDetail;
}
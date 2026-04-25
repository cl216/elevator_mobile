import { api } from "./client";

export type PrivateSessionRequestStatus =
  | "OPEN"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type PrivateSessionRequest = {
  id: string;
  message: string;
  requested_date_1?: string | null;
  requested_date_2?: string | null;
  requested_date_3?: string | null;
  requested_duration_minutes?: number | null;
    teacher_response_message?: string | null;
  learner_note?: string | null;
  status: PrivateSessionRequestStatus;
  accepted_at?: string | null;
  accepted_session_id?: string | null;
  declined_at?: string | null;
  expired_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  learner?: {
    id: string;
    first_name?: string | null;
    email?: string | null;
  } | null;
  teacher?: {
    id: string;
    first_name?: string | null;
    email?: string | null;
  } | null;
};

export type CreatePrivateSessionRequestInput = {
  teacher_id: string;
  message: string;
  requested_date_1?: string | null;
  requested_date_2?: string | null;
  requested_date_3?: string | null;
  requested_duration_minutes?: number | null;
  learner_note?: string | null;
};

export type AcceptPrivateSessionRequestInput = {
  title: string;
  description?: string | null;
  category: string;
  price: number;
  start_time: string;
  duration: number;
  lat: number;
  lng: number;
  rough_location: string;
  arrival_instructions?: string | null;
};

export async function createPrivateSessionRequest(
  input: CreatePrivateSessionRequestInput,
) {
  const res = await api.post("/private-session-requests", input);
  return res.data as PrivateSessionRequest;
}

export async function getMyLearnerPrivateSessionRequests() {
  const res = await api.get("/private-session-requests/mine/learner");
  return (Array.isArray(res.data) ? res.data : []) as PrivateSessionRequest[];
}

export async function getMyTeacherPrivateSessionRequests() {
  const res = await api.get("/private-session-requests/mine/teacher");
  return (Array.isArray(res.data) ? res.data : []) as PrivateSessionRequest[];
}

export async function cancelPrivateSessionRequest(requestId: string) {
  const res = await api.post(`/private-session-requests/${requestId}/cancel`);
  return res.data as PrivateSessionRequest;
}

export async function declinePrivateSessionRequest(
  requestId: string,
  message?: string,
) {
  const res = await api.post(`/private-session-requests/${requestId}/decline`, {
    message: message?.trim() || undefined,
  });
  return res.data as PrivateSessionRequest;
}

export async function acceptPrivateSessionRequest(
  requestId: string,
  input: AcceptPrivateSessionRequestInput,
) {
  const res = await api.post(
    `/private-session-requests/${requestId}/accept`,
    input,
  );
  return res.data;
}
import { api } from "./client";

export async function createBooking(
  sessionId: string,
  introMessage?: string,
) {
  const res = await api.post("/bookings", {
    sessionId,
    introMessage: introMessage?.trim() || undefined,
  });

  return res.data;
}

export async function getMyBookings() {
  const res = await api.get("/bookings/me");
  return res.data;
}

export async function reportTeacherNoShow(
  bookingId: string,
  comment?: string,
) {
  const res = await api.post(
    `/bookings/${bookingId}/no-show/teacher`,
    {
      comment: comment?.trim() || undefined,
    },
  );

  return res.data;
}

export async function reportLearnerNoShow(
  bookingId: string,
  comment?: string,
) {
  const res = await api.post(
    `/bookings/${bookingId}/no-show/learner`,
    {
      comment: comment?.trim() || undefined,
    },
  );

  return res.data;
}
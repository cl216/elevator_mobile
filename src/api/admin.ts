import { api } from "./client";

export async function getAdminUsers() {
  const res = await api.get("/admin/users");
  return res.data;
}

export async function suspendUser(userId: string) {
  const res = await api.patch(`/admin/users/${userId}/suspend`);
  return res.data;
}

export async function unsuspendUser(userId: string) {
  const res = await api.patch(`/admin/users/${userId}/unsuspend`);
  return res.data;
}

export async function getPendingCategories() {
  const res = await api.get("/admin/categories/pending");
  return res.data;
}

export async function approveCategory(categoryId: string) {
  const res = await api.patch(`/admin/categories/${categoryId}/approve`);
  return res.data;
}

export async function rejectCategory(categoryId: string) {
  const res = await api.patch(`/admin/categories/${categoryId}/reject`);
  return res.data;
}

export async function getPendingSessions() {
  const res = await api.get("/admin/sessions/pending");
  return res.data;
}

export async function approveSession(sessionId: string) {
  const res = await api.patch(`/admin/sessions/${sessionId}/approve`);
  return res.data;
}

export async function rejectSession(sessionId: string) {
  const res = await api.patch(`/admin/sessions/${sessionId}/reject`);
  return res.data;
}

export async function getAdminBookings() {
  const res = await api.get("/admin/bookings");
  return res.data;
}

export async function getDisputedBookings() {
  const res = await api.get("/admin/bookings/disputes");
  return res.data;
}

export async function approveLearnerNoShow(bookingId: string) {
  const res = await api.patch(
    `/admin/bookings/${bookingId}/approve-learner-no-show`,
  );

  return res.data;
}

export async function approveTeacherNoShow(bookingId: string) {
  const res = await api.patch(
    `/admin/bookings/${bookingId}/approve-teacher-no-show`,
  );

  return res.data;
}

export async function rejectDispute(bookingId: string) {
  const res = await api.patch(
    `/admin/bookings/${bookingId}/reject-dispute`,
  );

  return res.data;
}

export async function markBookingCompleted(bookingId: string) {
  const res = await api.patch(
    `/admin/bookings/${bookingId}/mark-completed`,
  );

  return res.data;
}

export async function getAdminClassRequests() {
  const res = await api.get("/admin/class-requests");
  return res.data;
}

export async function approveClassRequest(requestId: string) {
  const res = await api.patch(`/admin/class-requests/${requestId}/approve`);
  return res.data;
}

export async function rejectClassRequest(requestId: string) {
  const res = await api.patch(`/admin/class-requests/${requestId}/reject`);
  return res.data;
}

export async function getAdminImages() {
  const res = await api.get("/admin/images");
  return res.data;
}

export async function removeAdminImage(input: {
  source_type: "user" | "teacher_profile" | "class";
  source_id: string;
  field: string;
}) {
  const res = await api.patch("/admin/images/remove", input);
  return res.data;
}
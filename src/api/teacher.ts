import { api } from "./client";

export type TeacherProfilePayload = {
  full_name?: string;
  bio?: string;
  image_url?: string;
  gallery_image_urls?: string[];
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
};

export async function getMyTeacherProfile() {
  const res = await api.get("/teacher/me/profile");
  return res.data;
}

export async function createTeacherProfile(payload: TeacherProfilePayload) {
  const res = await api.post("/teacher/profile", payload);
  return res.data;
}

export async function getTeacherProfile(teacherId: string) {
  const res = await api.get(`/teacher/${teacherId}/profile`);
  return res.data;
}

export async function followTeacher(teacherId: string) {
  const res = await api.post(`/teacher/${teacherId}/follow`);
  return res.data;
}

export async function unfollowTeacher(teacherId: string) {
  const res = await api.delete(`/teacher/${teacherId}/follow`);
  return res.data;
}

export async function getFollowStatus(teacherId: string) {
  const res = await api.get(`/teacher/${teacherId}/follow-status`);
  return res.data as { following: boolean };
}
import { api } from "./client";

export async function getFollowStatus(teacherId: string) {
  const res = await api.get(`/teacher/${teacherId}/follow-status`);
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

export async function getTeacherProfile(teacherId: string) {
  const res = await api.get(`/teacher/${teacherId}/profile`);
  return res.data as {
    id: string;
    full_name: string;
    bio: string | null;
    image_url: string | null;
    joined_at: string;
  };
}

export async function createTeacherProfile(input: {
  full_name: string;
  bio?: string;
  image_url?: string;
}) {
  const res = await api.post("/teacher/profile", input);
  return res.data;
}

export async function getMyTeacherProfile() {
  const res = await api.get("/teacher/me/profile");
  return res.data as {
    id: string;
    full_name: string;
    bio: string | null;
    image_url: string | null;
  } | null;
}
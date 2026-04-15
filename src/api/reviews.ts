import { api } from "./client";

export type ReviewEligibilityResponse = {
  eligible: boolean;
  reason: string | null;
};

export type TeacherReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  learner?: {
    id: string;
    first_name?: string | null;
    full_name?: string | null;
  } | null;
};

export async function getReviewEligibility(bookingId: string) {
  const { data } = await api.get(`/reviews/booking/${bookingId}/eligibility`);
  return data as ReviewEligibilityResponse;
}

export async function createReview(input: {
  bookingId: string;
  rating: number;
  comment?: string;
}) {
  const { data } = await api.post("/reviews", input);
  return data;
}

export async function getTeacherReviews(teacherId: string) {
  const { data } = await api.get(`/reviews/teacher/${teacherId}`);
  return data as TeacherReview[];
}

export async function getTeacherReviewSummary(teacherId: string) {
  const { data } = await api.get(`/reviews/teacher/${teacherId}/summary`);
  return data as {
    review_count: number;
    average_rating: number | null;
  };
}
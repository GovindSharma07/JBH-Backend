import { z } from 'zod';

// Define schemas for your data
export const createCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  price: z.number().min(0, "Price cannot be negative").default(0),
  thumbnail_url: z.string().url("Invalid URL").optional(),
  is_published: z.boolean().optional()
});

export const startClassSchema = z.object({
  // [FIX] Changed 'required_error' to 'message' (handles invalid_type/undefined)
  scheduleId: z.number({ message: "Schedule ID is required" }), 
  topic: z.string().min(1, "Topic is required")
});

export const joinClassSchema = z.object({
  // [FIX] Changed 'required_error' to 'message'
  liveLectureId: z.number({ message: "Live Lecture ID is required" })
});
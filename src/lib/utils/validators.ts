import { z } from "zod";

export const createCandidateSchema = z.object({
  firstname: z.string().min(2),
  lastname: z.string().min(2),
  email: z.string().email(),
  createdAt: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(2),
  zipcode: z.string().min(4).max(10).optional(),
  source: z.string().optional(),
  comment: z.string().optional(),
  assignedDevId: z.string().optional()
});

export const stepActionSchema = z.object({
  candidateId: z.string().min(1),
  stepNumber: z.number().min(1).max(10),
  comment: z.string().optional()
});

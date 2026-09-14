import { z } from "zod";
import { checks, scales, assessments } from "./model";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  });
const number = z.number().finite().nullable();
const integer = z.number().int().nullable();
// Shape parsing only. Match authenticity and CS2 score validation are deferred.
export const dailySchema = z.object({
  date: dateSchema,
  sleepHours: number,
  warmupMinutes: integer,
  caffeine: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).nullable(),
  notes: z.string().max(10000),
  ...Object.fromEntries(checks.map(([key]) => [key, z.boolean().nullable()])),
  ...Object.fromEntries(scales.map(([key]) => [key, integer])),
});
export const sessionSchema = z.object({
  date: dateSchema,
  name: z.string().trim().min(1).max(100),
  startedAt: z.string().datetime(),
  notes: z.string().max(10000).optional(),
});
export const matchSchema = z.object({
  sessionId: z.string().min(1),
  playedAt: z.string().datetime(),
  platform: z.enum(["VALVE", "FACEIT"]),
  map: z.string().max(100),
  result: z.enum(["WIN", "LOSS", "DRAW"]).nullable(),
  teamScore: integer,
  enemyScore: integer,
  kills: integer,
  deaths: integer,
  assists: integer,
  adr: number,
  headshot: number,
  rating: number,
  tilted: z.boolean().nullable(),
  tired: z.boolean().nullable(),
  notes: z.string().max(10000),
  ...Object.fromEntries(assessments.map(([key]) => [key, integer])),
});

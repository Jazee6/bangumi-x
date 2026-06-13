import { z } from "zod";
import { SubjectType } from "@/types";

export const idSchema = z.object({ id: z.number() });

export const subjectIdSchema = z.object({ subjectId: z.number() });

export const characterIdSchema = z.object({ characterId: z.number() });

export const personIdSchema = z.object({ personId: z.number() });

export const browseSubjectsSchema = z.object({
	type: z.enum(SubjectType),
	sort: z.enum(["date", "rank"]).optional(),
	year: z.number().optional(),
	month: z.number().min(1).max(12).optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
});

export const searchSubjectsSchema = z.object({
	keyword: z.string(),
	sort: z.enum(["match", "heat", "rank", "score"]).optional(),
	filter: z
		.object({
			type: z.enum(SubjectType).array().optional(),
			tag: z.string().array().optional(),
			air_date: z.string().array().optional(),
			rating: z.string().array().optional(),
			nsfw: z.boolean().optional(),
		})
		.optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
});

export const searchCharactersSchema = z.object({
	keyword: z.string(),
	filter: z
		.object({
			nsfw: z.boolean().optional(),
		})
		.optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
});

export const searchPersonsSchema = z.object({
	keyword: z.string(),
	filter: z
		.object({
			career: z.string().array().optional(),
		})
		.optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
});

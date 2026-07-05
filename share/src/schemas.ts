import * as v from "valibot";
import { SubjectType } from "./types";

const numericParam = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((x) => Number(x)),
  v.number(),
  v.integer(),
);

const idSchema = v.pipe(numericParam, v.minValue(1));
const limitSchema = v.pipe(numericParam, v.minValue(1), v.maxValue(50));
const offsetSchema = v.pipe(numericParam, v.minValue(0));

export const idParamSchema = v.object({ id: idSchema });
export const subjectIdParamSchema = v.object({ subjectId: idSchema });
export const characterIdParamSchema = v.object({ characterId: idSchema });
export const personIdParamSchema = v.object({ personId: idSchema });

const subjectSortSchema = v.picklist(["rank"]);

export const browseSubjectsSchema = v.object({
  type: v.pipe(numericParam, v.enum(SubjectType)),
  sort: subjectSortSchema,
  limit: v.optional(limitSchema, 20),
  offset: v.optional(offsetSchema, 0),
});

export const subjectEpisodesSchema = v.object({
  subject_id: idSchema,
  type: v.optional(v.pipe(numericParam, v.minValue(0), v.maxValue(6)), 0),
  limit: v.optional(limitSchema, 20),
  offset: v.optional(offsetSchema, 0),
});

const subjectsFilterSchema = v.object({
  type: v.optional(v.array(v.enum(SubjectType))),
});

const charactersFilterSchema = v.object({
  type: v.optional(v.array(v.pipe(numericParam, v.minValue(1), v.maxValue(4)))),
});

const personsFilterSchema = v.object({});

export const searchSubjectsSchema = v.object({
  keyword: v.pipe(v.string(), v.minLength(1)),
  sort: v.optional(subjectSortSchema, "rank"),
  filter: v.optional(subjectsFilterSchema),
  limit: v.optional(limitSchema, 20),
  offset: v.optional(offsetSchema, 0),
});

export const searchCharactersSchema = v.object({
  keyword: v.pipe(v.string(), v.minLength(1)),
  filter: v.optional(charactersFilterSchema),
  limit: v.optional(limitSchema, 20),
  offset: v.optional(offsetSchema, 0),
});

export const searchPersonsSchema = v.object({
  keyword: v.pipe(v.string(), v.minLength(1)),
  filter: v.optional(personsFilterSchema),
  limit: v.optional(limitSchema, 20),
  offset: v.optional(offsetSchema, 0),
});

const BGM_IMAGE_HOSTS: readonly string[] = ["lain.bgm.tv", "bgmimg.anibt.net"];

export const imageQuerySchema = v.object({
  url: v.pipe(
    v.string(),
    v.url(),
    v.check((input) => {
      const host = new URL(input).host;
      return BGM_IMAGE_HOSTS.includes(host);
    }, "host not allowed"),
  ),
});

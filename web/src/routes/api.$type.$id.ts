import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  breadcrumbJsonLd,
  characterJsonLd,
  episodeJsonLd,
  personJsonLd,
  subjectJsonLd,
} from "@/lib/seo/site.ts";
import {
  getCharacter,
  getCharacterPersons,
  getEpisode,
  getPerson,
  getSubject,
  getSubjectCharacters,
  getSubjectPersons,
} from "@/server/functions.ts";

export const Route = createFileRoute("/api/$type/$id")({
  headers: () => ({
    "Content-Type": "application/ld+json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  }),
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        const type = params.type as "subjects" | "characters" | "persons" | "episodes";

        let jsonLd: Record<string, unknown>;

        if (type === "subjects") {
          const subject = await getSubject({ data: { id } });
          if (!subject) throw notFound();
          const [characters, persons] = await Promise.all([
            getSubjectCharacters({ data: { subjectId: id } }),
            getSubjectPersons({ data: { subjectId: id } }),
          ]);
          jsonLd = subjectJsonLd(subject, characters, persons);
        } else if (type === "characters") {
          const character = await getCharacter({ data: { id } });
          if (!character) throw notFound();
          const persons = await getCharacterPersons({ data: { characterId: id } });
          jsonLd = characterJsonLd(character, persons);
        } else if (type === "persons") {
          const person = await getPerson({ data: { id } });
          if (!person) throw notFound();
          jsonLd = personJsonLd(person);
        } else if (type === "episodes") {
          const episode = await getEpisode({ data: { id } });
          if (!episode) throw notFound();
          const subject = await getSubject({ data: { id: episode.subject_id } });
          jsonLd = episodeJsonLd(episode, subject);
        } else {
          return new Response(JSON.stringify({ error: "Bad type" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const path = `/${type}/${id}`;
        const body = JSON.stringify([jsonLd, breadcrumbJsonLd(path)]);
        return new Response(body, {
          headers: { "Content-Type": "application/ld+json; charset=utf-8" },
        });
      },
    },
  },
});

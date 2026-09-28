import { Link } from "@tanstack/react-router";

import type { RelatedCharacter, RelatedPerson, RelatedSubjectsResponse } from "share";

import { RelationEmpty } from "@/components/empty-states";
import { SubjectPosterCard } from "@/components/subject-poster-card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityCard, entityDetails } from "@/features/entities/entity-cards";
import { EntityDetail } from "@/features/entities/entity-detail";
import {
  ENTITY_KINDS,
  type EntityDetailOf,
  type EntityKind,
  type EntityRelatedOf,
  type EntityTab,
} from "@/features/entities/entity-kind";
import { RelationGroups } from "@/features/entities/relation-groups";

function detailFields(detail: EntityDetailOf<EntityKind>) {
  return [
    ...("careers" in detail
      ? [{ label: "职业", value: detail.careers.length > 0 ? detail.careers.join("、") : null }]
      : []),
    { label: "性别", value: detail.gender },
    { label: "生日", value: detail.birthday },
    { label: "血型", value: detail.bloodType },
  ];
}

function RelatedEntityLink({ kind, id }: { kind: EntityKind; id: number }) {
  // 角色关联到人物，人物关联到角色。
  return kind === "character" ? (
    <Link
      to="/persons/$personId"
      params={{ personId: id.toString() }}
      search={{ tab: "subjects" }}
    />
  ) : (
    <Link
      to="/characters/$characterId"
      params={{ characterId: id.toString() }}
      search={{ tab: "subjects" }}
    />
  );
}

function PanelLoading({ label }: { label: string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
      <Spinner /> 加载{label}
    </p>
  );
}

export function EntityView<K extends EntityKind>({
  kind,
  detail,
  subjects,
  subjectsPending,
  related,
  relatedPending,
  tab,
  onTabChange,
}: {
  kind: K;
  detail: EntityDetailOf<K>;
  subjects?: RelatedSubjectsResponse;
  subjectsPending: boolean;
  related?: EntityRelatedOf<K>;
  relatedPending: boolean;
  tab: EntityTab;
  onTabChange: (tab: EntityTab) => void;
}) {
  const config = ENTITY_KINDS[kind];
  const relatedLabel = `关联${config.relatedLabel}`;

  return (
    <EntityDetail
      name={detail.name}
      imageUrl={detail.imageUrl}
      type={detail.type}
      fields={detailFields(detail)}
      summary={detail.summary}
    >
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as EntityTab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="subjects">
            条目
            {subjects && (
              <span className="text-muted-foreground tabular-nums">{subjects.total}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value={config.relatedTab}>
            {config.relatedLabel}
            {related && <span className="text-muted-foreground tabular-nums">{related.total}</span>}
          </TabsTrigger>
        </TabsList>

        {tab === "subjects" && (
          <section className="progressive-tab-panel mt-4" data-active aria-label="关联条目">
            {subjectsPending ? (
              <PanelLoading label="关联条目" />
            ) : !subjects || subjects.total === 0 ? (
              <RelationEmpty label="关联条目" />
            ) : (
              <RelationGroups
                groups={subjects.groups}
                getKey={(subject) => `${subject.id}-${subject.relation}-${subject.chapters ?? ""}`}
                gridClassName="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8"
                renderItem={(subject) => (
                  <SubjectPosterCard
                    id={subject.id}
                    title={subject.title}
                    imageUrl={subject.imageUrl}
                  />
                )}
              />
            )}
          </section>
        )}

        {tab === config.relatedTab && (
          <section className="progressive-tab-panel mt-4" data-active aria-label={relatedLabel}>
            {relatedPending ? (
              <PanelLoading label={relatedLabel} />
            ) : !related || related.total === 0 ? (
              <RelationEmpty label={relatedLabel} />
            ) : (
              <RelationGroups<RelatedPerson | RelatedCharacter>
                groups={related.groups}
                getKey={(entity) => `${entity.id}-${entity.subject.id}-${entity.relation}`}
                renderItem={(entity) => (
                  <EntityCard
                    imageUrl={entity.imageUrl}
                    title={entity.name}
                    description={entityDetails(entity.type, entity.relation)}
                    link={<RelatedEntityLink kind={kind} id={entity.id} />}
                  />
                )}
              />
            )}
          </section>
        )}
      </Tabs>
    </EntityDetail>
  );
}

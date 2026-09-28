import { Fragment } from "react";

import type { RelationGroup } from "share";

const defaultGridClass = "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

export function RelationGroups<T>({
  groups,
  getKey,
  renderItem,
  gridClassName,
}: {
  groups: RelationGroup<T>[];
  getKey: (item: T) => React.Key;
  renderItem: (item: T) => React.ReactNode;
  gridClassName?: string;
}) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.relation}>
          <h3 className="mb-3 text-base font-semibold">{group.relation}</h3>
          <div className={gridClassName ?? defaultGridClass}>
            {group.items.map((item) => (
              <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

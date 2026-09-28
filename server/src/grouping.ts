import type { RelationGroup } from "share";

interface GroupWithOrder<T> extends RelationGroup<T> {
  order: number;
}

export function groupByRelation<T>(
  items: T[],
  getRelation: (item: T) => string,
  getIdentity: (item: T) => string,
  getPriority: (relation: string) => number,
): RelationGroup<T>[] {
  const groups = new Map<string, GroupWithOrder<T>>();

  for (const item of items) {
    const relation = getRelation(item);
    let group = groups.get(relation);
    if (!group) {
      group = { relation, items: [], order: groups.size };
      groups.set(relation, group);
    }
    const identity = getIdentity(item);
    if (!group.items.some((existing) => getIdentity(existing) === identity)) {
      group.items.push(item);
    }
  }

  return [...groups.values()]
    .sort((left, right) => {
      const priority = getPriority(left.relation) - getPriority(right.relation);
      return priority === 0 ? left.order - right.order : priority;
    })
    .map(({ relation, items }) => ({ relation, items }));
}

export function characterRelationPriority(relation: string): number {
  if (/(?:^|[·/、\s])(?:主角|主人公|主役)(?:$|[·/、\s])/.test(relation)) {
    return 0;
  }
  if (/(?:^|[·/、\s])(?:配角|助演)(?:$|[·/、\s])/.test(relation)) {
    return 1;
  }
  if (/(?:^|[·/、\s])(?:客串|友情出演)(?:$|[·/、\s])/.test(relation)) {
    return 2;
  }
  if (relation === "其他") {
    return 3;
  }
  return 4;
}

export function personRelationPriority(relation: string): number {
  if (/(?:音乐|音樂|音效|音响|音響)/.test(relation)) {
    return 3;
  }
  if (/(?:角色设计|角色設計|人物设定|人物設定|作画|作畫)/.test(relation)) {
    return 2;
  }
  if (/(?:原作|导演|導演|监督|監督)/.test(relation)) {
    return 0;
  }
  if (/(?:系列构成|系列構成|脚本|編劇|编剧)/.test(relation)) {
    return 1;
  }
  if (/(?:制作|製作|出品)/.test(relation)) {
    return 4;
  }
  if (relation === "其他") {
    return 5;
  }
  return 6;
}

export const characterRelationOrder = ["主角", "配角", "客串", "其他"];

export const personRelationOrder = [
  "原作",
  "导演",
  "总导演",
  "副导演",
  "系列构成",
  "脚本",
  "分镜",
  "演出",
  "人物设定",
  "总作画监督",
  "作画监督",
  "原画",
  "音乐",
  "主题歌演出",
  "动画制作",
  "制作",
  "其他",
];

export function getRelationScore(relation: string, order: string[]): number {
  const index = order.indexOf(relation);
  return index === -1 ? order.length : index;
}

export function groupByRelation<T>(
  items: T[],
  order: string[],
  getKey?: (item: T) => string | undefined,
): Array<[string, T[]]> {
  const keyFn: (item: T) => string = getKey
    ? (item: T) => getKey(item) ?? "其他"
    : (item: T) => {
        const r = (item as { relation?: string }).relation;
        return r ?? "其他";
      };
  const groups = items.reduce<Record<string, T[]>>((acc, item) => {
    const relation = keyFn(item) ?? "其他";
    acc[relation] ??= [];
    acc[relation].push(item);
    return acc;
  }, {});
  return Object.entries(groups).sort(
    ([a], [b]) => getRelationScore(a, order) - getRelationScore(b, order),
  );
}

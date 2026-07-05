export const SITE_NAME = "Bangumi X";
export const SITE_DESCRIPTION = "Bangumi X - 番组计划数据浏览";

interface BuildMetaOpts {
  title: string;
  description?: string;
  noindex?: boolean;
}

export function buildMeta(opts: BuildMetaOpts) {
  return [
    { title: opts.title },
    { name: "description", content: opts.description ?? "" },
    ...(opts.noindex ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

import { EpTypeLabel, type Episode } from "../../types";

Component({
  properties: {
    episode: { type: Object, value: null as unknown as Record<string, unknown> },
  },
  data: {
    sort: 0,
    title: "",
    meta: "",
  },
  observers: {
    episode(ep: Episode | null) {
      if (!ep) {
        this.setData({ sort: 0, title: "", meta: "" });
        return;
      }
      const typeLabel =
        ep.type !== 0 ? (EpTypeLabel[ep.type as keyof typeof EpTypeLabel] ?? "") : "";
      const meta = [typeLabel, ep.airdate, ep.duration].filter(Boolean).join(" · ");
      this.setData({
        sort: ep.sort,
        title: ep.name_cn || ep.name,
        meta,
      });
    },
  },
});

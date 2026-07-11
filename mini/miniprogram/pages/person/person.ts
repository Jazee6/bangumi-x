import { getPerson, getPersonCharacters, getPersonSubjects } from "../../utils/api";
import { applyTheme, getCurrentDark, navigateToDetail } from "../../utils/page";
import { buildPersonShare, buildBrandShare } from "../../utils/share";
import { ICON_COPY_LIGHT, ICON_COPY_DARK } from "../../utils/icons";
import {
  BloodTypeLabel,
  CareerLabel,
  type PersonCareer,
  type PersonCharacter,
  type PersonDetail,
  type RelatedSubject,
} from "../../types";

interface SubjectItem {
  id: number;
  name: string;
  nameCn: string;
  image: string;
}
interface CharacterItem {
  id: number;
  title: string;
  description: string;
  image: string;
}

type Tab = 0 | 1;

Page({
  data: {
    dark: getCurrentDark(),
    loading: true,
    error: false,
    person: null as PersonDetail | null,
    careerLabel: "",
    bloodLabel: "",
    birthday: "",
    copyIcon: ICON_COPY_LIGHT,
    tabs: [
      { value: 0, label: "相关条目" },
      { value: 1, label: "相关角色" },
    ],
    activeTab: 0 as Tab,
    subjects: [] as SubjectItem[],
    subjectsLoading: false,
    subjectsLoaded: false,
    characters: [] as CharacterItem[],
    charactersLoading: false,
    charactersLoaded: false,
  },
  onLoad(query: { id?: string }) {
    const id = Number(query?.id ?? 0);
    if (!id) {
      this.setData({ loading: false, error: true });
      return;
    }
    this.loadData(id);
  },
  onShow() {
    applyTheme.call(this);
    this.setData({ copyIcon: getCurrentDark() ? ICON_COPY_DARK : ICON_COPY_LIGHT });
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  async loadData(id: number) {
    this.setData({ loading: true, error: false });
    try {
      const person = await getPerson(id);
      if (!person) {
        this.setData({ loading: false, error: true });
        return;
      }
      const careerLabel = (person.career ?? [])
        .map((c: PersonCareer) => CareerLabel[c] ?? c)
        .join("、");
      const bloodLabel = person.blood_type ? BloodTypeLabel[person.blood_type] ?? "" : "";
      const birthday = [person.birth_year && `${person.birth_year}年`, person.birth_mon && `${person.birth_mon}月`, person.birth_day && `${person.birth_day}日`].filter(Boolean).join("");
      this.setData({ person, careerLabel, bloodLabel, birthday, loading: false });
      this.loadSubjects(id);
    } catch {
      this.setData({ loading: false, error: true });
    }
  },
  async loadSubjects(id: number) {
    this.setData({ subjectsLoading: true });
    try {
      const subjects = await getPersonSubjects(id);
      this.setData({
        subjects: subjects.map((s: RelatedSubject) => ({
          id: s.id,
          name: s.name,
          nameCn: s.name_cn,
          image: s.image ?? "",
        })),
        subjectsLoading: false,
        subjectsLoaded: true,
      });
    } catch {
      this.setData({ subjectsLoading: false, subjectsLoaded: true });
    }
  },
  async loadCharacters(id: number) {
    this.setData({ charactersLoading: true });
    try {
      const characters = await getPersonCharacters(id);
      this.setData({
        characters: characters.map((c: PersonCharacter) => ({
          id: c.id,
          title: c.name,
          description: c.subject_name_cn || c.subject_name,
          image: c.images?.large || c.images?.medium || "",
        })),
        charactersLoading: false,
        charactersLoaded: true,
      });
    } catch {
      this.setData({ charactersLoading: false, charactersLoaded: true });
    }
  },
  onPickTab(e: WechatMiniprogram.TouchEvent) {
    const v = Number(e.currentTarget.dataset.value) as Tab;
    if (v === this.data.activeTab) return;
    this.setData({ activeTab: v });
    this.ensureTabLoaded(v);
  },
  onSwiperChange(e: { detail: { current: number } }) {
    const v = e.detail.current as Tab;
    this.setData({ activeTab: v });
    this.ensureTabLoaded(v);
  },
  ensureTabLoaded(tab: Tab) {
    const id = this.data.person?.id;
    if (!id) return;
    if (tab === 0 && !this.data.subjectsLoaded && !this.data.subjectsLoading) {
      this.loadSubjects(id);
    } else if (tab === 1 && !this.data.charactersLoaded && !this.data.charactersLoading) {
      this.loadCharacters(id);
    }
  },
  onRetry() {
    const p = this.data.person;
    if (p) this.loadData(p.id);
  },
  onTapSubject(e: WechatMiniprogram.TouchEvent) {
    navigateToDetail("subject", Number(e.currentTarget.dataset.id));
  },
  onTapCharacter(e: WechatMiniprogram.TouchEvent) {
    navigateToDetail("character", Number(e.currentTarget.dataset.id));
  },
  onCopyTitle() {
    const p = this.data.person;
    if (!p) return;
    wx.setClipboardData({
      data: p.name,
      success: () => wx.showToast({ title: "已复制", icon: "success" }),
    });
  },
  onShareAppMessage() {
    const p = this.data.person;
    if (!p) return buildBrandShare("index");
    return buildPersonShare(p);
  },
  onShareTimeline() {
    const p = this.data.person;
    if (!p) return buildBrandShare("index");
    return buildPersonShare(p);
  },
});

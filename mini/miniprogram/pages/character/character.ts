import { getCharacter, getCharacterPersons, getCharacterSubjects } from "../../utils/api";
import { applyTheme, getCurrentDark, navigateToDetail } from "../../utils/page";
import { BloodTypeLabel, CharacterTypeLabel, type Character, type CharacterPerson, type RelatedSubject } from "../../types";

interface SubjectItem {
  id: number;
  name: string;
  nameCn: string;
  image: string;
}
interface PersonItem {
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
    character: null as Character | null,
    typeLabel: "",
    bloodLabel: "",
    birthday: "",
    tabs: [
      { value: 0, label: "相关条目" },
      { value: 1, label: "相关人物" },
    ],
    activeTab: 0 as Tab,
    subjects: [] as SubjectItem[],
    subjectsLoading: false,
    subjectsLoaded: false,
    persons: [] as PersonItem[],
    personsLoading: false,
    personsLoaded: false,
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
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  async loadData(id: number) {
    this.setData({ loading: true, error: false });
    try {
      const character = await getCharacter(id);
      if (!character) {
        this.setData({ loading: false, error: true });
        return;
      }
      const typeLabel = character.type ? CharacterTypeLabel[character.type as keyof typeof CharacterTypeLabel] ?? "" : "";
      const bloodLabel = character.blood_type ? BloodTypeLabel[character.blood_type] ?? "" : "";
      const birthday = [character.birth_year && `${character.birth_year}年`, character.birth_mon && `${character.birth_mon}月`, character.birth_day && `${character.birth_day}日`].filter(Boolean).join("");
      this.setData({ character, typeLabel, bloodLabel, birthday, loading: false });
      this.loadSubjects(id);
    } catch {
      this.setData({ loading: false, error: true });
    }
  },
  async loadSubjects(id: number) {
    const subject = this.data.character;
    if (!subject) return;
    this.setData({ subjectsLoading: true });
    try {
      const subjects = await getCharacterSubjects(id);
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
  async loadPersons(id: number) {
    this.setData({ personsLoading: true });
    try {
      const persons = await getCharacterPersons(id);
      this.setData({
        persons: persons.map((p: CharacterPerson) => ({
          id: p.id,
          title: p.name,
          description: p.staff || p.subject_name_cn || p.subject_name,
          image: p.images?.large || p.images?.medium || "",
        })),
        personsLoading: false,
        personsLoaded: true,
      });
    } catch {
      this.setData({ personsLoading: false, personsLoaded: true });
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
    const id = this.data.character?.id;
    if (!id) return;
    if (tab === 0 && !this.data.subjectsLoaded && !this.data.subjectsLoading) {
      this.loadSubjects(id);
    } else if (tab === 1 && !this.data.personsLoaded && !this.data.personsLoading) {
      this.loadPersons(id);
    }
  },
  onRetry() {
    const c = this.data.character;
    if (c) this.loadData(c.id);
  },
  onTapSubject(e: WechatMiniprogram.TouchEvent) {
    navigateToDetail("subject", Number(e.currentTarget.dataset.id));
  },
  onTapPerson(e: WechatMiniprogram.TouchEvent) {
    navigateToDetail("person", Number(e.currentTarget.dataset.id));
  },
});

export enum SubjectType {
  Book = 1,
  Anime = 2,
  Music = 3,
  Game = 4,
  Real = 6,
}

export const SubjectTypeLabel: Record<SubjectType, string> = {
  [SubjectType.Book]: "书籍",
  [SubjectType.Anime]: "动画",
  [SubjectType.Music]: "音乐",
  [SubjectType.Game]: "游戏",
  [SubjectType.Real]: "三次元",
};

export enum EpType {
  MainStory = 0,
  SP = 1,
  OP = 2,
  ED = 3,
  PV = 4,
  MAD = 5,
  Other = 6,
}

export const EpTypeLabel: Record<EpType, string> = {
  [EpType.MainStory]: "本篇",
  [EpType.SP]: "特别篇",
  [EpType.OP]: "OP",
  [EpType.ED]: "ED",
  [EpType.PV]: "PV",
  [EpType.MAD]: "MAD",
  [EpType.Other]: "其他",
};

export enum CharacterType {
  Character = 1,
  Mechanic = 2,
  Ship = 3,
  Organization = 4,
}

export const CharacterTypeLabel: Record<CharacterType, string> = {
  [CharacterType.Character]: "角色",
  [CharacterType.Mechanic]: "机体",
  [CharacterType.Ship]: "舰船",
  [CharacterType.Organization]: "组织",
};

export enum PersonType {
  Individual = 1,
  Corporation = 2,
  Association = 3,
}

export enum BloodType {
  A = 1,
  B = 2,
  AB = 3,
  O = 4,
}

export const BloodTypeLabel: Record<BloodType, string> = {
  [BloodType.A]: "A",
  [BloodType.B]: "B",
  [BloodType.AB]: "AB",
  [BloodType.O]: "O",
};

export type PersonCareer =
  | "producer"
  | "mangaka"
  | "artist"
  | "seiyu"
  | "writer"
  | "illustrator"
  | "actor";

export const CareerLabel: Record<PersonCareer, string> = {
  producer: "制作人",
  mangaka: "漫画家",
  artist: "音乐人",
  seiyu: "声优",
  writer: "作家",
  illustrator: "绘师",
  actor: "演员",
};

export interface Images {
  large: string;
  common: string;
  medium: string;
  small: string;
  grid: string;
}

export interface PersonImages {
  large: string;
  medium: string;
  small: string;
  grid: string;
}

export interface Rating {
  rank: number;
  total: number;
  score: number;
  count: Record<number, number>;
}

export interface SubjectTag {
  name: string;
  count: number;
}

export interface PagedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface Subject {
  id: number;
  type: SubjectType;
  name: string;
  name_cn: string;
  summary: string;
  nsfw: boolean;
  date?: string;
  platform: string;
  images: Images;
  volumes: number;
  eps: number;
  total_episodes: number;
  rating: Rating;
  tags: SubjectTag[];
}

export interface LegacySubject {
  id: number;
  type: SubjectType;
  name: string;
  name_cn: string;
  summary: string;
  air_date: string;
  air_weekday: number;
  images: Images;
  eps: number;
  eps_count: number;
  rating?: {
    total: number;
    score: number;
    count: Record<number, number>;
  };
  rank: number;
}

export interface CalendarDay {
  weekday: {
    en: string;
    cn: string;
    ja: string;
    id: number;
  };
  items: LegacySubject[];
}

export interface Episode {
  id: number;
  type: EpType;
  name: string;
  name_cn: string;
  sort: number;
  ep?: number;
  airdate: string;
  comment: number;
  duration: string;
  desc: string;
  disc: number;
  duration_seconds?: number;
}

export interface Character {
  id: number;
  name: string;
  type: number;
  images?: PersonImages;
  summary: string;
  locked: boolean;
  gender?: string;
  blood_type?: BloodType;
  birth_year?: number;
  birth_mon?: number;
  birth_day?: number;
}

export interface Person {
  id: number;
  name: string;
  type: number;
  career: PersonCareer[];
  images?: PersonImages;
  short_summary: string;
  locked: boolean;
}

export interface PersonDetail extends Person {
  summary: string;
  gender?: string;
  blood_type?: BloodType;
  birth_year?: number;
  birth_mon?: number;
  birth_day?: number;
}

export interface RelatedCharacter {
  id: number;
  name: string;
  summary: string;
  type: number;
  images?: PersonImages;
  relation: string;
  actors: Person[];
}

export interface RelatedPerson {
  id: number;
  name: string;
  type: number;
  career: PersonCareer[];
  images?: PersonImages;
  relation: string;
  eps: string;
}

export interface RelatedSubject {
  id: number;
  type: SubjectType;
  staff: string;
  eps: string;
  name: string;
  name_cn: string;
  image?: string;
}

export interface CharacterPerson {
  id: number;
  name: string;
  type: number;
  images?: PersonImages;
  subject_id: number;
  subject_type: SubjectType;
  subject_name: string;
  subject_name_cn: string;
  staff?: string;
}

export interface PersonCharacter {
  id: number;
  name: string;
  type: number;
  images?: PersonImages;
  subject_id: number;
  subject_type: SubjectType;
  subject_name: string;
  subject_name_cn: string;
  staff?: string;
}

export type StudyDay = {
  dayOfWeek: number;
  theme: string;
  pageSlugs: string[];
  minutes: number;
  note: string;
};

export type WeeklyStudyProgram = {
  id: number;
  name: string;
  description: string | null;
  days: StudyDay[];
  displayOrder: number;
};

export type StudyProgramPage = {
  slug: string;
  title: string;
  section: string;
};

export type StudyProgramPayload = {
  name: string;
  description: string;
  days: StudyDay[];
  displayOrder: number;
};
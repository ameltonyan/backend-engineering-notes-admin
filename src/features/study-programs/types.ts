export type StudyDay = {
  dayOfWeek: number;
  theme: string;
  topicSlugs: string[];
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

export type StudyProgramTopic = {
  slug: string;
  title: string;
  category: string;
};

export type StudyProgramPayload = {
  name: string;
  description: string;
  days: StudyDay[];
  displayOrder: number;
};
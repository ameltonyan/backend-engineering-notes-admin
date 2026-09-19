import { apiRequest } from "../../services/apiClient";
import type { StudyProgramPayload, WeeklyStudyProgram } from "./types";

export const listStudyPrograms = () => apiRequest<WeeklyStudyProgram[]>("/api/study-programs");

export const saveStudyProgram = (programId: number | null, payload: StudyProgramPayload) =>
  apiRequest<WeeklyStudyProgram>(
    programId === null ? "/api/study-programs" : `/api/study-programs/${programId}`,
    { method: programId === null ? "POST" : "PUT", body: JSON.stringify(payload) },
  );

import { useState, type FormEvent } from "react";
import type { StudyDay, StudyProgramPage, StudyProgramPayload, WeeklyStudyProgram } from "./types";

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function defaultStudyDays(): StudyDay[] {
  return [
    ["Java", ""],
    ["Concurrency", ""],
    ["Spring", ""],
    ["Databases", ""],
    ["System design", ""],
    ["Review and mock interview", "Flexible catch-up or practice."],
    ["Reflect and plan", "Light review, notes, and next-week planning."],
  ].map(([theme, note], dayOfWeek) => ({
    dayOfWeek,
    theme,
    pageSlugs: [],
    minutes: dayOfWeek > 4 ? 45 : 90,
    note,
  }));
}

type Props = {
  pages: StudyProgramPage[];
  programs: WeeklyStudyProgram[];
  loading: boolean;
  onSave: (programId: number | null, payload: StudyProgramPayload) => Promise<void>;
  onClose: () => void;
};

function StudyProgramEditor({ pages, programs, loading, onSave, onClose }: Props) {
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [name, setName] = useState("Backend interview week");
  const [description, setDescription] = useState("Build interview confidence through focused practice, not passive reading.");
  const [days, setDays] = useState<StudyDay[]>(defaultStudyDays);

  const selectProgram = (program?: WeeklyStudyProgram) => {
    setEditingProgramId(program?.id ?? null);
    setName(program?.name ?? "Backend interview week");
    setDescription(program?.description ?? "Build interview confidence through focused practice, not passive reading.");
    setDays(program?.days ?? defaultStudyDays());
  };

  const updateDay = (dayIndex: number, update: Partial<StudyDay>) => {
    setDays((current) => current.map((day, index) => index === dayIndex ? { ...day, ...update } : day));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const displayOrder = editingProgramId === null
      ? programs.length
      : programs.find((program) => program.id === editingProgramId)?.displayOrder ?? 0;
    await onSave(editingProgramId, { name, description, days, displayOrder });
  };

  return (
    <section className="topic-plan" aria-label="Weekly study program editor">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Weekly study program</p>
          <h3>{editingProgramId ? "Edit published program" : "Create prepared program"}</h3>
          <span>Each day links to existing course pages. Learners track completion and weak points in their browser.</span>
        </div>
      </div>
      <form className="topic-plan-form" onSubmit={(event) => void submit(event)}>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
        <label>Description<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
        {days.map((day, dayIndex) => (
          <article className="topic-plan-candidate" key={day.dayOfWeek}>
            <div className="topic-plan-candidate-heading">
              <strong>{weekDays[day.dayOfWeek]}</strong>
              <label className="generated-edit-field">Minutes<input type="number" min={15} max={240} value={day.minutes} onChange={(event) => updateDay(dayIndex, { minutes: Number(event.target.value) })} /></label>
            </div>
            <label>Focus<input value={day.theme} onChange={(event) => updateDay(dayIndex, { theme: event.target.value })} required /></label>
            <label>Course pages<select multiple value={day.pageSlugs} onChange={(event) => updateDay(dayIndex, { pageSlugs: Array.from(event.target.selectedOptions, (option) => option.value) })}>{pages.map((page) => <option key={page.slug} value={page.slug}>{page.section} · {page.title}</option>)}</select><small className="field-hint">Select one or more existing pages.</small></label>
            <label>Guidance<textarea rows={2} value={day.note} onChange={(event) => updateDay(dayIndex, { note: event.target.value })} /></label>
          </article>
        ))}
        <div className="actions question-form-actions"><button className="primary" type="submit" disabled={loading}>Publish weekly program</button><button type="button" disabled={loading} onClick={onClose}>Cancel</button></div>
      </form>
      {programs.length > 0 && <div className="topic-plan-candidates"><h4>Published programs</h4>{programs.map((program) => <div className="actions" key={program.id}><span>{program.name}</span><button type="button" disabled={loading} onClick={() => selectProgram(program)}>Edit</button></div>)}</div>}
    </section>
  );
}

export default StudyProgramEditor;
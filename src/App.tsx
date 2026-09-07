import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import "./App.css";

type PageSummary = {
  slug: string;
  title: string;
  section: string;
  displayOrder: number;
};
type Section = {
  id: number;
  name: string;
  displayOrder: number;
};
type Question = {
  id: number;
  parentQuestionId: number | null;
  question: string;
  answer: string;
  displayOrder: number;
  depth: number;
};
type Page = PageSummary & { questions: Question[] };
type PageForm = {
  slug: string;
  title: string;
  section: string;
  displayOrder: number;
};
type QuestionForm = {
  question: string;
  answer: string;
  parentQuestionId: number | null;
  displayOrder: number;
};
type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
type QuestionType = "CONCEPTUAL" | "CODE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SCENARIO" | "INTERVIEW" | "TRICK";
type AiGenerationMode = "main" | "follow-up";
type GeneratedQuestion = { question: string; answer: string; difficulty: Difficulty; type: QuestionType };
type AiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
};
type DeleteConfirmation =
  | { type: "page"; title: string }
  | { type: "question"; id: number; title: string; childCount: number };
type ApiErrorPayload = { message?: string; detail?: string };

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8080"
).replace(/\/$/, "");
const credentialsKey = "backend-engineering-notes-admin:credentials";

function readCredentials() {
  return sessionStorage.getItem(credentialsKey) || "";
}

function generateSlug(section: string, title: string) {
  return `${section}-${title}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function questionKind(depth: number) {
  return depth === 0 ? "Main question" : depth === 1 ? "Follow-up" : "Deep follow-up";
}

function questionPreview(question: string) {
  return question.length > 96 ? `${question.slice(0, 93)}...` : question;
}

function descendantCount(questionId: number, questions: Question[]): number {
  const pending = [questionId];
  let count = 0;
  while (pending.length) {
    const parentId = pending.pop();
    const children = questions.filter((question) => question.parentQuestionId === parentId);
    count += children.length;
    pending.push(...children.map((child) => child.id));
  }
  return count;
}

async function request(
  path: string,
  options: RequestInit = {},
  credentials = readCredentials(),
  timeoutMs?: number,
) {
  let response: Response;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller?.abort(), timeoutMs)
    : undefined;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
      headers: {
        "Content-Type": "application/json",
        ...(credentials ? { Authorization: `Basic ${credentials}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(
        "The AI request took too long to respond. Try again or choose a lower reasoning effort.",
        408,
      );
    }
    throw new ApiRequestError(
      "The API is unavailable. Check that the backend is running and try again.",
      0,
    );
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401)
      throw new ApiRequestError("Invalid admin username or password.", 401);
    if (response.status === 403)
      throw new ApiRequestError("You do not have permission to perform this action.", 403);
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as ApiErrorPayload;
      message = parsed.message || parsed.detail || body;
    } catch {
      // Keep the plain response when the API does not return JSON.
    }
    if (response.status === 409 && !message)
      message = "This content has changed. Reload and try again.";
    throw new ApiRequestError(message || `Request failed (${response.status})`, response.status);
  }

  return response.status === 204 ? null : response.json();
}

function App() {
  const [credentials, setCredentials] = useState(readCredentials);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [pageForm, setPageForm] = useState<PageForm>({
    slug: "",
    title: "",
    section: "",
    displayOrder: 0,
  });
  const [questionForm, setQuestionForm] = useState<QuestionForm>({
    question: "",
    answer: "",
    parentQuestionId: null,
    displayOrder: 0,
  });
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [questionSearch, setQuestionSearch] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [questionFieldError, setQuestionFieldError] = useState("");
  const [pageFieldError, setPageFieldError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [aiIdea, setAiIdea] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("ADVANCED");
  const [aiType, setAiType] = useState<QuestionType>("INTERVIEW");
  const [aiCount, setAiCount] = useState(3);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [mergedQuestion, setMergedQuestion] = useState<GeneratedQuestion | null>(null);
  const [selectedGeneratedIndexes, setSelectedGeneratedIndexes] = useState<number[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerationMode, setAiGenerationMode] = useState<AiGenerationMode>("main");
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const aiPanelRef = useRef<HTMLElement | null>(null);

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : "Something went wrong. Please try again.";

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!deleteConfirmation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) setDeleteConfirmation(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteConfirmation, loading]);

  useEffect(() => {
    if (!isAiPanelOpen) return;

    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !aiPanelRef.current?.contains(event.target)) {
        setIsAiPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", closeWhenClickingOutside);
    return () => document.removeEventListener("mousedown", closeWhenClickingOutside);
  }, [isAiPanelOpen]);

  const sectionSuggestions = Array.from(
    new Set(sections.map((item) => item.name).filter(Boolean)),
  ).sort();

  const normalizedSearch = pageSearch.trim().toLowerCase();
  const visiblePages = pages.filter((item) =>
    [item.title, item.slug, item.section].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );

  const sectionOrder = new Map(
    sections.map((section, index) => [section.name, section.displayOrder ?? index]),
  );
  const pagesBySection = Array.from(
    visiblePages.reduce((groups, item) => {
      const section = item.section || "Other";
      const sectionPages = groups.get(section) ?? [];
      sectionPages.push(item);
      groups.set(section, sectionPages);
      return groups;
    }, new Map<string, PageSummary[]>()),
  ).sort(([leftSection, leftPages], [rightSection, rightPages]) => {
    const orderDifference =
      (sectionOrder.get(leftSection) ?? leftPages[0]?.displayOrder ?? 0) -
      (sectionOrder.get(rightSection) ?? rightPages[0]?.displayOrder ?? 0);
    return orderDifference || leftSection.localeCompare(rightSection);
  });

  const normalizedQuestionSearch = questionSearch.trim().toLowerCase();
  const orderedQuestions = [...(page?.questions ?? [])].sort(
    (left, right) => left.depth - right.depth || left.displayOrder - right.displayOrder || left.id - right.id,
  );
  const questionById = new Map(orderedQuestions.map((question) => [question.id, question]));
  const selectedQuestion = selectedQuestionId ? questionById.get(selectedQuestionId) : undefined;
  const selectedSiblings = selectedQuestion
    ? orderedQuestions.filter((question) => question.parentQuestionId === selectedQuestion.parentQuestionId)
    : [];
  const selectedSiblingIndex = selectedQuestion
    ? selectedSiblings.findIndex((question) => question.id === selectedQuestion.id)
    : -1;
  const matchesQuestionSearch = (question: Question) =>
    !normalizedQuestionSearch || [question.question, question.answer].some((value) =>
      value.toLowerCase().includes(normalizedQuestionSearch),
    );
  const hasVisibleQuestion = (question: Question): boolean =>
    matchesQuestionSearch(question) || orderedQuestions.some(
      (child) => child.parentQuestionId === question.id && hasVisibleQuestion(child),
    );
  const rootQuestions = orderedQuestions.filter((question) => question.parentQuestionId === null);

  const loadPages = async () => {
    const list = (await request("/api/admin/pages")) as PageSummary[];
    setPages(
      list.sort((left, right) => left.displayOrder - right.displayOrder),
    );
    if (!selectedSlug && list[0]) setSelectedSlug(list[0].slug);
  };

  const loadSections = async () => {
    const list = (await request("/api/admin/sections")) as Section[];
    setSections(list.sort((left, right) => left.displayOrder - right.displayOrder));
  };

  const getOrCreateSection = async (name: string) => {
    const existing = sections.find(
      (section) => section.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (existing) return existing;

    const created = (await request("/api/admin/sections", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), displayOrder: sections.length }),
    })) as Section;
    setSections((current) => [...current, created]);
    return created;
  };

  const loadPage = async (slug: string) => {
    setIsQuestionFormOpen(false);
    setEditingQuestionId(null);
    setSelectedQuestionId(null);
    setQuestionForm({ question: "", answer: "", parentQuestionId: null, displayOrder: 0 });
    const loaded = (await request(
      `/api/pages/${encodeURIComponent(slug)}`,
    )) as Page;
    setPage(loaded);
    setIsQuestionFormOpen(loaded.questions.length === 0);
    setPageForm({
      slug: loaded.slug,
      title: loaded.title,
      section: loaded.section,
      displayOrder: loaded.displayOrder,
    });
  };

  useEffect(() => {
    if (!credentials) return;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadPages(), loadSections()]);
      } catch (err: unknown) {
        if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
          sessionStorage.removeItem(credentialsKey);
          setCredentials("");
        }
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void loadInitialData();
  }, [credentials]);

  useEffect(() => {
    if (!credentials || !selectedSlug) return;
    const loadSelectedPage = async () => {
      try {
        await loadPage(selectedSlug);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    };
    void loadSelectedPage();
  }, [credentials, selectedSlug]);

  const startQuestionCreation = (parentId: number | null) => {
    if (parentId !== null && !questionById.has(parentId)) {
      setError("Select a question before creating a follow-up.");
      return;
    }
    const siblingOrder = Math.max(
      -1,
      ...orderedQuestions
        .filter((question) => question.parentQuestionId === parentId)
        .map((question) => question.displayOrder),
    ) + 1;
    setError("");
    setNotice("");
    if (parentId === null) setAiGenerationMode("main");
    setSelectedQuestionId(parentId);
    setEditingQuestionId(null);
    setQuestionForm({
      question: "",
      answer: "",
      parentQuestionId: parentId,
      displayOrder: siblingOrder,
    });
    setIsQuestionFormOpen(true);
    setQuestionFieldError("");
    window.requestAnimationFrame(() => {
      document.getElementById("question-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("question-input")?.focus();
    });
  };

  const openQuestionEditor = (question: Question) => {
    setSelectedQuestionId(question.id);
    setEditingQuestionId(question.id);
    setIsQuestionFormOpen(true);
    setQuestionForm({
      question: question.question,
      answer: question.answer,
      parentQuestionId: question.parentQuestionId,
      displayOrder: question.displayOrder,
    });
    setQuestionFieldError("");
    window.requestAnimationFrame(() => {
      document.getElementById("question-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("question-input")?.focus();
    });
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const focusAiGeneration = (mode: AiGenerationMode = "main") => {
    setAiGenerationMode(mode);
    setIsAiPanelOpen(true);
    setIsQuestionFormOpen(false);
    setEditingQuestionId(null);
    window.requestAnimationFrame(() => {
      scrollToSection("ai-assist");
      document.getElementById("ai-idea")?.focus();
    });
  };

  const renderQuestionNode = (question: Question, siblingIndex = 0): ReactNode => {
    if (!hasVisibleQuestion(question)) return null;
    const children = orderedQuestions.filter((candidate) => candidate.parentQuestionId === question.id);
    const isExpanded = expandedQuestions[question.id] !== false;
    const isSelected = selectedQuestionId === question.id;
    const childNodes = children.map((child, index) => renderQuestionNode(child, index));

    return (
      <article id={`question-node-${question.id}`} className={`tree-node depth-${Math.min(question.depth, 5)}${isSelected ? " selected" : ""}`} key={question.id}>
        <div className="tree-node-row">
          <button
            className="tree-node-toggle"
            type="button"
            aria-expanded={children.length ? isExpanded : undefined}
            aria-label={children.length ? `${isExpanded ? "Collapse" : "Expand"} ${question.question}` : question.question}
            onClick={() => {
              if (isSelected) {
                setSelectedQuestionId(null);
                setIsQuestionFormOpen(false);
                setEditingQuestionId(null);
                setIsAiPanelOpen(false);
                return;
              }
              setIsQuestionFormOpen(false);
              setEditingQuestionId(null);
              setIsAiPanelOpen(false);
              setSelectedQuestionId(question.id);
              setAiGenerationMode(question.depth === 0 ? "main" : "follow-up");
              if (children.length) {
                setExpandedQuestions((current) => ({ ...current, [question.id]: !isExpanded }));
              }
            }}
          >
            <span className="tree-branch" aria-hidden="true">{children.length ? (isExpanded ? "▾" : "▸") : "·"}</span>
            {question.depth === 0 && <span className="question-number" aria-label={`Main question ${siblingIndex + 1}`}>{siblingIndex + 1}</span>}
            <span className="tree-node-copy">
              <strong>{question.question}</strong>
              <span className="tree-meta">
                {questionKind(question.depth)}
              </span>
            </span>
          </button>
        </div>
        {isSelected && (
          <section className="selected-question-card" aria-label={`Selected ${questionKind(question.depth).toLowerCase()}`}>
            <div className="selected-question-context">
              <span>{questionKind(question.depth)} · Level {question.depth}</span>
              <span>Order {question.displayOrder + 1} of {selectedSiblings.length}</span>
            </div>
            <button
              className="answer-disclosure"
              type="button"
              aria-expanded={Boolean(revealedAnswers[question.id])}
              onClick={() => setRevealedAnswers((current) => ({ ...current, [question.id]: !current[question.id] }))}
            >
              {revealedAnswers[question.id] ? "Hide reference answer" : "Show reference answer"}
            </button>
            {revealedAnswers[question.id] && <p className="inline-answer">{question.answer}</p>}
            <div className="selected-question-actions" aria-label="Question actions">
              <div className="order-actions" aria-label="Change question order">
                <button type="button" aria-label="Move question up" title={selectedSiblingIndex > 0 ? "Move up" : "Already first in this group"} disabled={selectedSiblingIndex <= 0} onClick={() => moveQuestion(question.id, -1)}>↑</button>
                <button type="button" aria-label="Move question down" title={selectedSiblingIndex < selectedSiblings.length - 1 ? "Move down" : "Already last in this group"} disabled={selectedSiblingIndex < 0 || selectedSiblingIndex >= selectedSiblings.length - 1} onClick={() => moveQuestion(question.id, 1)}>↓</button>
              </div>
              <button type="button" title="Edit question" onClick={() => openQuestionEditor(question)}>Edit</button>
              <button type="button" title="Add a follow-up question" onClick={() => startQuestionCreation(question.id)}>+ Follow-up</button>
              <button className="primary" type="button" onClick={() => focusAiGeneration("follow-up")}>Generate follow-ups with AI</button>
              <button className="danger" type="button" title="Delete question and its follow-ups" onClick={() => setDeleteConfirmation({ type: "question", id: question.id, title: question.question, childCount: descendantCount(question.id, orderedQuestions) })}>Delete</button>
            </div>
          </section>
        )}
        {isExpanded && childNodes.length > 0 && <div className="tree-children">{childNodes}</div>}
      </article>
    );
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const encoded = btoa(`${username}:${password}`);
    try {
      await request("/api/admin/pages", {}, encoded);
      sessionStorage.setItem(credentialsKey, encoded);
      setCredentials(encoded);
      setPassword("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handlePageSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setPageFieldError("");
    if (!pageForm.section.trim() || !pageForm.title.trim() || !pageForm.slug.trim()) {
      setPageFieldError("Section, title, and slug are required.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageForm.slug.trim())) {
      setPageFieldError("Slug must contain lowercase letters, numbers, and hyphens only.");
      return;
    }
    setLoading(true);
    try {
      const isNew = !page;
      if (isNew && pages.some((item) => item.slug === pageForm.slug.trim())) {
        throw new Error(
          "This slug already exists. Use a new slug, such as java-collections.",
        );
      }
      const section = await getOrCreateSection(pageForm.section);
      const payload = isNew
        ? {
            slug: pageForm.slug.trim(),
            title: pageForm.title.trim(),
            sectionId: section.id,
            displayOrder: pageForm.displayOrder,
          }
        : {
            title: pageForm.title.trim(),
            sectionId: section.id,
            displayOrder: pageForm.displayOrder,
          };
      const result = (await request(
        isNew
          ? "/api/admin/pages"
          : `/api/admin/pages/${encodeURIComponent(page.slug)}`,
        {
          method: isNew ? "POST" : "PUT",
          body: JSON.stringify(payload),
        },
      )) as Page;
      setNotice(isNew ? "Page created" : "Page updated");
      await loadPages();
      setSelectedSlug(result.slug);
      await loadPage(result.slug);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!page) return;
    setError("");
    setNotice("");
    setQuestionFieldError("");
    if (!questionForm.question.trim() || !questionForm.answer.trim()) {
      setQuestionFieldError("Question and answer are required.");
      return;
    }
    setLoading(true);
    try {
      const path = editingQuestionId
        ? `/api/admin/questions/${editingQuestionId}`
        : `/api/admin/pages/${encodeURIComponent(page.slug)}/questions`;
      const savedQuestion = (await request(path, {
        method: editingQuestionId ? "PUT" : "POST",
        body: JSON.stringify({
          ...questionForm,
          question: questionForm.question.trim(),
          answer: questionForm.answer.trim(),
        }),
      })) as Question;
      const wasEditing = editingQuestionId !== null;
      setQuestionForm({ question: "", answer: "", parentQuestionId: null, displayOrder: 0 });
      setEditingQuestionId(null);
      setIsQuestionFormOpen(false);
      setGeneratedQuestions([]);
      setMergedQuestion(null);
      setSelectedGeneratedIndexes([]);
      await loadPage(page.slug);
      setSelectedQuestionId(savedQuestion.id);
      window.requestAnimationFrame(() => {
        document.getElementById(`question-node-${savedQuestion.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      setNotice(wasEditing ? "Question updated" : "Question added and selected");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!aiIdea.trim()) {
      setError("Add an idea before generating questions.");
      return;
    }
    if (aiGenerationMode === "follow-up" && !selectedQuestion) {
      setError("Select a parent question before generating follow-ups.");
      return;
    }
    setAiLoading(true);
    try {
      const generationContext = aiGenerationMode === "follow-up" && selectedQuestion
        ? `Generate follow-up questions for this existing interview question in ${page?.section} / ${page?.title}: "${selectedQuestion.question}". Its current answer is: "${selectedQuestion.answer}". These drafts will be saved beneath that question and should naturally deepen or challenge it.`
        : `Generate main/root interview questions for the topic and section ${page?.section} / ${page?.title}: "${aiIdea.trim()}". These drafts will not have a parent.`;
      const editingContext = selectedQuestion && editingQuestionId !== null
        ? `Improve this existing interview question in ${page?.section} / ${page?.title}: "${selectedQuestion.question}". Its current answer is: "${selectedQuestion.answer}". Return stronger alternative versions that preserve the intent and technical accuracy. These drafts will replace the current question only after admin review.`
        : generationContext;
      const result = (await request("/api/admin/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          idea: `${aiIdea.trim()}\n\n${editingContext}`,
          difficulty: aiDifficulty,
          type: aiType,
          count: aiCount,
        }),
      }, undefined, 180_000)) as { questions: GeneratedQuestion[]; usage?: AiUsage };
      setGeneratedQuestions(result.questions);
      setMergedQuestion(null);
      setSelectedGeneratedIndexes([]);
      setAiUsage(result.usage ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const editGeneratedQuestion = (generated: GeneratedQuestion) => {
    const parentId = aiGenerationMode === "follow-up" ? selectedQuestion?.id ?? null : null;
    const editingExistingQuestion = editingQuestionId !== null && selectedQuestion;
    const siblingOrder = Math.max(
      -1,
      ...orderedQuestions
        .filter((question) => question.parentQuestionId === parentId)
        .map((question) => question.displayOrder),
    ) + 1;
    setQuestionForm({
      question: generated.question,
      answer: generated.answer,
      parentQuestionId: editingExistingQuestion ? selectedQuestion.parentQuestionId : parentId,
      displayOrder: editingExistingQuestion ? selectedQuestion.displayOrder : siblingOrder,
    });
    setEditingQuestionId(editingExistingQuestion ? selectedQuestion.id : null);
    setIsQuestionFormOpen(true);
    setSelectedGeneratedIndexes([]);
    setQuestionFieldError("");
    window.requestAnimationFrame(() => {
      document.getElementById("question-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("question-input")?.focus();
    });
  };

  const mergeSelectedQuestions = async () => {
    if (selectedGeneratedIndexes.length !== 2) {
      setError("Select exactly two generated questions to merge.");
      return;
    }
    setError("");
    setAiLoading(true);
    try {
      const result = (await request("/api/admin/ai/questions/merge", {
        method: "POST",
        body: JSON.stringify({
          questions: selectedGeneratedIndexes.map((index) => generatedQuestions[index]),
        }),
      }, undefined, 180_000)) as { questions: GeneratedQuestion[]; usage?: AiUsage };
      setMergedQuestion(result.questions[0] ?? null);
      setSelectedGeneratedIndexes([]);
      setAiUsage(result.usage ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const deleteQuestion = async (questionId: number) => {
    if (!page) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      await loadPage(page.slug);
      setDeleteConfirmation(null);
      setNotice("Question deleted");
    } catch (err) {
      setDeleteConfirmation(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const moveQuestion = async (questionId: number, direction: -1 | 1) => {
    if (!page) return;
    const question = questionById.get(questionId);
    if (!question) return;
    const siblings = orderedQuestions.filter((item) => item.parentQuestionId === question.parentQuestionId);
    const currentIndex = siblings.findIndex((item) => item.id === questionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;

    const reorderedSiblings = [...siblings];
    const [movedQuestion] = reorderedSiblings.splice(currentIndex, 1);
    reorderedSiblings.splice(targetIndex, 0, movedQuestion);
    const siblingIds = new Set(siblings.map((item) => item.id));
    const reorderedQuestionIds = [
      ...reorderedSiblings.map((item) => item.id),
      ...orderedQuestions.filter((item) => !siblingIds.has(item.id)).map((item) => item.id),
    ];
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/pages/${encodeURIComponent(page.slug)}/questions/order`, {
        method: "PUT",
        body: JSON.stringify({ questionIds: reorderedQuestionIds }),
      });
      await loadPage(page.slug);
      setNotice("Question order saved");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const deletePage = async () => {
    if (!page) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/pages/${encodeURIComponent(page.slug)}`, {
        method: "DELETE",
      });
      setPage(null);
      setSelectedSlug("");
      setDeleteConfirmation(null);
      setNotice("Page deleted");
      await loadPages();
    } catch (err) {
      setDeleteConfirmation(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!credentials) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <p className="eyebrow">Backend Engineering Notes · Admin</p>
          <h1>Interview content system</h1>
          <p className="muted">
            Sign in to manage the notes published by the public site.
          </p>
          <form onSubmit={handleLogin}>
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary" type="submit">
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Backend Engineering Notes</p>
          <h1>Content control room</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(credentialsKey);
            setCredentials("");
          }}
        >
          Sign out
        </button>
      </header>
      <div className="workspace">
        <aside className="page-list">
          <nav className="primary-nav" aria-label="Primary navigation">
            <p className="nav-label">Workspace</p>
            <button className="nav-item active" type="button" onClick={() => scrollToSection("content-library")}>
              <span aria-hidden="true">◈</span> Content library
            </button>
            <button className="nav-item" type="button" onClick={() => focusAiGeneration("main")}>
              <span aria-hidden="true">✦</span> AI generation
            </button>
            <div className="nav-item nav-item-planned" title="Interview paths are not available yet">
              <span aria-hidden="true">↗</span> Interview paths
              <small>Soon</small>
            </div>
            <div className="nav-item nav-item-planned" title="Settings are not available yet">
              <span aria-hidden="true">⚙</span> Settings
              <small>Soon</small>
            </div>
          </nav>
          <div className="list-heading">
            <div className="topic-list-title">
              <h2>Topics &amp; sections</h2>
              <span className="list-count">{pages.length} total</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPage(null);
                setSelectedSlug("");
                setSlugWasEdited(false);
                setPageForm({
                  slug: "",
                  title: "",
                  section: "",
                  displayOrder: pages.length,
                });
              }}
            >
              New page
            </button>
          </div>
          <label className="search-field">
            <span>Find a page</span>
            <input
              type="search"
              value={pageSearch}
              onChange={(event) => setPageSearch(event.target.value)}
              placeholder="Title, slug, or section"
            />
          </label>
          {pagesBySection.map(([section, sectionPages]) => (
            <div className="page-section-group" key={section}>
              <button
                className="section-toggle"
                type="button"
                aria-expanded={!collapsedSections[section]}
                onClick={() =>
                  setCollapsedSections((current) => ({
                    ...current,
                    [section]: !current[section],
                  }))
                }
              >
                <span className="page-section-title">{section}</span>
                <span className="section-count">{sectionPages.length}</span>
              </button>
              {!collapsedSections[section] &&
                sectionPages.map((item) => (
                  <button
                    className={
                      item.slug === selectedSlug ? "page-item active" : "page-item"
                    }
                    key={item.slug}
                    type="button"
                    onClick={() => setSelectedSlug(item.slug)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.slug}</span>
                  </button>
                ))}
            </div>
          ))}
          {!pages.length && <p className="muted">No pages yet.</p>}
          {pages.length > 0 && !pagesBySection.length && (
            <p className="muted">No pages match your search.</p>
          )}
        </aside>
        <section className="editor" id="content-library">
          {(error || notice) && (
            <div
              className={error ? "status-banner error-banner" : "status-banner notice-banner"}
              role={error ? "alert" : "status"}
              aria-live="polite"
            >
              <span>{error || notice}</span>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                Close
              </button>
            </div>
          )}
          <div className="editor-heading">
            <div>
              <p className="eyebrow">{page ? "Editing page" : "New page"}</p>
              <h2>{page?.title ?? "Create your first page"}</h2>
            </div>
            {page && (
              <button
                className="danger"
                type="button"
                onClick={() => setDeleteConfirmation({ type: "page", title: page.title })}
              >
                Delete page
              </button>
            )}
          </div>
          <form className="page-form" onSubmit={handlePageSubmit}>
            <div className="form-fields">
              <label>
                <span className="field-label">
                  Section <span className="label-note">(suggestions available)</span>
                </span>
                <input
                  value={pageForm.section}
                  list="section-suggestions"
                  onChange={(event) => {
                    setPageFieldError("");
                    setPageForm({
                      ...pageForm,
                      section: event.target.value,
                      ...(page || slugWasEdited
                        ? {}
                        : { slug: generateSlug(event.target.value, pageForm.title) }),
                    });
                  }}
                  required
                />
                <datalist id="section-suggestions">
                  {sectionSuggestions.map((section) => (
                    <option key={section} value={section} />
                  ))}
                </datalist>
                <small className="field-hint">
                  Choose an existing section or type a new one.
                </small>
                {pageFieldError && <small className="field-error">{pageFieldError}</small>}
              </label>
              <label>
                Title
                <input
                  value={pageForm.title}
                  onChange={(event) => {
                    setPageFieldError("");
                    setPageForm({
                      ...pageForm,
                      title: event.target.value,
                      ...(page || slugWasEdited
                        ? {}
                        : { slug: generateSlug(pageForm.section, event.target.value) }),
                    });
                  }}
                  required
                />
              </label>
              <label>
                Slug
                <input
                  value={pageForm.slug}
                  disabled={Boolean(page)}
                  onChange={(event) => {
                    setPageFieldError("");
                    setSlugWasEdited(true);
                    setPageForm({ ...pageForm, slug: event.target.value });
                  }}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
                <small className="field-hint">
                  Suggested from section and title. You can edit it, but it must be unique and URL-safe.
                </small>
              </label>
              <label>
                Order
                <input
                  type="number"
                  min="0"
                  value={pageForm.displayOrder}
                  onChange={(event) =>
                    setPageForm({
                      ...pageForm,
                      displayOrder: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary" type="submit">
                {page ? "Save page" : "Create page"}
              </button>
            </div>
          </form>
          {page && (
            <>
              <div className="interview-heading">
                <div>
                  <p className="eyebrow">Interview path</p>
                  <h3>Question hierarchy</h3>
                  <span className="interview-context">{page.section} / {page.title} · {page.questions.length} questions · select a node to set the working context</span>
                </div>
                <div className="question-actions">
                  <button className="primary" type="button" onClick={() => focusAiGeneration("main")}>
                    Generate main questions with AI
                  </button>
                  <button className="secondary" type="button" onClick={() => startQuestionCreation(null)}>
                    Main question
                  </button>
                </div>
              </div>
              <label className="search-field question-search">
                <span>Find a question</span>
                <input
                  type="search"
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder="Search questions and answers"
                />
              </label>
              <div className={`question-workspace${isQuestionFormOpen ? " editing" : ""}`}>
                <div className="question-tree" aria-label="Interview question hierarchy">
                  {rootQuestions.map((question, index) => renderQuestionNode(question, index))}
                  {!rootQuestions.some(hasVisibleQuestion) && (
                    <p className="muted">{page.questions.length ? "No questions match your search." : "No questions yet. Start with a main question."}</p>
                  )}
                </div>
                {isQuestionFormOpen && (
                  <form className="question-form" id="question-editor" onSubmit={handleQuestionSubmit}>
                  <div className="question-form-heading">
                    <div>
                      <p className="eyebrow">{editingQuestionId ? "Editing saved question" : "Draft interview question"}</p>
                      <h3>{editingQuestionId ? "Edit question" : questionForm.parentQuestionId ? "Add follow-up" : "Add main question"}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuestionFormOpen(false);
                        setEditingQuestionId(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <label>
                    Question
                    <input
                      id="question-input"
                      value={questionForm.question}
                      onChange={(event) => {
                        setQuestionFieldError("");
                        setQuestionForm({
                          ...questionForm,
                          question: event.target.value,
                        });
                      }}
                      required
                    />
                    {questionFieldError && <small className="field-error">{questionFieldError}</small>}
                  </label>
                  <label>
                    Answer
                    <textarea
                      rows={8}
                      value={questionForm.answer}
                      onChange={(event) => {
                        setQuestionFieldError("");
                        setQuestionForm({
                          ...questionForm,
                          answer: event.target.value,
                        });
                      }}
                      required
                    />
                  </label>
                  <label>
                    Order
                    <input
                      type="number"
                      min="0"
                      value={questionForm.displayOrder}
                      onChange={(event) =>
                        setQuestionForm({
                          ...questionForm,
                          displayOrder: Number(event.target.value),
                        })
                      }
                      required
                    />
                  </label>
                  <div className="actions">
                    <button className="primary" type="submit">
                      {editingQuestionId ? "Save question" : "Add question"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuestionFormOpen(false);
                        setEditingQuestionId(null);
                        setQuestionForm({
                          question: "",
                          answer: "",
                          parentQuestionId: null,
                          displayOrder: 0,
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  </form>
                )}
              </div>
              {isAiPanelOpen && (
              <section
                ref={aiPanelRef}
                className={`ai-assist${isQuestionFormOpen ? " ai-assist-open" : ""}`}
                id="ai-assist"
              >
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">AI assist</p>
                    <h3>{selectedQuestion && editingQuestionId !== null ? "Improve this question with AI" : aiGenerationMode === "follow-up" ? "Generate follow-up candidates" : "Generate main-question candidates"}</h3>
                    <span>{selectedQuestion && editingQuestionId !== null ? `Review alternatives for: “${questionPreview(selectedQuestion.question)}”` : aiGenerationMode === "follow-up" && selectedQuestion ? `For: “${questionPreview(selectedQuestion.question)}” · candidates will be added beneath it` : "Candidates will be created as main questions"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAiPanelOpen(false);
                      setGeneratedQuestions([]);
                      setMergedQuestion(null);
                      setSelectedGeneratedIndexes([]);
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <form className="ai-form" onSubmit={generateQuestions}>
                  <label>
                    Idea
                    <textarea
                      rows={3}
                      id="ai-idea"
                      value={aiIdea}
                      onChange={(event) => setAiIdea(event.target.value)}
                      placeholder={selectedQuestion ? "What should the interviewer probe next?" : "LongAdder and contention in Java concurrency"}
                    />
                  </label>
                  <div className="ai-fields">
                    <label>
                      Difficulty
                      <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as Difficulty)}>
                        <option value="BEGINNER">Beginner</option>
                        <option value="INTERMEDIATE">Intermediate</option>
                        <option value="ADVANCED">Advanced</option>
                        <option value="EXPERT">Expert</option>
                      </select>
                    </label>
                    <label>
                      Type
                      <select value={aiType} onChange={(event) => setAiType(event.target.value as QuestionType)}>
                        <option value="CONCEPTUAL">Conceptual</option>
                        <option value="CODE">Code</option>
                        <option value="MULTIPLE_CHOICE">Multiple choice</option>
                        <option value="TRUE_FALSE">True / false</option>
                        <option value="SCENARIO">Scenario</option>
                        <option value="INTERVIEW">Interview</option>
                        <option value="TRICK">Trick question</option>
                      </select>
                    </label>
                    <label>
                      Options
                      <select value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))}>
                        <option value={1}>1</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                      </select>
                    </label>
                  </div>
                  <div className="actions">
                    <button className="primary" type="submit" disabled={aiLoading}>
                      {aiLoading ? "Generating..." : selectedQuestion && editingQuestionId !== null ? "Generate improvements with AI" : aiGenerationMode === "follow-up" ? "Generate follow-ups with AI" : "Generate main questions with AI"}
                    </button>
                  </div>
                </form>
                {generatedQuestions.length > 0 && (
                  <div className="generated-questions">
                    <div className="generated-heading">
                      <h4>Generated questions</h4>
                      {aiUsage?.totalTokens !== undefined && (
                        <span className="field-hint">Last call: {aiUsage.totalTokens} tokens</span>
                      )}
                    </div>
                    <p className="field-hint">Choose a candidate to load it into the editor. Review it there, then save the question.</p>
                    {generatedQuestions.map((generated, index) => (
                      <article className="generated-question" key={`${generated.question}-${index}`}>
                        <label className="generated-select">
                          <input
                            type="checkbox"
                            checked={selectedGeneratedIndexes.includes(index)}
                            onChange={() =>
                              setSelectedGeneratedIndexes((current) =>
                                current.includes(index)
                                  ? current.filter((item) => item !== index)
                                  : current.length < 2 ? [...current, index] : current,
                              )
                            }
                          />
                          <span className="eyebrow">Option {index + 1}</span>
                        </label>
                        <strong>{generated.question}</strong>
                        <span className="candidate-meta">{generated.difficulty} · {generated.type} · {selectedQuestion ? `Level ${selectedQuestion.depth + 1}` : "Main question · Level 0"}</span>
                        <p>{generated.answer}</p>
                        <div className="actions">
                          <button className="primary" type="button" onClick={() => editGeneratedQuestion(generated)}>
                            Use in editor
                          </button>
                        </div>
                      </article>
                    ))}
                    {mergedQuestion && (
                      <article className="generated-question merged-question">
                        <span className="eyebrow">AI merged response</span>
                        <strong>{mergedQuestion.question}</strong>
                        <p>{mergedQuestion.answer}</p>
                        <div className="actions">
                          <button className="primary" type="button" onClick={() => editGeneratedQuestion(mergedQuestion)}>
                            Use in editor
                          </button>
                        </div>
                      </article>
                    )}
                    <div className="actions generated-actions">
                      <button type="button" onClick={mergeSelectedQuestions} disabled={aiLoading || selectedGeneratedIndexes.length !== 2}>
                        {aiLoading ? "Merging..." : "Merge selected"}
                      </button>
                      <button
                        className="primary"
                        type="button"
                        disabled={selectedGeneratedIndexes.length !== 1}
                        onClick={() => editGeneratedQuestion(generatedQuestions[selectedGeneratedIndexes[0]])}
                      >
                        Use selected in editor
                      </button>
                    </div>
                  </div>
                )}
              </section>
              )}
            </>
          )}
          {loading && <p className="muted">Saving...</p>}
        </section>
      </div>
      {deleteConfirmation && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            aria-describedby="delete-confirmation-description"
          >
            <p className="eyebrow">Confirm deletion</p>
            <h2 id="delete-confirmation-title">
              Delete {deleteConfirmation.type === "page" ? "page" : "question"}?
            </h2>
            <p id="delete-confirmation-description">
              <strong>{deleteConfirmation.title}</strong> will be permanently removed.
              {deleteConfirmation.type === "question" && deleteConfirmation.childCount > 0
                ? ` This question has ${deleteConfirmation.childCount} follow-up${deleteConfirmation.childCount === 1 ? "" : "s"}; the API will delete the entire subtree. `
                : " "}
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteConfirmation(null)}
              >
                Cancel
              </button>
              <button
                className="danger danger-button"
                type="button"
                disabled={loading}
                onClick={() =>
                  deleteConfirmation.type === "page"
                    ? deletePage()
                    : deleteQuestion(deleteConfirmation.id)
                }
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;

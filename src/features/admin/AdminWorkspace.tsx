import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import AiLoadingOverlay from "../../components/AiLoadingOverlay";
import DeleteConfirmationDialog, { type DeleteConfirmation } from "../../components/DeleteConfirmationDialog";
import StatusBanner from "../../components/StatusBanner";
import LoginPage from "../auth/LoginPage";
import { clearCredentials, readCredentials, saveCredentials } from "../auth/authStorage";
import ContentLibrary from "../content/ContentLibrary";
import CategoryCreateDialog from "../content/CategoryCreateDialog";
import { getTopic, listTopics, listCategories } from "../content/contentApi";
import { generateSlug } from "../content/contentUtils";
import type { GeneratedTopicProposal, Topic, TopicForm, TopicSummary, Question, QuestionForm, QuestionStatus, Category } from "../content/types";
import { questionPreview } from "../questions/questionUtils";
import QuestionStatusSelector from "../questions/components/QuestionStatusSelector";
import QuestionTree from "../questions/components/QuestionTree";
import { QUESTION_STATUS_OPTIONS } from "../questions/questionStatus";
import type { AiGenerationMetadata, AiGenerationMode, AiUsage, AnswerImprovement, Difficulty, GeneratedQuestion, GeneratedQuestionDraft, GeneratedQuestionsResult, QuestionType } from "../questions/types";
import StudyProgramEditor from "../study-programs/StudyProgramEditor";
import AiProviderSelector from "../settings/AiProviderSelector";
import { listStudyPrograms, saveStudyProgram as persistStudyProgram } from "../study-programs/studyProgramsApi";
import type { StudyProgramPayload, WeeklyStudyProgram } from "../study-programs/types";
import { ApiRequestError, apiRequest as request } from "../../services/apiClient";
import "../../App.css";

const collapsedCategoriesKey = "backend-engineering-notes-admin:collapsed-categories";
const difficultyStorageKey = "backend-engineering-notes-admin:difficulty";
const maxBatchQuestionCount = 10;

const readDifficulty = (): Difficulty => {
  const stored = localStorage.getItem(difficultyStorageKey);
  return stored === "BEGINNER" || stored === "INTERMEDIATE" || stored === "EXPERT" ? stored : "ADVANCED";
};
const defaultAnswerImprovement: AnswerImprovement = {
  criteria: "",
  humanized: false,
  shortened: false,
  simplified: false,
};
type DetailGenerationMode = "EXAMPLE_AND_CODE" | "EXAMPLE_ONLY" | "CODE_ONLY";
const detailGenerationModes: { value: DetailGenerationMode; label: string }[] = [
  { value: "EXAMPLE_AND_CODE", label: "Example + code" },
  { value: "EXAMPLE_ONLY", label: "Example only" },
  { value: "CODE_ONLY", label: "Code only" },
];
const aiLoadingMessages = [
  "Consulting the silicon oracle.",
  "Teaching the model the difference between a plan and a pile of topics.",
  "Negotiating with several billion parameters.",
  "Checking whether the answer is insightful or merely confident.",
  "Almost done. The machine is having a small existential crisis.",
  "Sorting useful interview questions from impressive-sounding noise.",
  "Looking for the trade-off hiding behind the obvious answer.",
  "Turning backend concepts into questions a real interviewer might ask.",
  "Checking that the answers sound spoken, not copied from a glossary.",
  "Reviewing failure modes, edge cases, and production consequences.",
  "Making sure the questions do not all wear the same disguise.",
  "Comparing the new ideas with the questions already in this category.",
  "Removing duplicate concepts before they reach your question tree.",
  "Asking the model to be specific, practical, and technically honest.",
  "Polishing the difference between knowing a term and reasoning about it.",
  "Checking whether a senior engineer could answer this under pressure.",
  "Giving the generated answers a conversational final pass.",
  "Balancing coverage, difficulty, and questions worth discussing.",
  "One more pass for clarity and useful production detail.",
  "The request is taking its thoughtful route through the model.",
];

const parseTags = (value: string) => [...new Set(value.split(",")
  .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
  .filter(Boolean))].slice(0, 8);

function readCollapsedCategories(): Record<string, boolean> {
  const stored = localStorage.getItem(collapsedCategoriesKey);
  if (!stored) return {};

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([category, collapsed]) =>
        Boolean(category) && typeof collapsed === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

function AdminWorkspace() {
  const [credentials, setCredentials] = useState(readCredentials);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [categoryDialogSource, setCategoryDialogSource] = useState<"menu" | "inline" | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState<TopicForm>({
    slug: "",
    title: "",
    description: "",
    categoryId: null,
    displayOrder: 0,
  });
  const [isTopicFormOpen, setIsTopicFormOpen] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(readDifficulty);
  const [questionForm, setQuestionForm] = useState<QuestionForm>({
    question: "",
    answer: "",
    example: "",
    codeSnippet: "",
    difficulty: selectedDifficulty,
    status: "DRAFT",
    tags: [],
    aiGenerationRunId: null,
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
  const [topicSearch, setTopicSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(readCollapsedCategories);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionStatusFilter, setQuestionStatusFilter] = useState<QuestionStatus | "ALL">("ALL");
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [revealedExamples, setRevealedExamples] = useState<Record<number, boolean>>({});
  const [revealedCodeSnippets, setRevealedCodeSnippets] = useState<Record<number, boolean>>({});
  const [revealedTags, setRevealedTags] = useState<Record<number, boolean>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [questionFieldError, setQuestionFieldError] = useState("");
  const [topicFieldError, setTopicFieldError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [aiIdea, setAiIdea] = useState("");
  const [aiType, setAiType] = useState<QuestionType>("INTERVIEW");
  const [aiCount, setAiCount] = useState(1);
  const [aiGenerateAlternatives, setAiGenerateAlternatives] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionDraft[]>([]);
  const [mergedQuestion, setMergedQuestion] = useState<GeneratedQuestionDraft | null>(null);
  const [selectedGeneratedIndexes, setSelectedGeneratedIndexes] = useState<number[]>([]);
  const [answerImprovements, setAnswerImprovements] = useState<Record<string, AnswerImprovement>>({});
  const [improvingAnswers, setImprovingAnswers] = useState<Record<string, boolean>>({});
  const [answerImprovementCounts, setAnswerImprovementCounts] = useState<Record<string, number>>({});
  const [savingGeneratedQuestions, setSavingGeneratedQuestions] = useState<Record<string, boolean>>({});
  const [questionImprovement, setQuestionImprovement] = useState<AnswerImprovement>(defaultAnswerImprovement);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingDetailsFor, setGeneratingDetailsFor] = useState<number | null>(null);
  const [detailsGenerationTargetId, setDetailsGenerationTargetId] = useState<number | null>(null);
  const [detailGenerationMode, setDetailGenerationMode] = useState<DetailGenerationMode>("EXAMPLE_AND_CODE");
  const [detailGenerationGuidance, setDetailGenerationGuidance] = useState("");
  const [detailsGenerationReady, setDetailsGenerationReady] = useState(false);
  const [aiGenerationMode, setAiGenerationMode] = useState<AiGenerationMode>("main");
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isTopicPlanOpen, setIsTopicPlanOpen] = useState(false);
  const [isStudyProgramOpen, setIsStudyProgramOpen] = useState(false);
  const [studyPrograms, setStudyPrograms] = useState<WeeklyStudyProgram[]>([]);
  const [topicPlanCategory, setTopicPlanCategory] = useState<Category | null>(null);
  const [topicPlanCategoryName, setTopicPlanCategoryName] = useState("");
  const [topicPlanGuidance, setTopicPlanGuidance] = useState("");
  const [topicPlanTargetRole, setTopicPlanTargetRole] = useState("Senior Backend Engineer");
  const [topicPlanFocuses, setTopicPlanFocuses] = useState<string[]>([
    "Core knowledge",
    "Internals",
  ]);
  const [topicPlanTopicCount, setTopicPlanTopicCount] = useState(10);
  const [generatedTopicProposals, setGeneratedTopicProposals] = useState<GeneratedTopicProposal[]>([]);
  const [selectedTopicProposalIndexes, setSelectedTopicProposalIndexes] = useState<number[]>([]);
  const [topicPlanLoading, setTopicPlanLoading] = useState(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState(aiLoadingMessages[0]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const aiPanelRef = useRef<HTMLElement | null>(null);
  const generatedDraftSequence = useRef(0);

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : "Something went wrong. Please try again.";
  const isAiBusy = aiLoading || topicPlanLoading;
  const createGeneratedDrafts = (questions: GeneratedQuestion[], generation: AiGenerationMetadata) => questions.map((question) => ({
    ...question,
    difficulty: selectedDifficulty,
    draftId: `generated-${++generatedDraftSequence.current}`,
    status: editingQuestionId !== null && selectedQuestion ? selectedQuestion.status : "DRAFT" as QuestionStatus,
    generation,
  }));

  useEffect(() => {
    if (!isAiBusy) return;
    let messageIndex = 0;
    const intervalId = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % aiLoadingMessages.length;
      setAiLoadingMessage(aiLoadingMessages[messageIndex]);
    }, 3500);
    return () => window.clearInterval(intervalId);
  }, [isAiBusy]);

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    localStorage.setItem(collapsedCategoriesKey, JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  useEffect(() => {
    localStorage.setItem(difficultyStorageKey, selectedDifficulty);
  }, [selectedDifficulty]);

  useEffect(() => {
    if (!deleteConfirmation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) setDeleteConfirmation(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteConfirmation, loading]);

  useEffect(() => {
    const updateScrollTopVisibility = () => setShowScrollTop(window.scrollY > 520);
    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollTopVisibility);
  }, []);

  const normalizedSearch = topicSearch.trim().toLowerCase();
  const visibleTopics = topics.filter((item) =>
    [item.title, item.slug, item.category].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );

  const categoryOrder = new Map(
    categories.map((category, index) => [category.name, category.displayOrder ?? index]),
  );
  const topicsByCategory = Array.from(
    visibleTopics.reduce((groups, item) => {
      const category = item.category || "Other";
      const categoryTopics = groups.get(category) ?? [];
      categoryTopics.push(item);
      groups.set(category, categoryTopics);
      return groups;
    }, new Map<string, TopicSummary[]>(normalizedSearch ? [] : categories.map((category) => [category.name, []]))),
  ).sort(([leftCategory, leftTopics], [rightCategory, rightTopics]) => {
    const orderDifference =
      (categoryOrder.get(leftCategory) ?? leftTopics[0]?.displayOrder ?? 0) -
      (categoryOrder.get(rightCategory) ?? rightTopics[0]?.displayOrder ?? 0);
    return orderDifference || leftCategory.localeCompare(rightCategory);
  }).map(([category, categoryTopics]) => [
    category,
    categoryTopics.sort((left, right) => left.displayOrder - right.displayOrder || left.title.localeCompare(right.title)),
  ] as [string, TopicSummary[]]);

  const normalizedQuestionSearch = questionSearch.trim().toLowerCase();
  const orderedQuestions = [...(topic?.questions ?? [])].sort(
    (left, right) => left.depth - right.depth || left.displayOrder - right.displayOrder || left.id - right.id,
  );
  const questionById = new Map(orderedQuestions.map((question) => [question.id, question]));
  const selectedQuestion = selectedQuestionId ? questionById.get(selectedQuestionId) : undefined;
  const isDetailsGeneration = detailsGenerationTargetId !== null && detailsGenerationTargetId === editingQuestionId;
  const selectedSiblings = selectedQuestion
    ? orderedQuestions.filter((question) => question.parentQuestionId === selectedQuestion.parentQuestionId)
    : [];
  const selectedSiblingIndex = selectedQuestion
    ? selectedSiblings.findIndex((question) => question.id === selectedQuestion.id)
    : -1;
  const matchesQuestionFilters = (question: Question) =>
    (questionStatusFilter === "ALL" || question.status === questionStatusFilter)
    && (!normalizedQuestionSearch || [question.question, question.answer].some((value) =>
      value.toLowerCase().includes(normalizedQuestionSearch),
    ));
  const hasVisibleQuestion = (question: Question): boolean =>
    matchesQuestionFilters(question) || orderedQuestions.some(
      (child) => child.parentQuestionId === question.id && hasVisibleQuestion(child),
    );
  const rootQuestions = orderedQuestions.filter((question) => question.parentQuestionId === null);
  const isAlternativeGeneration = aiGenerateAlternatives
    && (aiGenerationMode === "follow-up" || (aiGenerationMode === "main" && aiCount === 1));
  const isMultipleQuestionGeneration = aiGenerationMode === "main"
    && generatedQuestions.length > 1
    && !isAlternativeGeneration;
  const questionStatusCounts = QUESTION_STATUS_OPTIONS.reduce<Record<QuestionStatus | "ALL", number>>((counts, status) => {
    counts[status.value] = orderedQuestions.filter((question) => question.status === status.value).length;
    return counts;
  }, { ALL: orderedQuestions.length, DRAFT: 0, REVIEWED: 0, PUBLISHED: 0 });

  const loadTopics = async () => {
    const list = await listTopics();
    setTopics(list);
    return list;
  };

  const loadCategories = async () => {
    const list = await listCategories();
    setCategories(list);
    return list;
  };

  const loadStudyPrograms = async () => {
    const list = await listStudyPrograms();
    setStudyPrograms(list);
    return list;
  };

  const openStudyProgram = () => {
    setIsCreateMenuOpen(false); setIsTopicPlanOpen(false); setIsStudyProgramOpen(true); setTopic(null);
  };

  const saveStudyProgram = async (programId: number | null, payload: StudyProgramPayload) => {
    setLoading(true); setError("");
    try {
      await persistStudyProgram(programId, payload);
      await loadStudyPrograms(); setNotice("Weekly study program published"); setIsStudyProgramOpen(false);
    } catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };

  const createCategory = async (name: string, displayOrder: number) => {
    const created = (await request("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name, displayOrder }),
    })) as Category;
    await loadCategories();
    if (categoryDialogSource === "inline") {
      setTopicForm((current) => ({
        ...current,
        categoryId: created.id,
        ...(!topic && !slugWasEdited ? { slug: generateSlug(created.name, current.title) } : {}),
      }));
    }
    setCategoryDialogSource(null);
    setNotice(`Category "${created.name}" created`);
  };

  const getOrCreateCategory = async (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    const existing = categories.find((category) => category.name.toLowerCase() === normalizedName);
    if (existing) return existing;

    try {
      const created = (await request("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), displayOrder: categories.length }),
      })) as Category;
      setCategories((current) => [...current, created]);
      return created;
    } catch (err) {
      if (!(err instanceof ApiRequestError) || err.status !== 409) throw err;
      const refreshedCategories = await loadCategories();
      const concurrentCategory = refreshedCategories.find(
        (category) => category.name.toLowerCase() === normalizedName,
      );
      if (concurrentCategory) return concurrentCategory;
      throw err;
    }
  };

  const loadTopic = useCallback(async (
    slug: string,
    difficulty: Difficulty = selectedDifficulty,
    preserveAiPanel = false,
  ) => {
    setIsQuestionFormOpen(false);
    setEditingQuestionId(null);
    if (!preserveAiPanel) setIsAiPanelOpen(false);
    setIsTopicPlanOpen(false);
    setSelectedQuestionId(null);
    setQuestionForm({ question: "", answer: "", example: "", codeSnippet: "", difficulty, status: "DRAFT", tags: [], aiGenerationRunId: null, parentQuestionId: null, displayOrder: 0 });
    const loaded = await getTopic(slug, difficulty);
    setTopic(loaded);
    setIsQuestionFormOpen(loaded.questions.length === 0);
    setTopicForm({
      slug: loaded.slug,
      title: loaded.title,
      description: loaded.description ?? "",
      categoryId: loaded.categoryId,
      displayOrder: loaded.displayOrder,
    });
    setIsTopicFormOpen(false);
  }, [selectedDifficulty]);

  useEffect(() => {
    if (!credentials) return;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [loadedTopics, loadedCategories] = await Promise.all([loadTopics(), loadCategories(), loadStudyPrograms()]);
        if (loadedTopics.length) {
          const categoryOrder = new Map(
            loadedCategories.map((category, index) => [category.name, category.displayOrder ?? index]),
          );
          const firstTopic = [...loadedTopics].sort((left, right) => {
            const categoryDifference =
              (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
              (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER);
            return categoryDifference || left.displayOrder - right.displayOrder || left.title.localeCompare(right.title);
          })[0];
          setSelectedSlug((current) => current || firstTopic.slug);
        }
      } catch (err: unknown) {
        if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
          clearCredentials();
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
    const loadSelectedTopic = async () => {
      try {
        await loadTopic(selectedSlug, selectedDifficulty);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    };
    void loadSelectedTopic();
  }, [credentials, selectedSlug, selectedDifficulty, loadTopic]);

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
    setIsAiPanelOpen(false);
    setIsTopicPlanOpen(false);
    setGeneratedQuestions([]);
    setMergedQuestion(null);
    setSelectedGeneratedIndexes([]);
    if (parentId === null) setAiGenerationMode("main");
    setSelectedQuestionId(parentId);
    setEditingQuestionId(null);
    setDetailsGenerationTargetId(null);
    setDetailsGenerationReady(false);
    setQuestionForm({
      question: "",
      answer: "",
      example: "",
      codeSnippet: "",
      difficulty: selectedDifficulty,
      status: "DRAFT",
      tags: [],
      aiGenerationRunId: null,
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
    setDetailsGenerationTargetId(null);
    setDetailsGenerationReady(false);
    setIsQuestionFormOpen(true);
    setIsAiPanelOpen(false);
    setIsTopicPlanOpen(false);
    setQuestionForm({
      question: question.question,
      answer: question.answer,
      example: question.example ?? "",
      codeSnippet: question.codeSnippet ?? "",
      difficulty: question.difficulty,
      status: question.status,
      tags: question.tags,
      aiGenerationRunId: question.aiGeneration?.generationRunId ?? null,
      parentQuestionId: question.parentQuestionId,
      displayOrder: question.displayOrder,
    });
    setQuestionFieldError("");
    window.requestAnimationFrame(() => {
      document.getElementById("question-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("question-input")?.focus();
    });
  };

  const scrollToCategory = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToQuestion = (questionId: number | null) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = questionId === null
          ? document.getElementById("question-workspace")
          : document.getElementById(`question-node-${questionId}`);
        target?.scrollIntoView({ behavior: "smooth", block: questionId === null ? "start" : "center" });
      });
    });
  };

  const closeQuestionForm = () => {
    setIsQuestionFormOpen(false);
    setEditingQuestionId(null);
    setDetailsGenerationTargetId(null);
    setDetailsGenerationReady(false);
    setQuestionForm({ question: "", answer: "", example: "", codeSnippet: "", difficulty: selectedDifficulty, status: "DRAFT", tags: [], aiGenerationRunId: null, parentQuestionId: null, displayOrder: 0 });
  };

  const cancelQuestionForm = () => {
    const questionId = editingQuestionId ?? selectedQuestionId;
    closeQuestionForm();
    scrollToQuestion(questionId);
  };

  const closeAiPanel = () => {
    setIsAiPanelOpen(false);
  };

  const focusAiGeneration = (mode: AiGenerationMode = "main") => {
    setAiGenerationMode(mode);
    setAiCount(1);
    setAiGenerateAlternatives(false);
    setGeneratedQuestions([]);
    setMergedQuestion(null);
    setSelectedGeneratedIndexes([]);
    setQuestionImprovement(defaultAnswerImprovement);
    setIsAiPanelOpen(true);
    setIsQuestionFormOpen(false);
    setIsTopicPlanOpen(false);
    setEditingQuestionId(null);
    window.requestAnimationFrame(() => {
      scrollToCategory("ai-assist");
      document.getElementById("ai-idea")?.focus();
    });
  };

  const openTopicPlan = (category: Category) => {
    setIsAiPanelOpen(false);
    setIsQuestionFormOpen(false);
    setIsTopicPlanOpen(true);
    setTopicPlanCategory(category);
    setTopicPlanCategoryName(category.name);
    setTopicPlanFocuses(["Core knowledge", "Internals"]);
    setGeneratedTopicProposals([]);
    setSelectedTopicProposalIndexes([]);
    setError("");
    setNotice("");
    window.requestAnimationFrame(() => {
      document.getElementById("topic-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeTopicPlan = () => {
    if (topicPlanLoading || loading) return;
    setIsTopicPlanOpen(false);
    setTopicPlanCategory(null);
    setTopicPlanCategoryName("");
    setTopicPlanGuidance("");
    setGeneratedTopicProposals([]);
    setSelectedTopicProposalIndexes([]);
  };

  const openNewTopic = () => {
    closeTopicPlan();
    setIsCreateMenuOpen(false);
    setTopic(null);
    setSelectedSlug("");
    setSlugWasEdited(false);
    setTopicForm({
      slug: "",
      title: "",
      description: "",
      categoryId: null,
      displayOrder: topics.length,
    });
    setIsTopicFormOpen(true);
  };

  const openNewTopicPlan = () => {
    setIsAiPanelOpen(false);
    setIsQuestionFormOpen(false);
    setIsTopicPlanOpen(true);
    setTopicPlanCategory(null);
    setTopic(null);
    setTopicPlanCategoryName("");
    setTopicPlanGuidance("");
    setTopicPlanFocuses(["Core knowledge", "Internals"]);
    setGeneratedTopicProposals([]);
    setSelectedTopicProposalIndexes([]);
    setError("");
    setNotice("");
    window.requestAnimationFrame(() => {
      document.getElementById("topic-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("topic-plan-category-name")?.focus();
    });
  };

  const generateTopicPlan = async (event: FormEvent) => {
    event.preventDefault();
    const categoryName = topicPlanCategoryName.trim();
    const targetCategoryName = topicPlanCategory?.name ?? categoryName;
    if (!categoryName) {
      setError("Enter a category name for the topic plan.");
      return;
    }
    if (!topicPlanFocuses.length) {
      setError("Select at least one interview focus.");
      return;
    }
    setError("");
    setAiLoadingMessage(aiLoadingMessages[0]);
    setTopicPlanLoading(true);
    try {
      const result = (await request("/api/admin/ai/topic-plans/generate", {
        method: "POST",
        body: JSON.stringify({
          categoryName,
          targetRole: topicPlanTargetRole.trim(),
          focuses: topicPlanFocuses,
          topicCount: topicPlanTopicCount,
          additionalGuidance: topicPlanGuidance.trim() || null,
          existingTopicTitles: topics
            .filter((item) => item.category.toLowerCase() === targetCategoryName.toLowerCase())
            .map((item) => item.title)
            .slice(0, 50),
        }),
      }, undefined, 180_000)) as { topics: GeneratedTopicProposal[]; usage?: AiUsage };
      const proposals = result.topics;
      setGeneratedTopicProposals(proposals);
      setSelectedTopicProposalIndexes(proposals.map((_, index) => index));
      setAiUsage(result.usage ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTopicPlanLoading(false);
    }
  };

  const moveTopicProposal = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= generatedTopicProposals.length) return;
    setGeneratedTopicProposals((current) => {
      const reordered = [...current];
      const [proposal] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, proposal);
      return reordered;
    });
    setSelectedTopicProposalIndexes((current) => current.map((selectedIndex) => {
      if (selectedIndex === index) return targetIndex;
      if (selectedIndex === targetIndex) return index;
      return selectedIndex;
    }));
  };

  const removeTopicProposal = (index: number) => {
    setGeneratedTopicProposals((current) => current.filter((_, candidateIndex) => candidateIndex !== index));
    setSelectedTopicProposalIndexes((current) => current
      .filter((selectedIndex) => selectedIndex !== index)
      .map((selectedIndex) => selectedIndex > index ? selectedIndex - 1 : selectedIndex));
  };

  const saveTopicPlan = async () => {
    if (!topicPlanCategoryName.trim() || !selectedTopicProposalIndexes.length) return;
    const selectedProposals = selectedTopicProposalIndexes.map((index) => generatedTopicProposals[index]);
    const existingSlugs = new Set(topics.map((item) => item.slug));
    setLoading(true);
    setError("");
    try {
      const category = await getOrCreateCategory(topicPlanCategoryName);
      const categoryTopicCount = topics.filter((item) => item.categoryId === category.id).length;
      for (const [index, proposal] of selectedProposals.entries()) {
        const baseSlug = generateSlug(category.name, proposal.title);
        let slug = baseSlug;
        let suffix = 2;
        while (existingSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }
        existingSlugs.add(slug);
        await request("/api/admin/topics", {
          method: "POST",
          body: JSON.stringify({
            slug,
            title: proposal.title.trim(),
            description: proposal.description.trim() || null,
            categoryId: category.id,
            displayOrder: categoryTopicCount + index,
          }),
        });
      }
      await loadTopics();
      setNotice(`${selectedProposals.length} topic${selectedProposals.length === 1 ? "" : "s"} created`);
      setIsTopicPlanOpen(false);
      setTopicPlanCategory(null);
      setTopicPlanCategoryName("");
      setTopicPlanGuidance("");
      setGeneratedTopicProposals([]);
      setSelectedTopicProposalIndexes([]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const improveQuestionWithAi = (question: Question) => {
    setSelectedQuestionId(question.id);
    setEditingQuestionId(question.id);
    setAiGenerationMode("main");
    setAiIdea("");
    setQuestionImprovement(defaultAnswerImprovement);
    setAiGenerateAlternatives(false);
    setGeneratedQuestions([]);
    setMergedQuestion(null);
    setSelectedGeneratedIndexes([]);
    setIsQuestionFormOpen(false);
    setIsTopicPlanOpen(false);
    setIsAiPanelOpen(true);
    window.requestAnimationFrame(() => {
      scrollToCategory("ai-assist");
      document.getElementById("ai-idea")?.focus();
    });
  };

  const generateDetailsWithAi = async (question: Question) => {
    setError("");
    setNotice("");
    setAiLoadingMessage(aiLoadingMessages[0]);
    setAiLoading(true);
    setGeneratingDetailsFor(question.id);
    try {
      const result = (await request("/api/admin/ai/questions/example-and-code/generate", {
        method: "POST",
        body: JSON.stringify({
          question: questionForm.question,
          answer: questionForm.answer,
          mode: detailGenerationMode,
          guidance: detailGenerationGuidance.trim() || null,
        }),
      }, undefined, 180_000)) as { example?: string; codeSnippet?: string; usage?: AiUsage; generation: AiGenerationMetadata };
      const example = result.example;
      if (detailGenerationMode !== "CODE_ONLY" && !example?.trim()) {
        throw new Error("The AI did not return an example.");
      }
      if (detailGenerationMode !== "EXAMPLE_ONLY" && !result.codeSnippet?.trim()) {
        throw new Error("The AI did not return a code snippet.");
      }

      setQuestionForm((current) => ({
        ...current,
        example: detailGenerationMode === "CODE_ONLY" ? current.example : example ?? "",
        codeSnippet: detailGenerationMode === "EXAMPLE_ONLY" ? current.codeSnippet : result.codeSnippet ?? "",
        aiGenerationRunId: result.generation.generationRunId,
      }));
      setAiUsage(result.usage ?? null);
      setDetailsGenerationReady(true);
      setNotice("AI details are ready to review. Save to apply them.");
      window.requestAnimationFrame(() => {
        document.getElementById("question-example")?.focus();
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
      setGeneratingDetailsFor(null);
    }
  };

  const prepareDetailsGeneration = (question: Question) => {
    openQuestionEditor(question);
    setDetailsGenerationTargetId(question.id);
    setDetailGenerationMode("EXAMPLE_AND_CODE");
    setDetailGenerationGuidance("");
    setDetailsGenerationReady(false);
  };

  const handleLogin = async (username: string, password: string) => {
    setError("");
    const encoded = btoa(`${username}:${password}`);
    try {
      await request("/api/admin/topics", {}, encoded);
      saveCredentials(encoded);
      setCredentials(encoded);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleTopicSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setTopicFieldError("");
    if (topicForm.categoryId === null || !categories.some((item) => item.id === topicForm.categoryId) || !topicForm.title.trim() || !topicForm.slug.trim()) {
      setTopicFieldError("Choose a category and enter a title and slug.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topicForm.slug.trim())) {
      setTopicFieldError("Slug must contain lowercase letters, numbers, and hyphens only.");
      return;
    }
    setLoading(true);
    try {
      const isNew = !topic;
      if (isNew && topics.some((item) => item.slug === topicForm.slug.trim())) {
        throw new Error(
          "This slug already exists. Use a new slug, such as java-collections.",
        );
      }
      if (topics.some((item) => item.categoryId === topicForm.categoryId
        && item.title.trim().toLocaleLowerCase() === topicForm.title.trim().toLocaleLowerCase()
        && item.slug !== topic?.slug)) {
        throw new Error(`Topic "${topicForm.title.trim()}" already exists in this category.`);
      }
      const payload = isNew
        ? {
            slug: topicForm.slug.trim(),
            title: topicForm.title.trim(),
            description: topicForm.description.trim() || null,
            categoryId: topicForm.categoryId,
            displayOrder: topicForm.displayOrder,
          }
        : {
            title: topicForm.title.trim(),
            description: topicForm.description.trim() || null,
            categoryId: topicForm.categoryId,
            displayOrder: topicForm.displayOrder,
          };
      const result = (await request(
        isNew
          ? "/api/admin/topics"
          : `/api/admin/topics/${encodeURIComponent(topic.slug)}`,
        {
          method: isNew ? "POST" : "PUT",
          body: JSON.stringify(payload),
        },
      )) as Topic;
      setNotice(isNew ? "Topic created" : "Topic updated");
      await loadTopics();
      setSelectedSlug(result.slug);
      await loadTopic(result.slug);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!topic) return;
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
        : `/api/admin/topics/${encodeURIComponent(topic.slug)}/questions`;
      const savedQuestion = (await request(path, {
        method: editingQuestionId ? "PUT" : "POST",
        body: JSON.stringify({
          ...questionForm,
          question: questionForm.question.trim(),
          answer: questionForm.answer.trim(),
          example: questionForm.example.trim() || null,
          codeSnippet: questionForm.codeSnippet.trim() || null,
          tags: questionForm.tags,
        }),
      })) as Question;
      const wasEditing = editingQuestionId !== null;
      setQuestionForm({ question: "", answer: "", example: "", codeSnippet: "", difficulty: selectedDifficulty, status: "DRAFT", tags: [], aiGenerationRunId: null, parentQuestionId: null, displayOrder: 0 });
      setEditingQuestionId(null);
      setDetailsGenerationTargetId(null);
      setIsQuestionFormOpen(false);
      setGeneratedQuestions([]);
      setMergedQuestion(null);
      setSelectedGeneratedIndexes([]);
      await loadTopic(topic.slug);
      setSelectedQuestionId(savedQuestion.id);
      if (savedQuestion.parentQuestionId !== null) {
        setExpandedQuestions((current) => ({ ...current, [savedQuestion.parentQuestionId as number]: true }));
      }
      scrollToQuestion(savedQuestion.id);
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
    if (aiGenerationMode === "follow-up" && !selectedQuestion) {
      setError("Select a parent question before generating follow-ups.");
      return;
    }
    if (aiGenerationMode === "main" && (!Number.isInteger(aiCount) || aiCount < 1 || aiCount > maxBatchQuestionCount)) {
      setError(`Number of questions must be between 1 and ${maxBatchQuestionCount}.`);
      return;
    }
    setAiLoading(true);
    try {
      const editingExistingQuestion = editingQuestionId !== null && selectedQuestion;
      const path = editingExistingQuestion
        ? "/api/admin/ai/questions/improve"
        : "/api/admin/ai/questions/generate";
      const payload = editingExistingQuestion
        ? {
            question: selectedQuestion.question,
            answer: selectedQuestion.answer,
            criteria: aiIdea.trim() || null,
            humanized: questionImprovement.humanized,
            shortened: questionImprovement.shortened,
            simplified: questionImprovement.simplified,
            answerOnly: false,
            difficulty: selectedDifficulty,
            type: aiType,
          }
        : {
            idea: aiIdea.trim() || null,
            parentQuestion: aiGenerationMode === "follow-up" ? selectedQuestion?.question ?? null : null,
            parentAnswer: aiGenerationMode === "follow-up" ? selectedQuestion?.answer ?? null : null,
            topicTitle: topic?.title,
            topicCategory: topic?.category,
            topicDescription: topic?.description ?? "",
            difficulty: selectedDifficulty,
            type: aiType,
            count: aiGenerationMode === "main"
              ? aiGenerateAlternatives && aiCount === 1 ? 2 : aiCount
              : aiGenerateAlternatives
                ? Math.min(Math.max(aiCount, 1), 2)
                : 1,
            existingQuestions: !aiIdea.trim() && aiGenerationMode !== "follow-up"
              ? rootQuestions.map((question) => question.question)
              : [],
          };
      const result = (await request(path, {
        method: "POST",
        body: JSON.stringify(payload),
      }, undefined, 200_000)) as GeneratedQuestionsResult;
      setGeneratedQuestions(createGeneratedDrafts(result.questions, result.generation));
      setMergedQuestion(null);
      setSelectedGeneratedIndexes([]);
      setAnswerImprovements({});
      setImprovingAnswers({});
      setAnswerImprovementCounts({});
      setAiUsage(result.usage ?? null);
      setIsAiPanelOpen(true);
      window.requestAnimationFrame(() => {
        scrollToCategory("ai-assist");
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const editGeneratedQuestion = (generated: GeneratedQuestionDraft) => {
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
      example: generated.example,
      codeSnippet: generated.codeSnippet,
      difficulty: generated.difficulty,
      status: editingExistingQuestion ? selectedQuestion.status : "DRAFT",
      tags: generated.tags,
      aiGenerationRunId: generated.generation.generationRunId,
      parentQuestionId: editingExistingQuestion ? selectedQuestion.parentQuestionId : parentId,
      displayOrder: editingExistingQuestion ? selectedQuestion.displayOrder : siblingOrder,
    });
    setEditingQuestionId(editingExistingQuestion ? selectedQuestion.id : null);
    setIsQuestionFormOpen(true);
    setIsAiPanelOpen(false);
    setIsTopicPlanOpen(false);
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
    setAiLoadingMessage(aiLoadingMessages[0]);
    setAiLoading(true);
    try {
      const result = (await request("/api/admin/ai/questions/merge", {
        method: "POST",
        body: JSON.stringify({
          questions: selectedGeneratedIndexes.map((index) => {
            const { question, answer, example, codeSnippet, difficulty, type, tags } = generatedQuestions[index];
            return { question, answer, example, codeSnippet, difficulty, type, tags };
          }),
        }),
      }, undefined, 180_000)) as GeneratedQuestionsResult;
      setMergedQuestion(createGeneratedDrafts(result.questions, result.generation)[0] ?? null);
      setSelectedGeneratedIndexes([]);
      setAiUsage(result.usage ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const saveGeneratedQuestions = async (questions: GeneratedQuestionDraft[]) => {
    if (!topic || questions.length === 0) return;
    if (questions.some((question) => !question.question.trim() || !question.answer.trim())) {
      setError("Each generated question needs both a question and an answer before saving.");
      return;
    }
    setError("");
    setAiLoadingMessage(aiLoadingMessages[0]);
    setAiLoading(true);
    try {
      await request(`/api/admin/topics/${encodeURIComponent(topic.slug)}/questions/bulk`, {
        method: "POST",
        body: JSON.stringify({
          questions: questions.map((question, index) => ({
            question: question.question.trim(),
            answer: question.answer.trim(),
            example: question.example.trim() || null,
            codeSnippet: question.codeSnippet.trim() || null,
            difficulty: question.difficulty,
            status: question.status,
            tags: question.tags,
            aiGenerationRunId: question.generation.generationRunId,
            parentQuestionId: null,
            displayOrder: index,
          })),
        }),
      });
      setGeneratedQuestions([]);
      setMergedQuestion(null);
      setSelectedGeneratedIndexes([]);
      setIsAiPanelOpen(false);
      await loadTopic(topic.slug);
      setNotice(`${questions.length} initial question${questions.length === 1 ? "" : "s"} created`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const updateGeneratedQuestion = (index: number, field: "question" | "answer" | "example" | "codeSnippet" | "tags", value: string) => {
    setGeneratedQuestions((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: field === "tags" ? parseTags(value) : value } : item,
    ));
  };

  const updateGeneratedQuestionStatus = (draftId: string, status: QuestionStatus) => {
    setGeneratedQuestions((current) => current.map((item) => item.draftId === draftId ? { ...item, status } : item));
  };

  const updateAllGeneratedQuestionStatuses = (status: QuestionStatus) => {
    setGeneratedQuestions((current) => current.map((item) => ({ ...item, status })));
  };

  const updateAnswerImprovement = (draftId: string, update: Partial<AnswerImprovement>) => {
    setAnswerImprovements((current) => {
      const existing = current[draftId];
      return {
        ...current,
        [draftId]: { ...(existing ?? defaultAnswerImprovement), ...update },
      };
    });
  };

  const improveGeneratedAnswer = async (draft: GeneratedQuestionDraft) => {
    const improvement = answerImprovements[draft.draftId] ?? defaultAnswerImprovement;
    setError("");
    setImprovingAnswers((current) => ({ ...current, [draft.draftId]: true }));
    try {
      const draftRequest: GeneratedQuestion = {
        question: draft.question,
        answer: draft.answer,
        example: draft.example,
        codeSnippet: draft.codeSnippet,
        difficulty: draft.difficulty,
        type: draft.type,
        tags: draft.tags,
      };
      const result = (await request("/api/admin/ai/questions/improve", {
        method: "POST",
        body: JSON.stringify({ ...draftRequest, ...improvement, answerOnly: true }),
      }, undefined, 180_000)) as GeneratedQuestionsResult;
      const improved = result.questions[0];
      if (!improved) throw new Error("The AI did not return an improved answer.");
      setGeneratedQuestions((current) => current.map((item) =>
        item.draftId === draft.draftId ? { ...item, ...improved, generation: result.generation } : item,
      ));
      setAnswerImprovementCounts((current) => ({
        ...current,
        [draft.draftId]: (current[draft.draftId] ?? 0) + 1,
      }));
      setAiUsage(result.usage ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setImprovingAnswers((current) => ({ ...current, [draft.draftId]: false }));
    }
  };

  const saveGeneratedQuestion = async (draft: GeneratedQuestionDraft) => {
    if (!topic || !draft.question.trim() || !draft.answer.trim()) {
      setError("The generated question needs both a question and an answer before saving.");
      return;
    }
    const editingExistingQuestion = editingQuestionId !== null && selectedQuestion;
    const parentQuestionId = editingExistingQuestion
      ? selectedQuestion.parentQuestionId
      : aiGenerationMode === "follow-up"
        ? selectedQuestion?.id ?? null
        : null;
    const siblingOrder = Math.max(
      -1,
      ...orderedQuestions
        .filter((question) => question.parentQuestionId === parentQuestionId && question.id !== editingQuestionId)
        .map((question) => question.displayOrder),
    ) + 1;
    setError("");
    setSavingGeneratedQuestions((current) => ({ ...current, [draft.draftId]: true }));
    try {
      const path = editingExistingQuestion
        ? `/api/admin/questions/${editingQuestionId}`
        : `/api/admin/topics/${encodeURIComponent(topic.slug)}/questions`;
      await request(path, {
        method: editingExistingQuestion ? "PUT" : "POST",
        body: JSON.stringify({
          question: draft.question.trim(),
          answer: draft.answer.trim(),
          example: draft.example.trim() || null,
          codeSnippet: draft.codeSnippet.trim() || null,
          difficulty: draft.difficulty,
          status: draft.status,
          tags: draft.tags,
          aiGenerationRunId: draft.generation.generationRunId,
          parentQuestionId,
          displayOrder: editingExistingQuestion ? selectedQuestion.displayOrder : siblingOrder,
        }),
      });
      const removedIndex = generatedQuestions.findIndex((item) => item.draftId === draft.draftId);
      setGeneratedQuestions((current) => current.filter((item) => item.draftId !== draft.draftId));
      setSelectedGeneratedIndexes((current) => current
        .filter((index) => index !== removedIndex)
        .map((index) => index > removedIndex ? index - 1 : index));
      await loadTopic(topic.slug, selectedDifficulty, generatedQuestions.length > 1);
      setNotice(editingExistingQuestion ? "Question updated" : "Question saved");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingGeneratedQuestions((current) => ({ ...current, [draft.draftId]: false }));
    }
  };

  const removeGeneratedQuestion = (index: number) => {
    setGeneratedQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedGeneratedIndexes((current) => current
      .filter((selectedIndex) => selectedIndex !== index)
      .map((selectedIndex) => selectedIndex > index ? selectedIndex - 1 : selectedIndex));
  };

  const toggleGeneratedQuestion = (index: number) => {
    setSelectedGeneratedIndexes((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index]);
  };

  const saveSelectedGeneratedQuestions = () => {
    void saveGeneratedQuestions(selectedGeneratedIndexes.map((index) => generatedQuestions[index]));
  };

  const discardGeneratedQuestions = () => {
    setGeneratedQuestions([]);
    setMergedQuestion(null);
    setSelectedGeneratedIndexes([]);
  };

  const deleteQuestion = async (questionId: number) => {
    if (!topic) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      await loadTopic(topic.slug);
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
    if (!topic) return;
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
      await request(`/api/admin/topics/${encodeURIComponent(topic.slug)}/questions/order`, {
        method: "PUT",
        body: JSON.stringify({ questionIds: reorderedQuestionIds }),
      });
      await loadTopic(topic.slug);
      setNotice("Question order saved");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const moveCategory = async (categoryId: number, direction: -1 | 1) => {
    const currentIndex = categories.findIndex((category) => category.id === categoryId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= categories.length) return;

    const reorderedCategoryIds = categories.map((category) => category.id);
    const [movedCategoryId] = reorderedCategoryIds.splice(currentIndex, 1);
    reorderedCategoryIds.splice(targetIndex, 0, movedCategoryId);
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request("/api/admin/categories/order", {
        method: "PUT",
        body: JSON.stringify({ categoryIds: reorderedCategoryIds }),
      });
      await loadCategories();
      setNotice("Category order saved");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const moveTopic = async (categoryId: number, categoryTopics: TopicSummary[], slug: string, direction: -1 | 1) => {
    const currentIndex = categoryTopics.findIndex((item) => item.slug === slug);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= categoryTopics.length) return;

    const topicSlugs = categoryTopics.map((item) => item.slug);
    const [movedSlug] = topicSlugs.splice(currentIndex, 1);
    topicSlugs.splice(targetIndex, 0, movedSlug);
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/categories/${categoryId}/topics/order`, {
        method: "PUT",
        body: JSON.stringify({ topicSlugs }),
      });
      await loadTopics();
      setNotice("Topic order saved");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const deleteTopic = async () => {
    if (!topic) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/topics/${encodeURIComponent(topic.slug)}`, {
        method: "DELETE",
      });
      setTopic(null);
      setSelectedSlug("");
      setDeleteConfirmation(null);
      setNotice("Topic deleted");
      await loadTopics();
    } catch (err) {
      setDeleteConfirmation(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!credentials) return <LoginPage error={error} onLogin={handleLogin} />;

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Backend Engineering Notes</p>
          <h1>Content control room</h1>
        </div>
        <div className="topbar-actions">
          <AiProviderSelector
            onError={setError}
            onChanged={setNotice}
          />
          <button
            type="button"
            onClick={() => {
              clearCredentials();
              setCredentials("");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      {isAiBusy && <AiLoadingOverlay message={aiLoadingMessage} topicPlanLoading={topicPlanLoading} />}
      {categoryDialogSource && <CategoryCreateDialog
        suggestedOrder={categories.length}
        onCreate={createCategory}
        onClose={() => setCategoryDialogSource(null)}
      />}
      <div className="workspace">
        <ContentLibrary
          topics={topics}
          categories={categories}
          topicsByCategory={topicsByCategory}
          selectedSlug={selectedSlug}
          search={topicSearch}
          collapsedCategories={collapsedCategories}
          createMenuOpen={isCreateMenuOpen}
          loading={loading}
          onSearchChange={setTopicSearch}
          onToggleCreateMenu={() => setIsCreateMenuOpen((current) => !current)}
          onCloseCreateMenu={() => setIsCreateMenuOpen(false)}
          onNewTopic={openNewTopic}
          onNewCategory={() => { setIsCreateMenuOpen(false); setCategoryDialogSource("menu"); }}
          onNewTopicPlan={() => { setIsCreateMenuOpen(false); openNewTopicPlan(); }}
          onOpenStudyProgram={openStudyProgram}
          onToggleCategory={(category) => { setIsCreateMenuOpen(false); closeTopicPlan(); setCollapsedCategories((current) => ({ ...current, [category]: !current[category] })); }}
          onSelectTopic={(slug) => { setIsCreateMenuOpen(false); closeTopicPlan(); setSelectedSlug(slug); }}
          onMoveCategory={moveCategory}
          onMoveTopic={moveTopic}
          onOpenTopicPlan={openTopicPlan}
        />
        <section className="editor" id="content-library">
          <StatusBanner error={error} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
          {isStudyProgramOpen && <StudyProgramEditor topics={topics} programs={studyPrograms} loading={loading} onSave={saveStudyProgram} onClose={() => setIsStudyProgramOpen(false)} />}
          {!isStudyProgramOpen && !isTopicPlanOpen && <>
            <div className="editor-heading">
              <div>
                <p className="eyebrow">{topic ? "Editing topic" : "New topic"}</p>
                <h2>{topic?.title ?? (topics.length ? "Create a new topic" : "Create your first topic")}</h2>
              </div>
            </div>
            <div className="topic-form-heading">
              <div>
                <p className="eyebrow">Topic details</p>
                <div className="topic-form-summary">
                  {topic && (
                    <button
                      className="topic-form-toggle"
                      type="button"
                      aria-expanded={isTopicFormOpen}
                      aria-controls="topic-form"
                      aria-label={isTopicFormOpen ? "Collapse topic details" : "Expand topic details"}
                      title={isTopicFormOpen ? "Collapse topic details" : "Expand topic details"}
                      onClick={() => setIsTopicFormOpen((open) => !open)}
                    />
                  )}
                  {!isTopicFormOpen && <span>{categories.find((item) => item.id === topicForm.categoryId)?.name ?? topic?.category} · {topicForm.slug}</span>}
                </div>
              </div>
            </div>
            {isTopicFormOpen && <form className="topic-form" id="topic-form" onSubmit={handleTopicSubmit}>
            <div className="form-fields">
              <div className="topic-category-field">
                <label htmlFor="topic-category">Category</label>
                <div className="category-picker">
                  <select id="topic-category" value={topicForm.categoryId ?? ""} onChange={(event) => {
                    const categoryId = event.target.value ? Number(event.target.value) : null;
                    const categoryName = categories.find((item) => item.id === categoryId)?.name ?? "";
                    setTopicFieldError("");
                    setTopicForm({ ...topicForm, categoryId,
                      ...(topic || slugWasEdited ? {} : { slug: generateSlug(categoryName, topicForm.title) }),
                    });
                  }} required>
                    <option value="">Select category…</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setCategoryDialogSource("inline")}>+ New category</button>
                </div>
                {topicFieldError && <small className="field-error">{topicFieldError}</small>}
              </div>
              <label>
                Title
                <input
                  value={topicForm.title}
                  onChange={(event) => {
                    setTopicFieldError("");
                    setTopicForm({
                      ...topicForm,
                      title: event.target.value,
                      ...(topic || slugWasEdited
                        ? {}
                        : { slug: generateSlug(categories.find((item) => item.id === topicForm.categoryId)?.name ?? "", event.target.value) }),
                    });
                  }}
                  required
                />
              </label>
              <label>
                Slug
                <input
                  value={topicForm.slug}
                  disabled={Boolean(topic)}
                  onChange={(event) => {
                    setTopicFieldError("");
                    setSlugWasEdited(true);
                    setTopicForm({ ...topicForm, slug: event.target.value });
                  }}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
                <small className="field-hint">
                  Suggested from category and title. You can edit it, but it must be unique and URL-safe.
                </small>
              </label>
              <label>
                Order
                <input
                  type="number"
                  min="0"
                  value={topicForm.displayOrder}
                  onChange={(event) =>
                    setTopicForm({
                      ...topicForm,
                      displayOrder: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
              <label className="topic-description-field">
                Description
                <textarea
                  rows={2}
                  value={topicForm.description}
                  onChange={(event) => setTopicForm({ ...topicForm, description: event.target.value })}
                />
                <small className="field-hint">A short summary for this topic.</small>
              </label>
              <div className="form-actions">
                {topic && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => setDeleteConfirmation({ type: "topic", title: topic.title, slug: topic.slug })}
                  >
                    Delete topic
                  </button>
                )}
                <button className="primary" type="submit">
                  {topic ? "Save topic" : "Create topic"}
                </button>
              </div>
            </div>
            </form>}
            {topic && <div className="topic-form-separator" aria-hidden="true" />}
          </>}
          {isTopicPlanOpen && (
            <section className="plan-editor" id="topic-plan" aria-label={`Create topics with AI for ${topicPlanCategoryName || "a new category"}`}>
              <div className="category-heading">
                <div>
                  <p className="eyebrow">AI assist</p>
                  <h3>Generate topics with AI</h3>
                  <span>{topicPlanCategory ? `${topicPlanCategory.name} · ` : "Start with a new category · "}proposals remain unpublished until you create the selected topics</span>
                </div>
              </div>
              <form className="plan-form" onSubmit={generateTopicPlan}>
                <label>
                  Category
                  <input id="topic-plan-category-name" value={topicPlanCategoryName} onChange={(event) => {
                    const categoryName = event.target.value;
                    setTopicPlanCategoryName(categoryName);
                    if (topicPlanCategory && topicPlanCategory.name.trim().toLowerCase() !== categoryName.trim().toLowerCase()) {
                      setTopicPlanCategory(null);
                    }
                  }} placeholder="e.g. Java" maxLength={100} required />
                  <small className="field-hint">Topics are generated under this Category. A matching existing Category is reused when you create selected Topics.</small>
                </label>
                <label>
                  Target interview role
                  <input value={topicPlanTargetRole} onChange={(event) => setTopicPlanTargetRole(event.target.value)} placeholder="e.g. Senior Backend Engineer" required />
                  <small className="field-hint">Sets the expected interview scope and seniority. Question difficulty is configured separately.</small>
                </label>
                <label>
                  Topic guidance (optional)
                  <textarea
                    rows={3}
                    value={topicPlanGuidance}
                    onChange={(event) => setTopicPlanGuidance(event.target.value)}
                    placeholder="Focus on Java Collections. Include List, Set, Map, Queue/Deque, immutable and concurrent collections. Avoid Streams."
                  />
                  <small className="field-hint">Describe topics to include, exclude, emphasize, or organize. Leave blank to let AI choose based on the Category and target role.</small>
                </label>
                {topicPlanCategoryName.trim() && topics.some((item) => item.category.toLowerCase() === (topicPlanCategory?.name ?? topicPlanCategoryName.trim()).toLowerCase()) && (
                  <div className="topic-plan-existing">
                    <span className="field-label">Existing topics excluded from suggestions</span>
                    <p>{topics.filter((item) => item.category.toLowerCase() === (topicPlanCategory?.name ?? topicPlanCategoryName.trim()).toLowerCase()).map((item) => item.title).join(" · ")}</p>
                  </div>
                )}
                <fieldset className="focus-options">
                  <legend>Interview focus</legend>
                  {["Core knowledge", "Internals", "Performance", "Production scenarios", "Troubleshooting"].map((focus) => (
                    <label key={focus}>
                      <input
                        type="checkbox"
                        checked={topicPlanFocuses.includes(focus)}
                        onChange={() => setTopicPlanFocuses((current) => current.includes(focus) ? current.filter((item) => item !== focus) : [...current, focus])}
                      />
                      {focus}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Number of topics
                  <input
                    type="number"
                    min={1}
                    max={15}
                    step={1}
                    value={topicPlanTopicCount}
                    onChange={(event) => setTopicPlanTopicCount(Number(event.target.value))}
                    required
                  />
                  <small className="field-hint">Choose between 1 and 15 topics.</small>
                </label>
                <div className="actions question-form-actions">
                    <button className="primary" type="submit" disabled={isAiBusy}>{topicPlanLoading ? "Generating topics..." : "Generate topics with AI"}</button>
                </div>
              </form>
              {generatedTopicProposals.length > 0 && (
                <div className="plan-proposals">
                  <div className="generated-heading">
                    <h4>Suggested topics</h4>
                    {aiUsage?.totalTokens !== undefined && <span className="field-hint">Last call: {aiUsage.totalTokens} tokens</span>}
                  </div>
                  <p className="field-hint">Edit, select, and order these proposals before creating them in this category.</p>
                  {generatedTopicProposals.map((proposal, index) => (
                    <article className="plan-proposal" key={`${proposal.title}-${index}`}>
                      <div className="plan-proposal-heading">
                        <label className="generated-select">
                          <input type="checkbox" checked={selectedTopicProposalIndexes.includes(index)} onChange={() => setSelectedTopicProposalIndexes((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} />
                          <span className="eyebrow">Topic {index + 1}</span>
                        </label>
                        <div className="plan-proposal-actions" aria-label={`Manage suggested topic ${index + 1}`}>
                          <button type="button" aria-label="Move topic up" title="Move up" disabled={index === 0} onClick={() => moveTopicProposal(index, -1)}>↑</button>
                          <button type="button" aria-label="Move topic down" title="Move down" disabled={index === generatedTopicProposals.length - 1} onClick={() => moveTopicProposal(index, 1)}>↓</button>
                          <button type="button" title="Remove topic suggestion" onClick={() => removeTopicProposal(index)}>Remove</button>
                        </div>
                      </div>
                      <label>Title<input value={proposal.title} onChange={(event) => setGeneratedTopicProposals((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                      <label>Description<textarea rows={2} value={proposal.description} onChange={(event) => setGeneratedTopicProposals((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></label>
                    </article>
                  ))}
                  <div className="actions question-form-actions">
                    <button className="primary" type="button" disabled={!selectedTopicProposalIndexes.length || loading} onClick={saveTopicPlan}>Create selected topics</button>
                    <button type="button" disabled={loading} onClick={() => { setGeneratedTopicProposals([]); setSelectedTopicProposalIndexes([]); }}>Discard suggestions</button>
                  </div>
                </div>
              )}
            </section>
          )}
          {topic && !isTopicPlanOpen && (
            <>
              <div className="interview-heading">
                <div>
                  <p className="eyebrow">Question workspace</p>
                  <h3>Interview questions</h3>
                  <span className="interview-context">{topic.category} / {topic.title} · {topic.questions.length} questions · organize main questions and follow-ups</span>
                </div>
                <div className="question-actions">
                    <button className="primary" type="button" disabled={isAiBusy} onClick={() => focusAiGeneration("main")}>
                    Generate questions with AI
                  </button>
                  <button className="manual-action" type="button" onClick={() => startQuestionCreation(null)}>
                    <span aria-hidden="true">+</span>
                    Add question
                  </button>
                </div>
              </div>
              <label className="workspace-difficulty">
                <span>Question difficulty</span>
                <select value={selectedDifficulty} onChange={(event) => {
                  setSelectedDifficulty(event.target.value as Difficulty);
                  setGeneratedQuestions([]);
                  setMergedQuestion(null);
                  setSelectedGeneratedIndexes([]);
                  setIsAiPanelOpen(false);
                  setIsQuestionFormOpen(false);
                }} disabled={loading || isAiBusy}>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="EXPERT">Expert</option>
                </select>
                <small>Used when viewing, creating, and generating questions for this topic.</small>
              </label>
              <div className="question-filter-bar">
                <label className="search-field question-search">
                  <span>Find a question</span>
                  <input
                    type="search"
                    value={questionSearch}
                    onChange={(event) => setQuestionSearch(event.target.value)}
                    placeholder="Search questions and answers"
                  />
                </label>
                <div className="question-status-filter" role="group" aria-label="Filter questions by publishing status">
                  {(["ALL", ...QUESTION_STATUS_OPTIONS.map((status) => status.value)] as const).map((status) => (
                    <button
                      className={`question-status-filter-option${questionStatusFilter === status ? " selected" : ""}${status === "ALL" ? " status-all" : ` status-${status.toLowerCase()}`}`}
                      type="button"
                      aria-pressed={questionStatusFilter === status}
                      key={status}
                      onClick={() => {
                        setQuestionStatusFilter(status);
                        if (selectedQuestion && status !== "ALL" && selectedQuestion.status !== status) {
                          setSelectedQuestionId(null);
                          closeQuestionForm();
                        }
                      }}
                    >
                      {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()} <span>{questionStatusCounts[status]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div id="question-workspace" className={`question-workspace${isQuestionFormOpen ? " editing" : ""}`}>
                <QuestionTree
                  questions={orderedQuestions}
                  rootQuestions={rootQuestions}
                  selectedQuestionId={selectedQuestionId}
                  selectedSiblingIndex={selectedSiblingIndex}
                  selectedSiblingCount={selectedSiblings.length}
                  expandedQuestions={expandedQuestions}
                  revealedAnswers={revealedAnswers}
                  revealedExamples={revealedExamples}
                  revealedCodeSnippets={revealedCodeSnippets}
                  revealedTags={revealedTags}
                  isAiBusy={isAiBusy}
                  generatingDetailsFor={generatingDetailsFor}
                  isVisible={hasVisibleQuestion}
                  onSelect={(question, hasChildren) => {
                    closeQuestionForm();
                    setIsAiPanelOpen(false);
                    closeTopicPlan();
                    setSelectedQuestionId(question.id);
                    setAiGenerationMode(question.depth === 0 ? "main" : "follow-up");
                    if (hasChildren) setExpandedQuestions((current) => ({ ...current, [question.id]: true }));
                  }}
                  onDeselect={() => {
                    setSelectedQuestionId(null);
                    closeQuestionForm();
                    setIsAiPanelOpen(false);
                    closeTopicPlan();
                  }}
                  onToggleAnswer={(id) => setRevealedAnswers((current) => ({ ...current, [id]: !current[id] }))}
                  onToggleExample={(id) => setRevealedExamples((current) => ({ ...current, [id]: !current[id] }))}
                  onToggleCodeSnippet={(id) => setRevealedCodeSnippets((current) => ({ ...current, [id]: !current[id] }))}
                  onToggleTags={(id) => setRevealedTags((current) => ({ ...current, [id]: !current[id] }))}
                  onMove={moveQuestion}
                  onEdit={openQuestionEditor}
                  onImprove={improveQuestionWithAi}
                  onAddFollowUp={startQuestionCreation}
                  onGenerateFollowUps={() => focusAiGeneration("follow-up")}
                  onGenerateDetails={prepareDetailsGeneration}
                  onDelete={(question, childCount) => setDeleteConfirmation({ type: "question", id: question.id, title: question.question, childCount })}
                />
                  {!rootQuestions.some(hasVisibleQuestion) && (
                    <p className="muted">{topic.questions.length ? "No questions match your search and status filter." : "No questions yet. Start with a main question."}</p>
                  )}
                {isQuestionFormOpen && (
                  <form className={`question-form${isDetailsGeneration ? " details-mode" : ""}`} id="question-editor" onSubmit={(event) => {
                    if (isDetailsGeneration && !detailsGenerationReady) {
                      event.preventDefault();
                      return;
                    }
                    void handleQuestionSubmit(event);
                  }}>
                  <div className="question-form-heading">
                    <div>
                      <p className="eyebrow">{isDetailsGeneration ? "AI enrichment" : editingQuestionId ? "Editing saved question" : "Draft interview question"}</p>
                      <h3>{isDetailsGeneration ? "Add an example or code snippet" : editingQuestionId ? "Edit question" : questionForm.parentQuestionId ? "Add follow-up" : "Add main question"}</h3>
                    </div>
                  </div>
                  {isDetailsGeneration && selectedQuestion && (
                    <div className="details-generation-prompt">
                      <p><strong>{selectedQuestion.question}</strong><br />{selectedQuestion.answer}</p>
                      <fieldset className="detail-generation-options">
                        <legend>Generate</legend>
                        {detailGenerationModes.map((mode) => <label key={mode.value} className={detailGenerationMode === mode.value ? "selected" : ""}>
                          <input type="radio" name="detail-generation-mode" checked={detailGenerationMode === mode.value} onChange={() => { setDetailGenerationMode(mode.value); setDetailsGenerationReady(false); }} />
                          {mode.label}
                        </label>)}
                      </fieldset>
                      <label>
                        AI guidance <span className="field-hint">Optional · describe the scenario, style, or code you want</span>
                        <textarea rows={3} value={detailGenerationGuidance} onChange={(event) => { setDetailGenerationGuidance(event.target.value); setDetailsGenerationReady(false); }} placeholder="For example: use a production payment-service scenario and concise Java code." />
                      </label>
                    </div>
                  )}
                  <label className="normal-question-field">
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
                  <label className="normal-question-field">
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
                  {(!isDetailsGeneration || detailGenerationMode !== "CODE_ONLY") && <label>
                    Example <span className="field-hint">Optional · use a short realistic code or production scenario</span>
                    <textarea
                      id="question-example"
                      rows={5}
                      value={questionForm.example}
                      onChange={(event) => setQuestionForm({ ...questionForm, example: event.target.value })}
                    />
                  </label>}
                  {(!isDetailsGeneration || detailGenerationMode !== "EXAMPLE_ONLY") && <label>
                    Code snippet <span className="field-hint">Optional · add code only when it makes the answer clearer</span>
                    <textarea
                      rows={5}
                      value={questionForm.codeSnippet}
                      onChange={(event) => setQuestionForm({ ...questionForm, codeSnippet: event.target.value })}
                    />
                  </label>}
                  <label className="normal-question-field">
                    Tags <span className="field-hint">AI can suggest these · review and separate with commas</span>
                    <input
                      value={questionForm.tags.join(", ")}
                      placeholder="java, spring, concurrency"
                      onChange={(event) => setQuestionForm({ ...questionForm, tags: parseTags(event.target.value) })}
                    />
                  </label>
                  <label className="normal-question-field">
                    Difficulty
                    <select
                      value={questionForm.difficulty}
                      disabled={questionForm.parentQuestionId !== null}
                      onChange={(event) => setQuestionForm({ ...questionForm, difficulty: event.target.value as Difficulty })}
                    >
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                      <option value="EXPERT">Expert</option>
                    </select>
                    <small className="field-hint">
                      {questionForm.parentQuestionId !== null
                        ? "Follow-ups inherit their parent question's difficulty."
                        : "Changing this moves the question and its follow-ups to that level."}
                    </small>
                  </label>
                  <div className="normal-question-field"><QuestionStatusSelector
                    value={questionForm.status}
                    onChange={(status) => setQuestionForm({ ...questionForm, status })}
                    name="question-editor-status"
                  /></div>
                  <label className="normal-question-field">
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
                  <div className="actions question-form-actions">
                    {isDetailsGeneration ? <>
                      <button className={detailsGenerationReady ? undefined : "primary"} type="button" disabled={isAiBusy} onClick={() => selectedQuestion && void generateDetailsWithAi(selectedQuestion)}>
                        {generatingDetailsFor === selectedQuestion?.id ? "Generating..." : detailsGenerationReady ? "Generate again" : detailGenerationModes.find((mode) => mode.value === detailGenerationMode)?.label}
                      </button>
                      {detailsGenerationReady && <button className="primary" type="submit">Save details</button>}
                    </> : <button className="primary" type="submit">
                      {editingQuestionId ? "Save question" : "Add question"}
                    </button>}
                    <button type="button" onClick={cancelQuestionForm}>Cancel</button>
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
                <div className="category-heading">
                  <div>
                    <p className="eyebrow">AI assist</p>
                    <h3>{selectedQuestion && editingQuestionId !== null ? "Improve this question with AI" : aiGenerationMode === "follow-up" ? "Generate follow-up candidates" : "Generate questions with AI"}</h3>
                    <span>{selectedQuestion && editingQuestionId !== null ? `Review alternatives for: “${questionPreview(selectedQuestion.question)}”` : aiGenerationMode === "follow-up" && selectedQuestion ? `For: “${questionPreview(selectedQuestion.question)}” · candidates will be added beneath it` : aiGenerateAlternatives && aiCount === 1 ? "Compare two alternatives, choose one, or merge them into a combined result." : "Set the number of drafts to generate, then review before saving."}</span>
                  </div>
                </div>
                <form className="ai-form" onSubmit={generateQuestions}>
                  {selectedQuestion && editingQuestionId !== null && (
                    <div className="ai-edit-context">
                      <p className="field-hint">Current question</p>
                      <strong>{selectedQuestion.question}</strong>
                      <p className="field-hint">Current answer</p>
                      <p>{selectedQuestion.answer}</p>
                    </div>
                  )}
                  {selectedQuestion && aiGenerationMode === "follow-up" && editingQuestionId === null && (
                    <div className="ai-edit-context ai-follow-up-context">
                      <p className="field-hint">Follow-up for</p>
                      <strong>{selectedQuestion.question}</strong>
                      <p className="field-hint">Current answer</p>
                      <p>{selectedQuestion.answer}</p>
                    </div>
                  )}
                  {aiGenerationMode !== "follow-up" && editingQuestionId === null && rootQuestions.length > 0 && !aiIdea.trim() && (
                    <p className="field-hint">
                      {rootQuestions.length} existing initial question{rootQuestions.length === 1 ? "" : "s"} will be used to avoid duplicate coverage.
                    </p>
                  )}
                  <label>
                    {selectedQuestion && editingQuestionId !== null ? "How should AI improve it?" : aiGenerationMode === "follow-up" ? "Additional guidance (optional)" : "Idea (optional)"}
                    <textarea
                      rows={3}
                      id="ai-idea"
                      value={aiIdea}
                      onChange={(event) => setAiIdea(event.target.value)}
                      placeholder={selectedQuestion && editingQuestionId !== null ? "For example: Make the answer more conversational, simplify the explanation, or rewrite this as a senior-backend interview question." : selectedQuestion ? "Optional: ask about trade-offs, failure modes, or a production scenario." : "LongAdder and contention in Java concurrency"}
                    />
                    {aiGenerationMode !== "follow-up" && editingQuestionId === null && (
                      <small className="field-hint">Leave blank to use the current topic context. An idea takes priority and can intentionally overlap existing questions.</small>
                    )}
                  </label>
                  {selectedQuestion && editingQuestionId !== null && (
                    <div className="answer-improvement-options ai-answer-improvement-options" aria-label="Answer improvement options">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={questionImprovement.humanized} onChange={(event) => setQuestionImprovement((current) => ({ ...current, humanized: event.target.checked }))} />
                        Humanized
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={questionImprovement.shortened} onChange={(event) => setQuestionImprovement((current) => ({ ...current, shortened: event.target.checked }))} />
                        Shorten
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={questionImprovement.simplified} onChange={(event) => setQuestionImprovement((current) => ({ ...current, simplified: event.target.checked }))} />
                        Simplify
                      </label>
                    </div>
                  )}
                  <div className="ai-fields">
                    <label className="ai-field">
                      <span className="ai-field-label">Difficulty</span>
                      <select value={selectedDifficulty} disabled aria-label="AI difficulty inherited from the question workspace">
                        <option value="BEGINNER">Beginner</option>
                        <option value="INTERMEDIATE">Intermediate</option>
                        <option value="ADVANCED">Advanced</option>
                        <option value="EXPERT">Expert</option>
                      </select>
                      <small className="field-hint">Inherited from the question workspace.</small>
                    </label>
                    <label className="ai-field">
                      <span className="ai-field-label">Type</span>
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
                    {aiGenerationMode === "main" && editingQuestionId === null && (
                      <div className="ai-field question-count-field">
                        <span className="ai-field-label">Number of questions</span>
                        <div className="question-count-control">
                          <button type="button" aria-label="Generate one fewer question" onClick={() => { setAiCount((current) => current <= 1 ? maxBatchQuestionCount : current - 1); setAiGenerateAlternatives(false); }}>−</button>
                          <input type="number" min={1} max={maxBatchQuestionCount} aria-label="Number of questions" value={aiCount} onChange={(event) => { const nextCount = Number(event.target.value); setAiCount(nextCount); if (nextCount !== 1) setAiGenerateAlternatives(false); }} />
                          <button type="button" aria-label="Generate one more question" disabled={aiCount >= maxBatchQuestionCount} onClick={() => { setAiCount((current) => current + 1); setAiGenerateAlternatives(false); }}>+</button>
                        </div>
                        <small className="field-hint">Choose 1–10 drafts. One is fastest when you want a focused result.</small>
                        {aiCount === 1 && (
                          <label className="checkbox-label ai-alternatives-toggle">
                            <input type="checkbox" checked={aiGenerateAlternatives} onChange={(event) => setAiGenerateAlternatives(event.target.checked)} />
                            Generate two alternatives
                          </label>
                        )}
                      </div>
                    )}
                    {aiGenerationMode === "follow-up" && (
                      <div className="ai-field ai-alternatives-field">
                        <span className="ai-field-label">Options</span>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={aiGenerateAlternatives}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              setAiGenerateAlternatives(enabled);
                            }}
                          />
                          Generate alternatives
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="actions question-form-actions">
                    <button className="primary" type="submit" disabled={isAiBusy}>
                      {aiLoading ? "Generating..." : selectedQuestion && editingQuestionId !== null ? "Generate improvements with AI" : aiGenerationMode === "follow-up" ? "Generate follow-ups with AI" : aiCount > 1 ? "Generate questions" : "Generate question"}
                    </button>
                    <button type="button" disabled={isAiBusy} onClick={closeAiPanel}>Close</button>
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
                    <p className="field-hint">{isMultipleQuestionGeneration ? "Edit or remove drafts, select the questions you want, then save them together." : selectedQuestion && editingQuestionId !== null ? "Choose an alternative to review in the editor, then save it to update this question." : "Choose a candidate to load it into the editor. Review it there, then save the question."}</p>
                    <div className="generated-bulk-actions" role="group" aria-label="Bulk publishing status">
                      <span>Bulk publishing status</span>
                      <button
                        type="button"
                        aria-pressed={generatedQuestions.every((question) => question.status === "DRAFT")}
                        disabled={isAiBusy}
                        onClick={() => updateAllGeneratedQuestionStatuses("DRAFT")}
                      >
                        Mark all draft
                      </button>
                      <button
                        type="button"
                        aria-pressed={generatedQuestions.every((question) => question.status === "REVIEWED")}
                        disabled={isAiBusy}
                        onClick={() => updateAllGeneratedQuestionStatuses("REVIEWED")}
                      >
                        Mark all reviewed
                      </button>
                      <button
                        className="primary"
                        type="button"
                        aria-pressed={generatedQuestions.every((question) => question.status === "PUBLISHED")}
                        disabled={isAiBusy}
                        onClick={() => updateAllGeneratedQuestionStatuses("PUBLISHED")}
                      >
                        Publish all
                      </button>
                    </div>
                    {generatedQuestions.map((generated, index) => (
                      <article
                        className={`generated-question${improvingAnswers[generated.draftId] ? " generated-question-improving" : ""}`}
                        key={generated.draftId}
                        aria-busy={Boolean(improvingAnswers[generated.draftId])}
                      >
                        <label className="generated-select">
                          <input
                            type="checkbox"
                            checked={selectedGeneratedIndexes.includes(index)}
                            onChange={() => toggleGeneratedQuestion(index)}
                          />
                          <span className="eyebrow">Option {index + 1}</span>
                        </label>
                        {isMultipleQuestionGeneration ? (
                          <label className="generated-edit-field">
                            <span>Question</span>
                            <input value={generated.question} onChange={(event) => updateGeneratedQuestion(index, "question", event.target.value)} />
                          </label>
                        ) : <strong>{generated.question}</strong>}
                        <span className="candidate-meta">{generated.difficulty} · {generated.type} · {aiGenerationMode === "follow-up" && selectedQuestion ? `Level ${selectedQuestion.depth + 1}` : "Main question · Level 0"} · AI-assisted by {generated.generation.provider} ({generated.generation.model})</span>
                        <QuestionStatusSelector
                          compact
                          value={generated.status}
                          onChange={(status) => updateGeneratedQuestionStatus(generated.draftId, status)}
                          name={`generated-question-status-${generated.draftId}`}
                        />
                        {isMultipleQuestionGeneration ? (
                          <label className="generated-edit-field">
                            <span>Answer</span>
                            <textarea rows={5} value={generated.answer} onChange={(event) => updateGeneratedQuestion(index, "answer", event.target.value)} />
                          </label>
                        ) : <p>{generated.answer}</p>}
                        {isMultipleQuestionGeneration ? <>
                          <label className="generated-edit-field">
                            <span>Example</span>
                            <textarea rows={4} value={generated.example} onChange={(event) => updateGeneratedQuestion(index, "example", event.target.value)} />
                          </label>
                          <label className="generated-edit-field">
                            <span>Code snippet</span>
                            <textarea rows={4} value={generated.codeSnippet} onChange={(event) => updateGeneratedQuestion(index, "codeSnippet", event.target.value)} />
                          </label>
                          <label className="generated-edit-field">
                            <span>Tags</span>
                            <input value={generated.tags.join(", ")} onChange={(event) => updateGeneratedQuestion(index, "tags", event.target.value)} />
                          </label>
                        </> : <>
                          <p><strong>Example:</strong> {generated.example}</p>
                          <p><strong>Tags:</strong> {generated.tags.join(", ")}</p>
                          {generated.codeSnippet && <pre><code>{generated.codeSnippet}</code></pre>}
                        </>}
                        {aiGenerationMode === "follow-up" && editingQuestionId === null && (
                          <div className="answer-improvement">
                            <label className="answer-improvement-label">
                              <span>
                                Improve this answer
                                {answerImprovementCounts[generated.draftId] ? (
                                  <small className="answer-improvement-count">
                                    Improved {answerImprovementCounts[generated.draftId]}x
                                  </small>
                                ) : null}
                              </span>
                              <textarea
                                rows={3}
                                value={answerImprovements[generated.draftId]?.criteria ?? ""}
                                onChange={(event) => updateAnswerImprovement(generated.draftId, { criteria: event.target.value })}
                                placeholder="Optional: add a production example, clarify the trade-off, or make it more direct."
                              />
                            </label>
                            <div className="answer-improvement-options" aria-label={`Answer improvements for option ${index + 1}`}>
                              <label className="checkbox-label">
                                <input type="checkbox" checked={answerImprovements[generated.draftId]?.humanized ?? false} onChange={(event) => updateAnswerImprovement(generated.draftId, { humanized: event.target.checked })} />
                                Humanized
                              </label>
                              <label className="checkbox-label">
                                <input type="checkbox" checked={answerImprovements[generated.draftId]?.shortened ?? false} onChange={(event) => updateAnswerImprovement(generated.draftId, { shortened: event.target.checked })} />
                                Shorten
                              </label>
                              <label className="checkbox-label">
                                <input type="checkbox" checked={answerImprovements[generated.draftId]?.simplified ?? false} onChange={(event) => updateAnswerImprovement(generated.draftId, { simplified: event.target.checked })} />
                                Simplify
                              </label>
                            </div>
                            <div className="answer-improvement-actions">
                              <button className="compact-action" type="button" disabled={Boolean(improvingAnswers[generated.draftId])} onClick={() => void improveGeneratedAnswer(generated)}>
                                {improvingAnswers[generated.draftId] ? "Improving..." : "Improve answer"}
                              </button>
                              {improvingAnswers[generated.draftId] && (
                                <span className="answer-improvement-status" role="status">
                                  <span className="answer-improvement-spinner" aria-hidden="true" />
                                  Revising this answer...
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="actions">
                          {!isMultipleQuestionGeneration && <button className="primary" type="button" onClick={() => editGeneratedQuestion(generated)}>
                            {selectedQuestion && editingQuestionId !== null ? "Review and update" : "Use in editor"}
                          </button>}
                          <button
                            type="button"
                            className="primary candidate-save-action"
                            disabled={Boolean(savingGeneratedQuestions[generated.draftId])}
                            onClick={() => void saveGeneratedQuestion(generated)}
                          >
                            {savingGeneratedQuestions[generated.draftId] ? "Saving..." : "Save"}
                          </button>
                          {isMultipleQuestionGeneration && <button className="danger" type="button" onClick={() => removeGeneratedQuestion(index)}>Remove</button>}
                        </div>
                      </article>
                    ))}
                    {mergedQuestion && (
                      <article className="generated-question merged-question">
                        <span className="eyebrow">AI merged response</span>
                        <strong>{mergedQuestion.question}</strong>
                        <p>{mergedQuestion.answer}</p>
                        <span className="candidate-meta">AI-assisted by {mergedQuestion.generation.provider} ({mergedQuestion.generation.model})</span>
                        <div className="actions">
                          <button className="primary" type="button" onClick={() => editGeneratedQuestion(mergedQuestion)}>
                            Use in editor
                          </button>
                        </div>
                      </article>
                    )}
                    <div className="actions generated-actions">
                      {isMultipleQuestionGeneration ? <>
                        <button type="button" disabled={isAiBusy || selectedGeneratedIndexes.length !== 2} onClick={mergeSelectedQuestions}>
                          {aiLoading ? "Merging..." : "Merge selected"}
                        </button>
                        <button type="button" disabled={isAiBusy || selectedGeneratedIndexes.length === 0} onClick={saveSelectedGeneratedQuestions}>
                          {aiLoading ? "Saving..." : `Save selected (${selectedGeneratedIndexes.length})`}
                        </button>
                        <button className="primary" type="button" disabled={isAiBusy} onClick={() => void saveGeneratedQuestions(generatedQuestions)}>
                          {aiLoading ? "Saving..." : `Save all (${generatedQuestions.length})`}
                        </button>
                        <button type="button" disabled={isAiBusy} onClick={discardGeneratedQuestions}>Discard</button>
                      </> : <>
                        <button type="button" onClick={mergeSelectedQuestions} disabled={isAiBusy || selectedGeneratedIndexes.length !== 2}>
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
                      </>}
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
      {showScrollTop && (
        <button
          className="back-to-top"
          type="button"
          aria-label="Back to top"
          title="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <span aria-hidden="true">↑</span>
        </button>
      )}
      <DeleteConfirmationDialog
        key={deleteConfirmation ? `${deleteConfirmation.type}:${deleteConfirmation.type === "topic" ? deleteConfirmation.slug : deleteConfirmation.id}` : "closed"}
        confirmation={deleteConfirmation}
        loading={loading}
        onCancel={() => setDeleteConfirmation(null)}
        onConfirm={() => {
          if (deleteConfirmation?.type === "topic") void deleteTopic();
          if (deleteConfirmation?.type === "question") void deleteQuestion(deleteConfirmation.id);
        }}
      />
    </main>
  );
}

export default AdminWorkspace;

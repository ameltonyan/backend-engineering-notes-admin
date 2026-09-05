import { useEffect, useState, type FormEvent } from "react";
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
  question: string;
  answer: string;
  displayOrder: number;
};
type Page = PageSummary & { questions: Question[] };
type PageForm = {
  slug: string;
  title: string;
  section: string;
  displayOrder: number;
};
type QuestionForm = { question: string; answer: string; displayOrder: number };

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

async function request(
  path: string,
  options: RequestInit = {},
  credentials = readCredentials(),
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(credentials ? { Authorization: `Basic ${credentials}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401)
      throw new Error("Invalid admin username or password");
    if (response.status === 403)
      throw new Error("Admin access was rejected. Sign out and sign in again.");
    if (response.status === 409)
      throw new Error(
        "A page with this slug already exists. Choose a different slug.",
      );
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
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
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);

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
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const visibleQuestions = orderedQuestions.filter((item) =>
    [item.question, item.answer].some((value) =>
      value.toLowerCase().includes(normalizedQuestionSearch),
    ),
  );

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
    setLoading(true);
    Promise.all([loadPages(), loadSections()])
      .catch((err: Error) => {
        sessionStorage.removeItem(credentialsKey);
        setCredentials("");
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [credentials]);

  useEffect(() => {
    if (!credentials || !selectedSlug) return;
    setIsQuestionFormOpen(false);
    setEditingQuestionId(null);
    setQuestionForm({ question: "", answer: "", displayOrder: 0 });
    loadPage(selectedSlug).catch((err: Error) => setError(err.message));
  }, [credentials, selectedSlug]);

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
      setError((err as Error).message);
    }
  };

  const handlePageSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
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
            slug: pageForm.slug,
            title: pageForm.title,
            sectionId: section.id,
            displayOrder: pageForm.displayOrder,
          }
        : {
            title: pageForm.title,
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
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!page) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const path = editingQuestionId
        ? `/api/admin/questions/${editingQuestionId}`
        : `/api/admin/pages/${encodeURIComponent(page.slug)}/questions`;
      await request(path, {
        method: editingQuestionId ? "PUT" : "POST",
        body: JSON.stringify(questionForm),
      });
      setQuestionForm({ question: "", answer: "", displayOrder: 0 });
      setEditingQuestionId(null);
      await loadPage(page.slug);
      setNotice(editingQuestionId ? "Question updated" : "Question added");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async (questionId: number) => {
    if (!page || !window.confirm("Delete this question?")) return;
    await request(`/api/admin/questions/${questionId}`, { method: "DELETE" });
    await loadPage(page.slug);
    setNotice("Question deleted");
  };

  const moveQuestion = async (questionId: number, direction: -1 | 1) => {
    if (!page) return;
    const currentIndex = orderedQuestions.findIndex((item) => item.id === questionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedQuestions.length) return;

    const reorderedQuestionIds = orderedQuestions.map((question) => question.id);
    const [movedQuestionId] = reorderedQuestionIds.splice(currentIndex, 1);
    reorderedQuestionIds.splice(targetIndex, 0, movedQuestionId);
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
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const deletePage = async () => {
    if (!page || !window.confirm(`Delete ${page.title}?`)) return;
    await request(`/api/admin/pages/${encodeURIComponent(page.slug)}`, {
      method: "DELETE",
    });
    setPage(null);
    setSelectedSlug("");
    setNotice("Page deleted");
    await loadPages();
  };

  if (!credentials) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <p className="eyebrow">Backend Engineering Notes</p>
          <h1>Content control room</h1>
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
          <div className="list-heading">
            <div>
              <h2>Pages</h2>
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
        <section className="editor">
          <div className="editor-heading">
            <div>
              <p className="eyebrow">{page ? "Editing page" : "New page"}</p>
              <h2>{page?.title ?? "Create your first page"}</h2>
            </div>
            {page && (
              <button className="danger" type="button" onClick={deletePage}>
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
                  onChange={(event) =>
                    setPageForm({
                      ...pageForm,
                      section: event.target.value,
                      ...(page || slugWasEdited
                        ? {}
                        : { slug: generateSlug(event.target.value, pageForm.title) }),
                    })
                  }
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
              </label>
              <label>
                Title
                <input
                  value={pageForm.title}
                  onChange={(event) =>
                    setPageForm({
                      ...pageForm,
                      title: event.target.value,
                      ...(page || slugWasEdited
                        ? {}
                        : { slug: generateSlug(pageForm.section, event.target.value) }),
                    })
                  }
                  required
                />
              </label>
              <label>
                Slug
                <input
                  value={pageForm.slug}
                  disabled={Boolean(page)}
                  onChange={(event) => {
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
              <div className="section-heading">
                <div>
                  <h3>Questions and answers</h3>
                  <span>{page.questions.length} items</span>
                </div>
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    setEditingQuestionId(null);
                    setIsQuestionFormOpen(true);
                    setQuestionForm({
                      question: "",
                      answer: "",
                      displayOrder: Math.max(
                        -1,
                        ...page.questions.map((question) => question.displayOrder),
                      ) + 1,
                    });
                  }}
                >
                  Add question
                </button>
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
              {isQuestionFormOpen && (
                <form className="question-form" onSubmit={handleQuestionSubmit}>
                  <div className="question-form-heading">
                    <h3>{editingQuestionId ? "Edit question" : "Add question"}</h3>
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
                      value={questionForm.question}
                      onChange={(event) =>
                        setQuestionForm({
                          ...questionForm,
                          question: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Answer
                    <textarea
                      rows={8}
                      value={questionForm.answer}
                      onChange={(event) =>
                        setQuestionForm({
                          ...questionForm,
                          answer: event.target.value,
                        })
                      }
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
                          displayOrder: 0,
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <div className="questions">
                {visibleQuestions.map((item) => {
                  const isExpanded = Boolean(expandedQuestions[item.id]);
                  const questionIndex = orderedQuestions.findIndex(
                    (question) => question.id === item.id,
                  );
                  return (
                    <article className="question" key={item.id}>
                      <button
                        className="question-toggle"
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedQuestions((current) => ({
                            ...current,
                            [item.id]: !current[item.id],
                          }))
                        }
                      >
                        <span className="question-summary">
                          <strong>{item.question}</strong>
                          <span>Order {item.displayOrder}</span>
                        </span>
                        <span className="question-chevron" aria-hidden="true">
                          {isExpanded ? "−" : "+"}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="question-body">
                          <p>{item.answer}</p>
                          <div className="actions">
                            <div className="order-actions" aria-label="Change question order">
                              <button
                                type="button"
                                aria-label="Move question up"
                                title="Move up"
                                disabled={questionIndex === 0}
                                onClick={() => moveQuestion(item.id, -1)}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label="Move question down"
                                title="Move down"
                                disabled={questionIndex === orderedQuestions.length - 1}
                                onClick={() => moveQuestion(item.id, 1)}
                              >
                                ↓
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuestionId(item.id);
                                setIsQuestionFormOpen(true);
                                setExpandedQuestions((current) => ({ ...current, [item.id]: true }));
                                setQuestionForm({
                                  question: item.question,
                                  answer: item.answer,
                                  displayOrder: item.displayOrder,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="danger"
                              type="button"
                              onClick={() => deleteQuestion(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {!visibleQuestions.length && (
                <p className="muted">
                  {page.questions.length ? "No questions match your search." : "No questions yet."}
                </p>
              )}
            </>
          )}
          {loading && <p className="muted">Saving...</p>}
          {notice && <p className="notice">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      </div>
    </main>
  );
}

export default App;

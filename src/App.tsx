import { useEffect, useState, type FormEvent } from "react";
import "./App.css";

type PageSummary = {
  slug: string;
  title: string;
  section: string;
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

  const loadPages = async () => {
    const list = (await request("/api/admin/pages")) as PageSummary[];
    setPages(
      list.sort((left, right) => left.displayOrder - right.displayOrder),
    );
    if (!selectedSlug && list[0]) setSelectedSlug(list[0].slug);
  };

  const loadPage = async (slug: string) => {
    const loaded = (await request(
      `/api/pages/${encodeURIComponent(slug)}`,
    )) as Page;
    setPage(loaded);
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
    loadPages()
      .catch((err: Error) => {
        sessionStorage.removeItem(credentialsKey);
        setCredentials("");
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [credentials]);

  useEffect(() => {
    if (!credentials || !selectedSlug) return;
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
      const result = (await request(
        isNew
          ? "/api/admin/pages"
          : `/api/admin/pages/${encodeURIComponent(page.slug)}`,
        {
          method: isNew ? "POST" : "PUT",
          body: JSON.stringify(
            isNew
              ? pageForm
              : {
                  title: pageForm.title,
                  section: pageForm.section,
                  displayOrder: pageForm.displayOrder,
                },
          ),
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
            <h2>Pages</h2>
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
          {pages.map((item) => (
            <button
              className={
                item.slug === selectedSlug ? "page-item active" : "page-item"
              }
              key={item.slug}
              type="button"
              onClick={() => setSelectedSlug(item.slug)}
            >
              <strong>{item.title}</strong>
              <span>
                {item.section} · {item.slug}
              </span>
            </button>
          ))}
          {!pages.length && <p className="muted">No pages yet.</p>}
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
                Section
                <input
                  value={pageForm.section}
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
                <small className="field-hint">
                  Can be reused, for example <code>Java</code>.
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
                <h3>Questions and answers</h3>
                <span>{page.questions.length} items</span>
              </div>
              <div className="questions">
                {page.questions.map((item) => (
                  <article className="question" key={item.id}>
                    <div>
                      <h4>{item.question}</h4>
                      <p>{item.answer}</p>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestionId(item.id);
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
                  </article>
                ))}
              </div>
              <form className="question-form" onSubmit={handleQuestionSubmit}>
                <h3>{editingQuestionId ? "Edit question" : "Add question"}</h3>
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
                  {editingQuestionId && (
                    <button
                      type="button"
                      onClick={() => {
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
                  )}
                </div>
              </form>
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

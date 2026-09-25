import type { TopicSummary, Category } from "./types";
import type { Difficulty } from "../questions/types";

type Props = {
  topics: TopicSummary[];
  categories: Category[];
  topicsByCategory: [string, TopicSummary[]][];
  selectedSlug: string;
  search: string;
  collapsedCategories: Record<string, boolean>;
  createMenuOpen: boolean;
  loading: boolean;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onSearchChange: (value: string) => void;
  onToggleCreateMenu: () => void;
  onNewTopic: () => void;
  onNewTopicPlan: () => void;
  onOpenStudyProgram: () => void;
  onToggleCategory: (category: string) => void;
  onSelectTopic: (slug: string) => void;
  onMoveCategory: (categoryId: number, direction: -1 | 1) => void;
  onMoveTopic: (categoryId: number, topics: TopicSummary[], slug: string, direction: -1 | 1) => void;
  onOpenTopicPlan: (category: Category) => void;
};

function ContentLibrary({
  topics, categories, topicsByCategory, selectedSlug, search, collapsedCategories, createMenuOpen, loading, difficulty,
  onDifficultyChange,
  onSearchChange, onToggleCreateMenu, onNewTopic, onNewTopicPlan, onOpenStudyProgram, onToggleCategory,
  onSelectTopic, onMoveCategory, onMoveTopic, onOpenTopicPlan,
}: Props) {
  return (
    <aside className="topic-list">
      <div className="list-heading">
        <div className="content-list-title"><h2>Content library</h2><span className="list-count">{topics.length} {topics.length === 1 ? "topic" : "topics"}</span></div>
        <div className="create-content-actions">
          <button type="button" onClick={onToggleCreateMenu} disabled={loading}>New content</button>
          {createMenuOpen && <div className="create-content-menu" role="menu">
            <button type="button" role="menuitem" onClick={onNewTopic}><strong>New topic</strong><span>Write one topic yourself</span></button>
            <button type="button" role="menuitem" onClick={onNewTopicPlan}><strong>Generate topics with AI</strong><span>Create and review a topic plan</span></button>
            <button type="button" role="menuitem" onClick={onOpenStudyProgram}><strong>Weekly study program</strong><span>Publish a seven-day interview practice plan</span></button>
          </div>}
        </div>
      </div>
      <label className="content-level-filter">
        <span>Content difficulty</span>
        <select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as Difficulty)} disabled={loading}>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="EXPERT">Expert</option>
        </select>
        <small>Questions shown and newly created use this level.</small>
      </label>
      <label className="search-field"><span>Find a topic</span><input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Title, slug, or category" /></label>
      <div className="topic-list-scroll" aria-label="Content topics">
      {topicsByCategory.map(([category, categoryTopics]) => {
        const currentCategory = categories.find((item) => item.name === category);
        const categoryIndex = currentCategory ? categories.findIndex((item) => item.id === currentCategory.id) : -1;
        return <div className="topic-category-group" key={category}>
          <div className="category-heading-row">
            {currentCategory && <button className="category-toggle" type="button" title={category} aria-expanded={!collapsedCategories[category]} onClick={() => onToggleCategory(category)}><span className="topic-category-title">{category}</span><span className="category-count">{categoryTopics.length}</span></button>}
            {currentCategory && <div className="category-order-actions" aria-label={`Manage ${category} category`}>
              <button type="button" aria-label={`Move ${category} up`} title="Move category up" disabled={categoryIndex <= 0 || loading} onClick={() => onMoveCategory(currentCategory.id, -1)}>↑</button>
              <button type="button" aria-label={`Move ${category} down`} title="Move category down" disabled={categoryIndex >= categories.length - 1 || loading} onClick={() => onMoveCategory(currentCategory.id, 1)}>↓</button>
              <button type="button" aria-label={`Generate topics for ${category}`} title="Generate topics with AI" disabled={loading} onClick={() => onOpenTopicPlan(currentCategory)}>✦</button>
            </div>}
          </div>
          {!collapsedCategories[category] && categoryTopics.map((item, topicIndex) => <div className={item.slug === selectedSlug ? "topic-item active" : "topic-item"} key={item.slug}>
            <button type="button" className="topic-select" title={`Slug: ${item.slug}`} aria-label={`${item.title}. Slug: ${item.slug}`} onClick={() => onSelectTopic(item.slug)}><span className="topic-index" aria-hidden="true">{String(topicIndex + 1).padStart(2, "0")}</span><span className="topic-item-copy"><strong>{item.title}</strong><small>{item.slug}</small></span></button>
            {item.slug === selectedSlug && currentCategory && <div className="topic-order-actions" aria-label={`Change ${item.title} topic order`}>
              <button type="button" aria-label={`Move ${item.title} up`} title="Move topic up" disabled={topicIndex === 0 || loading} onClick={() => onMoveTopic(currentCategory.id, categoryTopics, item.slug, -1)}>↑</button>
              <button type="button" aria-label={`Move ${item.title} down`} title="Move topic down" disabled={topicIndex === categoryTopics.length - 1 || loading} onClick={() => onMoveTopic(currentCategory.id, categoryTopics, item.slug, 1)}>↓</button>
            </div>}
          </div>)}
        </div>;
      })}
      {!topics.length && <p className="muted">No topics yet.</p>}
      {topics.length > 0 && !topicsByCategory.length && <p className="muted">No topics match your search.</p>}
      </div>
    </aside>
  );
}

export default ContentLibrary;

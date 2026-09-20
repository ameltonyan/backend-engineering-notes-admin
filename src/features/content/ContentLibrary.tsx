import type { PageSummary, Section } from "./types";

type Props = {
  pages: PageSummary[];
  sections: Section[];
  pagesBySection: [string, PageSummary[]][];
  selectedSlug: string;
  search: string;
  collapsedSections: Record<string, boolean>;
  createMenuOpen: boolean;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onToggleCreateMenu: () => void;
  onNewPage: () => void;
  onNewTopicPlan: () => void;
  onOpenStudyProgram: () => void;
  onToggleSection: (section: string) => void;
  onSelectPage: (slug: string) => void;
  onMoveSection: (sectionId: number, direction: -1 | 1) => void;
  onMovePage: (sectionId: number, pages: PageSummary[], slug: string, direction: -1 | 1) => void;
  onOpenTopicPlan: (section: Section) => void;
};

function ContentLibrary({
  pages, sections, pagesBySection, selectedSlug, search, collapsedSections, createMenuOpen, loading,
  onSearchChange, onToggleCreateMenu, onNewPage, onNewTopicPlan, onOpenStudyProgram, onToggleSection,
  onSelectPage, onMoveSection, onMovePage, onOpenTopicPlan,
}: Props) {
  return (
    <aside className="page-list">
      <div className="list-heading">
        <div className="topic-list-title"><h2>Content library</h2><span className="list-count">{pages.length} {pages.length === 1 ? "page" : "pages"}</span></div>
        <div className="create-content-actions">
          <button type="button" onClick={onToggleCreateMenu} disabled={loading}>New content</button>
          {createMenuOpen && <div className="create-content-menu" role="menu">
            <button type="button" role="menuitem" onClick={onNewPage}><strong>New page</strong><span>Write one page yourself</span></button>
            <button type="button" role="menuitem" onClick={onNewTopicPlan}><strong>New page with AI</strong><span>Generate and review several pages</span></button>
            <button type="button" role="menuitem" onClick={onOpenStudyProgram}><strong>Weekly study program</strong><span>Publish a seven-day interview practice plan</span></button>
          </div>}
        </div>
      </div>
      <label className="search-field"><span>Find a page</span><input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Title, slug, or section" /></label>
      <div className="page-list-scroll" aria-label="Content pages">
      {pagesBySection.map(([section, sectionPages]) => {
        const currentSection = sections.find((item) => item.name === section);
        const sectionIndex = currentSection ? sections.findIndex((item) => item.id === currentSection.id) : -1;
        return <div className="page-section-group" key={section}>
          <div className="section-heading-row">
            {currentSection && <button className="section-toggle" type="button" title={section} aria-expanded={!collapsedSections[section]} onClick={() => onToggleSection(section)}><span className="page-section-title">{section}</span><span className="section-count">{sectionPages.length}</span></button>}
            {currentSection && <div className="section-order-actions" aria-label={`Manage ${section} section`}>
              <button type="button" aria-label={`Move ${section} up`} title="Move section up" disabled={sectionIndex <= 0 || loading} onClick={() => onMoveSection(currentSection.id, -1)}>↑</button>
              <button type="button" aria-label={`Move ${section} down`} title="Move section down" disabled={sectionIndex >= sections.length - 1 || loading} onClick={() => onMoveSection(currentSection.id, 1)}>↓</button>
              <button type="button" aria-label={`Generate pages for ${section}`} title="Generate pages with AI" disabled={loading} onClick={() => onOpenTopicPlan(currentSection)}>✦</button>
            </div>}
          </div>
          {!collapsedSections[section] && sectionPages.map((item, pageIndex) => <div className={item.slug === selectedSlug ? "page-item active" : "page-item"} key={item.slug}>
            <button type="button" className="page-select" title={`Slug: ${item.slug}`} aria-label={`${item.title}. Slug: ${item.slug}`} onClick={() => onSelectPage(item.slug)}><span className="page-index" aria-hidden="true">{String(pageIndex + 1).padStart(2, "0")}</span><strong>{item.title}</strong></button>
            {item.slug === selectedSlug && currentSection && <div className="page-order-actions" aria-label={`Change ${item.title} page order`}>
              <button type="button" aria-label={`Move ${item.title} up`} title="Move page up" disabled={pageIndex === 0 || loading} onClick={() => onMovePage(currentSection.id, sectionPages, item.slug, -1)}>↑</button>
              <button type="button" aria-label={`Move ${item.title} down`} title="Move page down" disabled={pageIndex === sectionPages.length - 1 || loading} onClick={() => onMovePage(currentSection.id, sectionPages, item.slug, 1)}>↓</button>
            </div>}
          </div>)}
        </div>;
      })}
      {!pages.length && <p className="muted">No pages yet.</p>}
      {pages.length > 0 && !pagesBySection.length && <p className="muted">No pages match your search.</p>}
      </div>
    </aside>
  );
}

export default ContentLibrary;

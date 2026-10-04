import { useEffect, useRef, useState } from "react";
import type { Category } from "./types";

type Props = {
  id: string;
  value: string;
  categories: Category[];
  onChange: (value: string) => void;
};

export default function CategoryNameInput({ id, value, categories, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterByInput, setFilterByInput] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const query = value.trim().toLowerCase();
  const matches = categories.filter((category) => !filterByInput || category.name.toLowerCase().includes(query));
  const isExpanded = isOpen && matches.length > 0;
  const listId = `${id}-suggestions`;

  useEffect(() => {
    if (isExpanded && activeIndex >= 0) {
      optionsRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isExpanded]);

  const selectCategory = (category: Category) => {
    onChange(category.name);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="category-name-input" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }}>
      <input
        ref={inputRef}
        id={id}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? listId : undefined}
        aria-activedescendant={isExpanded && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="Choose or enter a category"
        maxLength={100}
        required
        onFocus={() => { setIsOpen(true); setFilterByInput(false); setActiveIndex(-1); }}
        onChange={(event) => {
          onChange(event.target.value);
          setFilterByInput(true);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            if (!isExpanded) {
              setFilterByInput(false);
              setActiveIndex(event.key === "ArrowDown" ? 0 : categories.length - 1);
            } else {
              setActiveIndex((current) => event.key === "ArrowDown"
                ? Math.min(current + 1, matches.length - 1)
                : current < 0 ? matches.length - 1 : Math.max(current - 1, 0));
            }
          } else if (event.key === "Enter" && isExpanded && matches[activeIndex]) {
            event.preventDefault();
            selectCategory(matches[activeIndex]);
          } else if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
      />
      {categories.length > 0 && <button
        type="button"
        className="category-name-toggle"
        aria-label={isExpanded ? "Hide category suggestions" : "Show category suggestions"}
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          setFilterByInput(false);
          setIsOpen(!isExpanded);
          setActiveIndex(-1);
        }}
      ><span aria-hidden="true">▾</span></button>}
      {isExpanded && <div className="category-name-options" id={listId} role="listbox" aria-label="Existing categories" ref={optionsRef}>
        {matches.map((category, index) => <button
          key={category.id}
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={index === activeIndex ? "active" : ""}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectCategory(category)}
        >{category.name}</button>)}
      </div>}
    </div>
  );
}

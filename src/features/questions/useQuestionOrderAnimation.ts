import { useEffect, useLayoutEffect, useRef } from "react";

export function useQuestionOrderAnimation(orderKey: string) {
  const treeRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const previousOrder = useRef<string | null>(null);
  const animations = useRef(new Set<Animation>());

  const measurePositions = () => new Map(
    Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-question-id]") ?? [])
      .map((node) => [node.dataset.questionId!, node.getBoundingClientRect().top + window.scrollY]),
  );

  // Capture the visible positions before a click/drop, including any animation in progress.
  const capturePositions = () => { positions.current = measurePositions(); };

  useLayoutEffect(() => {
    const orderChanged = previousOrder.current !== null && previousOrder.current !== orderKey;
    if (!orderChanged && animations.current.size) return;
    if (orderChanged) {
      animations.current.forEach((animation) => animation.cancel());
      animations.current.clear();
    }
    const oldPositions = positions.current;
    const newPositions = measurePositions();
    positions.current = newPositions;
    previousOrder.current = orderKey;
    if (!orderChanged || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = treeRef.current?.querySelectorAll<HTMLElement>("[data-question-id]") ?? [];
    for (const node of nodes) {
      const id = node.dataset.questionId!;
      const before = oldPositions.get(id);
      const after = newPositions.get(id);
      if (before === undefined || after === undefined || typeof node.animate !== "function") continue;
      const parentId = node.parentElement?.closest<HTMLElement>("[data-question-id]")?.dataset.questionId;
      const parentBefore = parentId ? oldPositions.get(parentId) : undefined;
      const parentAfter = parentId ? newPositions.get(parentId) : undefined;
      // Moving a parent already moves its follow-ups; avoid applying that movement twice.
      const parentOffset = parentBefore !== undefined && parentAfter !== undefined ? parentBefore - parentAfter : 0;
      const offset = before - after - parentOffset;
      if (Math.abs(offset) < 1) continue;
      const animation = node.animate([
        { transform: `translateY(${offset}px)` },
        { transform: "translateY(0)" },
      ], { duration: 320, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      animations.current.add(animation);
      const removeAnimation = () => { animations.current.delete(animation); };
      animation.onfinish = removeAnimation;
      animation.oncancel = removeAnimation;
    }
  });

  useEffect(() => {
    const activeAnimations = animations.current;
    return () => {
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations.clear();
    };
  }, []);

  return { treeRef, capturePositions };
}

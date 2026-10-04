import { useEffect } from "react";

// Marks elements carrying [data-reveal] as visible once they scroll into the
// viewport. Call again (via the dependency) after dynamic content renders.
export function useReveal(dependency: unknown = null) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.revealed)")
    );
    if (elements.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [dependency]);
}

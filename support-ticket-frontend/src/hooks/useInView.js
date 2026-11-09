import { useEffect, useRef, useState } from 'react';

const DEFAULT_OPTIONS = { threshold: 0.15, rootMargin: '0px 0px -40px 0px' };

// Fires once when the element first scrolls into the viewport, then
// disconnects - used to drive one-shot "reveal on scroll" animations
// rather than a library, since all we need is a boolean flip at the
// right moment. Re-triggering on every scroll back into view would read
// as flickery rather than polished, so this intentionally doesn't reset.
export function useInView(options = DEFAULT_OPTIONS) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // Respect reduced-motion users by just marking everything visible
    // immediately instead of animating anything in.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, isInView];
}

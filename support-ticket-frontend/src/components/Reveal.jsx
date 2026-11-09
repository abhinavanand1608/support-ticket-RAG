import { useInView } from '../hooks/useInView';

// Wraps any content in a fade + slide-up transition that plays once,
// the first time it scrolls into view. `delay` (ms) lets a group of
// siblings (e.g. a row of stat cards) stagger in one after another
// instead of all animating simultaneously.
export default function Reveal({ children, delay = 0, className = '' }) {
  const [ref, isInView] = useInView();

  return (
    <div
      ref={ref}
      className={`reveal${isInView ? ' reveal--visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: isInView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

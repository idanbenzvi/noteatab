// Adapted from React Bits <SpotlightCard /> (mouse-follow spotlight).
import { useRef, type ReactNode, type MouseEvent } from 'react';

interface Props { children: ReactNode; className?: string; spotlight?: string }

export default function SpotlightCard({ children, className = '', spotlight = 'rgba(242,184,75,0.10)' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spot-card ${className}`} style={{ ['--spot' as any]: spotlight }}>
      <div className="spot-glow" />
      {children}
    </div>
  );
}

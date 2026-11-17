// Adapted from React Bits <GradientText /> (animated gradient text).
import type { ReactNode } from 'react';

export default function GradientText({ children, colors = ['#f2b84b', '#ff8a65', '#4fd1c5', '#f2b84b'], speed = 8 }:
  { children: ReactNode; colors?: string[]; speed?: number }) {
  return (
    <span className="gradient-text"
      style={{ backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`, animationDuration: `${speed}s` }}>
      {children}
    </span>
  );
}

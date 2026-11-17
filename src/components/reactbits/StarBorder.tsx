// Adapted from React Bits <StarBorder />: a button wrapped by two glowing "stars" that orbit its border.
import type { ElementType, ReactNode, ComponentPropsWithoutRef } from 'react';

type Props<T extends ElementType> = {
  as?: T; className?: string; color?: string; speed?: string; thickness?: number; children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children' | 'color'>;

export default function StarBorder<T extends ElementType = 'button'>({
  as, className = '', color = '#f2b84b', speed = '6s', thickness = 1, children, ...rest
}: Props<T>) {
  const Tag = (as || 'button') as ElementType;
  return (
    <Tag className={`star-border ${className}`} style={{ padding: `${thickness}px 0` }} {...rest}>
      <div className="star-bottom" style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }} />
      <div className="star-top" style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }} />
      <div className="star-inner">{children}</div>
    </Tag>
  );
}

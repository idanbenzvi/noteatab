import type { ReactNode } from 'react';
import SpotlightCard from '../reactbits/SpotlightCard';
import Narrate from '../Narrate';

/** Standard card for a Theory section: eyebrow, title, optional narration pill. */
export default function TCard({ eyebrow, title, narrate, children, spotlight, className = '' }: {
  eyebrow: string; title: string; narrate?: string; children: ReactNode; spotlight?: string; className?: string;
}) {
  return (
    <SpotlightCard className={`card tcard ${className}`} spotlight={spotlight}>
      <header className="card-head">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        {narrate && <Narrate id={narrate} />}
      </header>
      {children}
    </SpotlightCard>
  );
}

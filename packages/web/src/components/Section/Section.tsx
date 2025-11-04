import { ReactNode } from 'react';
import './Section.css';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3;
}

export function Section({
  title,
  description,
  children,
  columns = 2,
}: SectionProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        {description && <p className="section-description">{description}</p>}
      </div>
      <div className={`section-content section-content--${columns}col`}>
        {children}
      </div>
    </div>
  );
}

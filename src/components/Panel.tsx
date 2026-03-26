import * as React from 'react';
import { cn } from '../lib/utils';

type PanelProps = React.PropsWithChildren<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}>;

export function Panel({ title, description, actions, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cn('bg-panel', className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border/70 px-3 py-2.5">
        <div className="space-y-0.5">
          <h2 className="text-[13px] font-medium tracking-tight text-foreground">{title}</h2>
          {description ? <p className="max-w-[40ch] text-[11px] leading-4 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

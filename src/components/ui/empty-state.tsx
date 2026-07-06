import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
        <ClipboardList size={22} />
      </div>
      <h3 className="mt-4 text-base font-medium text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

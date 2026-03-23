import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export function JobStatusBadge({ status, className }: { status: JobStatus, className?: string }) {
  const variants: Record<JobStatus, { bg: string, text: string, dot: string, label: string }> = {
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-500", dot: "bg-yellow-500", label: "Pending Setup" },
    processing: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary animate-pulse", label: "Pipeline Active" },
    completed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", label: "Completed" },
    failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", label: "Failed" }
  };

  const config = variants[status] || variants.pending;

  return (
    <Badge variant="outline" className={cn(`px-2.5 py-1 border-white/5 font-medium ${config.bg} ${config.text}`, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-2", config.dot)} />
      {config.label}
    </Badge>
  );
}

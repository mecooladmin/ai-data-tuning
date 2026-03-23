import { Link } from "wouter";
import { Activity, Cpu } from "lucide-react";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="p-2 rounded-lg bg-accent border border-primary/20 group-hover:bg-primary/10 group-hover:border-primary/40 transition-colors">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-foreground flex items-center gap-1">
              Doc<span className="text-primary">Pipeline</span>
            </h1>
          </div>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Systems Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useListJobs } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Files, ArrowRight, ServerCrash, Loader2, Cpu } from "lucide-react";

export function Home() {
  const { data, isLoading, isError } = useListJobs();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      {/* Subtle top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 to-background" />
      </div>

      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 z-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-foreground">Active Pipelines</h1>
            <p className="text-lg text-muted-foreground">Manage your document intelligence extraction tasks.</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all"
          >
            <Plus className="w-5 h-5 mr-2" /> New Pipeline Job
          </Button>
        </div>

        {isLoading ? (
          <div className="w-full h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Loading pipelines…</p>
          </div>
        ) : isError ? (
          <div className="w-full p-8 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
            <ServerCrash className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-bold text-destructive mb-2">Connection Error</h3>
            <p className="text-muted-foreground">Failed to communicate with the pipeline server.</p>
          </div>
        ) : data?.jobs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full p-16 rounded-3xl glass-panel text-center border-dashed border-2 border-border"
          >
            <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Cpu className="w-10 h-10 text-primary opacity-80" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">No Active Jobs</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Initialize a new job to start extracting text, detecting entities, and reconstructing chronological timelines from your documents.
            </p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="border-primary/40 hover:bg-accent text-primary">
              <Plus className="w-4 h-4 mr-2" /> Initialize Setup
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data?.jobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/jobs/${job.id}`} className="block h-full group">
                  <div className="h-full bg-card rounded-2xl p-6 border border-border shadow-sm group-hover:border-primary/40 group-hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
                      <Cpu className="w-24 h-24 text-primary" />
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded border border-border">
                          {job.id.split('-')[0]}
                        </div>
                        <JobStatusBadge status={job.status} />
                      </div>

                      <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">{job.name}</h3>
                      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 flex-1">
                        {job.description || "No description provided."}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-6 border-t border-border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Files className="w-4 h-4" />
                          <span>{job.fileCount} {job.fileCount === 1 ? 'file' : 'files'}</span>
                        </div>
                        <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                          View details <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

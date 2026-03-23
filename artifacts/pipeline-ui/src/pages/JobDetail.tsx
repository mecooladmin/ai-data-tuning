import { useState } from "react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useGetJob, useProcessJob, useGetJobOutputs, useGetJobTimeline, getGetJobQueryKey } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { FileUpload } from "@/components/jobs/FileUpload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Play, ArrowLeft, Calendar, FileText, CheckSquare, Clock, File } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading, isError } = useGetJob(id || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const processMutation = useProcessJob({
    mutation: {
      onSuccess: () => {
        toast({ title: "Pipeline Triggered", description: "Job processing has started." });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id!) });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "Failed to start pipeline" });
      }
    }
  });

  const { data: outputs } = useGetJobOutputs(id || "", { query: { enabled: job?.status === 'completed' } });
  const { data: timeline } = useGetJobTimeline(id || "", { query: { enabled: job?.status === 'completed' } });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full border-t-2 border-primary w-12 h-12" />
    </div>
  );
  if (isError || !job) return (
    <div className="min-h-screen bg-background text-foreground p-8">Job not found or error loading data.</div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Job Header */}
      <div className="border-b border-border bg-card/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to jobs
          </Link>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">{job.name}</h1>
                <JobStatusBadge status={job.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                <span>ID: {job.id}</span>
                <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {format(new Date(job.createdAt), "MMM d, yyyy HH:mm")}</span>
              </div>
              {job.description && <p className="mt-4 text-muted-foreground max-w-2xl">{job.description}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => processMutation.mutate({ jobId: job.id })}
                disabled={job.status === 'processing' || job.fileCount === 0 || processMutation.isPending}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                {processMutation.isPending ? "Starting..." : <><Play className="w-4 h-4 mr-2" /> Process Pipeline</>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue={job.status === 'completed' ? 'timeline' : 'files'} className="w-full">
          <TabsList className="bg-muted border border-border p-1 rounded-xl h-auto mb-8 flex flex-wrap gap-1">
            <TabsTrigger value="files" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2.5 px-4">
              <File className="w-4 h-4 mr-2" /> Source Files
            </TabsTrigger>
            <TabsTrigger value="timeline" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2.5 px-4">
              <Calendar className="w-4 h-4 mr-2" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="master" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2.5 px-4">
              <FileText className="w-4 h-4 mr-2" /> Master Doc
            </TabsTrigger>
            <TabsTrigger value="validation" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2.5 px-4">
              <CheckSquare className="w-4 h-4 mr-2" /> Report
            </TabsTrigger>
          </TabsList>

          {/* Source Files */}
          <TabsContent value="files" className="space-y-8 animate-in fade-in-50 duration-500 mt-0">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-xl font-bold mb-6 text-foreground border-b border-border pb-4">Add Documents</h3>
                <FileUpload jobId={job.id} />
              </div>
              <div className="glass-panel p-6 rounded-2xl h-fit">
                <h3 className="text-xl font-bold mb-6 text-foreground border-b border-border pb-4 flex justify-between items-center">
                  <span>Source Manifest</span>
                  <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">{job.files.length} total</span>
                </h3>
                {job.files.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                    No files uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {job.files.map(f => (
                      <div key={f.id} className="flex items-start p-3 rounded-lg bg-background border border-border hover:border-primary/40 transition-colors">
                        <File className="w-5 h-5 text-primary mt-0.5 mr-3 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate" title={f.filename}>{f.filename}</p>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-mono">
                            <span>{formatBytes(f.sizeBytes)}</span>
                            <span>{f.mimeType.split('/')[1] || f.mimeType}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-0">
            <div className="glass-panel p-8 rounded-2xl relative">
              {timeline?.events.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">No events detected.</div>
              ) : (
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-primary/30 before:to-transparent">
                  {timeline?.events.map((event) => (
                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <time className="font-mono text-sm text-primary font-bold">{event.date || "Unknown Date"}</time>
                          {event.dateInferred && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Inferred</span>
                          )}
                        </div>
                        <p className="text-foreground mb-4 leading-relaxed">{event.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {event.entities.map(e => (
                            <span key={e} className="text-xs px-2 py-1 rounded bg-accent text-accent-foreground border border-border">{e}</span>
                          ))}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground border-t border-border pt-2 flex items-center">
                          <FileText className="w-3 h-3 mr-1" /> {event.sourceFile}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Master Document */}
          <TabsContent value="master" className="mt-0">
            <div className="glass-panel p-8 rounded-2xl">
              <div className="prose max-w-none font-sans leading-loose text-foreground">
                <h2 className="text-foreground border-b border-border pb-4 mb-8 font-mono text-xl text-primary">Compiled Master Document</h2>
                <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-8 rounded-xl border border-border text-foreground leading-relaxed">
                  {outputs?.masterDocument || "No master document available."}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Validation Report */}
          <TabsContent value="validation" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: "Processed Files", value: `${outputs?.validationReport.processedFiles ?? 0}/${outputs?.validationReport.totalFiles ?? 0}`, colorClass: "text-blue-600" },
                { label: "Total Events", value: outputs?.validationReport.totalEvents ?? 0, colorClass: "text-primary" },
                { label: "Total Entities", value: outputs?.validationReport.totalEntities ?? 0, colorClass: "text-violet-600" },
                { label: "Conflicts Detected", value: outputs?.validationReport.conflictsDetected ?? 0, colorClass: outputs?.validationReport.conflictsDetected ? "text-amber-600" : "text-emerald-600" },
                { label: "Data Loss Risk", value: outputs?.validationReport.dataLossRisk ?? "—", colorClass: (outputs?.validationReport.dataLossRisk ?? "").startsWith("LOW") ? "text-emerald-600" : "text-red-600" },
              ].map((stat, i) => (
                <Card key={i} className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</p>
                    <p className={`text-4xl font-mono font-bold ${stat.colorClass}`}>{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

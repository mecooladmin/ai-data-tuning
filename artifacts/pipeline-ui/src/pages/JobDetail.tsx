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
import { Play, ArrowLeft, Calendar, FileText, Database, Code, CheckSquare, Clock, File } from "lucide-react";
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

  const { data: outputs } = useGetJobOutputs(id || "", { query: { enabled: job?.status === 'completed' }});
  const { data: timeline } = useGetJobTimeline(id || "", { query: { enabled: job?.status === 'completed' }});

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin text-primary rounded-full border-t-2 border-primary w-12 h-12"></div></div>;
  if (isError || !job) return <div className="min-h-screen bg-background text-white p-8">Job not found or error loading data.</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      {/* Job Header */}
      <div className="border-b border-white/5 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to jobs
          </Link>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{job.name}</h1>
                <JobStatusBadge status={job.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                <span>ID: {job.id}</span>
                <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1"/> {format(new Date(job.createdAt), "MMM d, yyyy HH:mm")}</span>
              </div>
              {job.description && <p className="mt-4 text-muted-foreground max-w-2xl">{job.description}</p>}
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={() => processMutation.mutate({ jobId: job.id })}
                disabled={job.status === 'processing' || job.fileCount === 0 || processMutation.isPending}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all disabled:shadow-none"
              >
                {processMutation.isPending ? "Starting..." : <><Play className="w-4 h-4 mr-2" /> Process Pipeline</>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 z-0">
        <Tabs defaultValue={job.status === 'completed' ? 'timeline' : 'files'} className="w-full">
          <TabsList className="bg-background border border-border/50 p-1 rounded-xl h-auto mb-8 flex flex-wrap gap-1">
            <TabsTrigger value="files" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary py-2.5 px-4"><File className="w-4 h-4 mr-2"/> Source Files</TabsTrigger>
            <TabsTrigger value="timeline" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary py-2.5 px-4"><Calendar className="w-4 h-4 mr-2"/> Timeline</TabsTrigger>
            <TabsTrigger value="master" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary py-2.5 px-4"><FileText className="w-4 h-4 mr-2"/> Master Doc</TabsTrigger>
            <TabsTrigger value="rag" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary py-2.5 px-4"><Database className="w-4 h-4 mr-2"/> RAG Data</TabsTrigger>
            <TabsTrigger value="finetune" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary py-2.5 px-4"><Code className="w-4 h-4 mr-2"/> Fine-tune</TabsTrigger>
            <TabsTrigger value="validation" disabled={job.status !== 'completed'} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary py-2.5 px-4"><CheckSquare className="w-4 h-4 mr-2"/> Report</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-8 animate-in fade-in-50 duration-500 mt-0">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4">Add Documents</h3>
                <FileUpload jobId={job.id} />
              </div>
              <div className="glass-panel p-6 rounded-2xl h-fit">
                <h3 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4 flex justify-between items-center">
                  <span>Source Manifest</span>
                  <span className="text-sm font-normal text-muted-foreground bg-secondary px-2 py-1 rounded">{job.files.length} total</span>
                </h3>
                {job.files.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                    No files uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {job.files.map(f => (
                      <div key={f.id} className="flex items-start p-3 rounded-lg bg-background border border-border/50 hover:border-primary/30 transition-colors">
                        <File className="w-5 h-5 text-primary mt-0.5 mr-3 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate" title={f.filename}>{f.filename}</p>
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

          <TabsContent value="timeline" className="mt-0">
            <div className="glass-panel p-8 rounded-2xl relative">
              {timeline?.events.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">No events detected.</div>
              ) : (
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-primary/30 before:to-transparent">
                  {timeline?.events.map((event, idx) => (
                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <div className="w-2 h-2 rounded-full bg-background"></div>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/50 bg-card hover:border-primary/50 transition-colors shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between mb-2">
                          <time className="font-mono text-sm text-primary font-bold">{event.date || "Unknown Date"}</time>
                          {event.dateInferred && <span className="text-[10px] uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">Inferred</span>}
                        </div>
                        <p className="text-white mb-4 leading-relaxed">{event.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {event.entities.map(e => (
                            <span key={e} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground border border-border/50">{e}</span>
                          ))}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground border-t border-white/5 pt-2 flex items-center">
                          <FileText className="w-3 h-3 mr-1" /> {event.sourceFile}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="master" className="mt-0">
            <div className="glass-panel p-8 rounded-2xl">
              <div className="prose prose-invert max-w-none font-sans leading-loose text-slate-300">
                <h2 className="text-white border-b border-white/10 pb-4 mb-8 font-mono text-xl text-primary">Compiled.Master.Document</h2>
                <div className="whitespace-pre-wrap font-serif text-lg tracking-wide bg-background p-8 rounded-xl border border-border/50">
                  {outputs?.masterDocument || "No master document available."}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rag" className="mt-0">
            <div className="glass-panel p-6 rounded-2xl overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-white/10 text-muted-foreground text-sm uppercase tracking-wider font-mono">
                     <th className="p-4 font-medium">Chunk ID</th>
                     <th className="p-4 font-medium w-1/2">Content</th>
                     <th className="p-4 font-medium">Entities</th>
                     <th className="p-4 font-medium">Source</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {outputs?.ragChunks.map(chunk => (
                     <tr key={chunk.id} className="hover:bg-white/[0.02] transition-colors">
                       <td className="p-4 font-mono text-xs text-primary/70 align-top">{chunk.id.substring(0,8)}...</td>
                       <td className="p-4 text-sm text-slate-300 leading-relaxed align-top">{chunk.text}</td>
                       <td className="p-4 align-top">
                         <div className="flex flex-wrap gap-1">
                           {chunk.metadata.entities.slice(0,3).map(e => <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white">{e}</span>)}
                           {chunk.metadata.entities.length > 3 && <span className="text-[10px] text-muted-foreground">+{chunk.metadata.entities.length - 3} more</span>}
                         </div>
                       </td>
                       <td className="p-4 font-mono text-xs text-muted-foreground align-top">{chunk.metadata.source}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </TabsContent>

          <TabsContent value="finetune" className="mt-0">
             <div className="glass-panel p-6 rounded-2xl space-y-6">
                {outputs?.fineTuneExamples.map((ex, i) => (
                  <div key={i} className="bg-background border border-border/50 rounded-xl overflow-hidden shadow-lg shadow-black/20">
                    <div className="bg-secondary/50 p-2 border-b border-border/50 font-mono text-xs text-muted-foreground">Example #{i+1}</div>
                    <div className="p-4 grid md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-border/50">
                      <div className="space-y-2 pb-4 md:pb-0 md:pr-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Input Context</div>
                        <p className="text-sm font-mono text-slate-300 bg-black/40 p-3 rounded">{ex.context}</p>
                        <div className="text-xs font-bold uppercase tracking-widest text-primary mt-4 mb-2">Instruction</div>
                        <p className="text-sm text-white">{ex.input}</p>
                      </div>
                      <div className="space-y-2 pt-4 md:pt-0 md:pl-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">Expected Output</div>
                        <p className="text-sm text-white bg-green-900/10 p-3 rounded border border-green-500/20">{ex.output}</p>
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </TabsContent>

          <TabsContent value="validation" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: "Processed Files", value: `${outputs?.validationReport.processedFiles}/${outputs?.validationReport.totalFiles}`, color: "text-blue-400" },
                { label: "Total Events", value: outputs?.validationReport.totalEvents, color: "text-primary" },
                { label: "Total Entities", value: outputs?.validationReport.totalEntities, color: "text-purple-400" },
                { label: "Conflicts Detected", value: outputs?.validationReport.conflictsDetected, color: outputs?.validationReport.conflictsDetected ? "text-yellow-400" : "text-green-400" },
                { label: "Data Loss Risk", value: outputs?.validationReport.dataLossRisk, color: outputs?.validationReport.dataLossRisk === 'LOW' ? 'text-green-400' : 'text-red-400' },
              ].map((stat, i) => (
                <Card key={i} className="bg-card border-border/50 shadow-xl">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</p>
                    <p className={`text-4xl font-mono font-bold ${stat.color} glow-text`}>{stat.value}</p>
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

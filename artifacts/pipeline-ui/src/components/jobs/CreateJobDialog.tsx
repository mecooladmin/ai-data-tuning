import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CreateJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        toast({
          title: "Job Created",
          description: "New pipeline job initialized successfully.",
        });
        setName("");
        setDescription("");
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Error creating job",
          description: error.message || "An unknown error occurred.",
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ data: { name, description } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/50 shadow-2xl shadow-black/80">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Initialize New Job</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new workspace for document processing and timeline extraction.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">Job Name</Label>
            <Input
              id="name"
              placeholder="e.g., Q3 Financial Reports"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border/50 focus-visible:ring-primary focus-visible:border-primary"
              disabled={createMutation.isPending}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Textarea
              id="description"
              placeholder="Context for this pipeline run..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background border-border/50 resize-none h-24 focus-visible:ring-primary focus-visible:border-primary"
              disabled={createMutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="border-border/50 hover:bg-secondary"
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || createMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all duration-300"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Initializing...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Create Job</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

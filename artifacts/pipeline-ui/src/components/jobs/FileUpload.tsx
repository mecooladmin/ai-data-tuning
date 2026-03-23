import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, X, Loader2, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUploadFile, getGetJobQueryKey } from "@workspace/api-client-react";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function FileUpload({ jobId }: { jobId: string }) {
  const [uploads, setUploads] = useState<Array<{ file: File; progress: number; status: 'uploading' | 'success' | 'error' }>>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useUploadFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      },
    }
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploads(prev => [...prev, { file, progress: 0, status: 'uploading' }]);
      
      try {
        await uploadMutation.mutateAsync({
          jobId,
          data: { file }
        });
        
        setUploads(prev => prev.map(u => u.file.name === file.name ? { ...u, progress: 100, status: 'success' } : u));
        toast({ title: "File uploaded", description: `${file.name} successfully added.` });
      } catch (err: any) {
        setUploads(prev => prev.map(u => u.file.name === file.name ? { ...u, status: 'error' } : u));
        toast({ variant: "destructive", title: "Upload failed", description: err.message || `Failed to upload ${file.name}` });
      }
    }
  }, [jobId, uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className={`w-full p-12 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 ${
          isDragActive 
            ? 'border-primary bg-primary/5 ring-4 ring-primary/20' 
            : 'border-white/10 hover:border-primary/50 hover:bg-white/5'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-6 border border-border shadow-xl">
          <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Drop documents here</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Supports PDFs, images (JPG/PNG/WebP), Word Docs, and text files. All files will be merged into a single chronological timeline.
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Uploads</h4>
          {uploads.map((upload, idx) => (
            <div key={`${upload.file.name}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary rounded-lg">
                  <File className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-[400px]">{upload.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(upload.file.size)}</p>
                </div>
              </div>
              <div>
                {upload.status === 'uploading' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                {upload.status === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                {upload.status === 'error' && <X className="w-5 h-5 text-destructive" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

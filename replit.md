# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (pipeline-ui artifact)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── pipeline-ui/        # React frontend for Document Intelligence Pipeline
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Application: Document Intelligence Pipeline

### Purpose
Fully automated pipeline that:
1. Accepts uploaded files of any type (PDFs, images, screenshots, DOCX, TXT, etc.)
2. Extracts ALL information without losing detail using OCR (Tesseract), PDF parse, Mammoth (DOCX)
3. Normalizes and structures data, detects dates, entities, events via NLP
4. Reconstructs a complete chronological timeline
5. Outputs: master document, RAG-ready chunks, fine-tuning dataset

### Key Backend Files
- `artifacts/api-server/src/routes/jobs.ts` — all pipeline API routes
- `artifacts/api-server/src/lib/pipeline/extractor.ts` — file extraction (PDF, OCR, DOCX, text)
- `artifacts/api-server/src/lib/pipeline/nlp.ts` — entity/event detection, date parsing
- `artifacts/api-server/src/lib/pipeline/processor.ts` — orchestrates the full pipeline
- `artifacts/api-server/src/lib/pipeline/output-generator.ts` — generates master doc, RAG chunks, fine-tune examples

### DB Schema (lib/db/src/schema/jobs.ts)
- `jobs` — pipeline jobs (id, name, description, status, errorMessage)
- `uploaded_files` — files attached to a job (storagePath, rawText)
- `timeline_events` — extracted events sorted chronologically
- `job_outputs` — master document, RAG chunks, fine-tune examples, validation report

### API Endpoints
- `GET /api/jobs` — list all jobs
- `POST /api/jobs` — create job `{name, description}`
- `GET /api/jobs/:id` — job detail with files
- `POST /api/jobs/:id/upload` — upload file (multipart, field: "file")
- `POST /api/jobs/:id/process` — trigger async pipeline processing
- `GET /api/jobs/:id/timeline` — get reconstructed timeline events
- `GET /api/jobs/:id/outputs` — get masterDocument, ragChunks, fineTuneExamples, validationReport

### Supported File Types
- PDF (pdf-parse)
- Images: JPG, PNG, WebP, BMP, TIFF (Tesseract OCR)
- DOCX (Mammoth)
- Text: TXT, MD, CSV, JSON, XML, HTML

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes at `/api`. Pipeline processor runs async after HTTP response.
Dependencies include: multer, tesseract.js, pdf-parse, mammoth.

### `artifacts/pipeline-ui` (`@workspace/pipeline-ui`)

React + Vite frontend at path `/`. Shows list of pipeline jobs, job detail with file upload, timeline, outputs.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.
- `pnpm --filter @workspace/db run push` — push schema to DB

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

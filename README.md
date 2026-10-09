# NeuralNest Knowledge

NeuralNest Knowledge is an open-source, self-hostable knowledge management web app for AI-assisted document retrieval.

It demonstrates:
- Document ingestion and organization
- NLP tokenization and chunking
- Semantic retrieval using lightweight vector embeddings (term-frequency vectors + cosine similarity)
- Retrieval-Augmented Generation (RAG)-style answering
- Source-grounded answers with traceable references
- AI-assisted study tools (summaries + flashcards)

## Why this project
Traditional document systems require manual scanning of long text. NeuralNest Knowledge enables natural-language questioning over uploaded content and returns context-aware answers grounded in retrieved source passages.

## Architecture (modular)
- **Frontend:** static HTML UI (`/public/index.html`)
- **API server:** Node.js HTTP server (`/src/server.js`)
- **Knowledge engine:** retrieval + generation pipeline (`/src/knowledgeEngine.js`)

The generation layer is provider-aware via `MODEL_PROVIDER`:
- `local` (default): local extractive answer generation
- other values: explicit fallback path for hosted model adapters in future integrations

## API Overview
- `POST /api/documents` — upload a document (`title`, `content`, optional `category`)
- `GET /api/documents` — list uploaded documents
- `POST /api/query` — ask a natural-language question and receive answer + sources
- `POST /api/documents/:id/summarize` — summary generation
- `POST /api/documents/:id/study` — flashcard generation
- `GET /api/health` — service health

## Run locally
```bash
npm install
npm start
```
Then open: `http://localhost:3000`

## Test
```bash
npm test
```

## Expected outcome coverage
This repository now provides a functional, documented, and self-hostable web application that demonstrates:
- document processing
- semantic retrieval
- source-attributed AI-assisted question answering
- summarization and study tooling
- software testing via focused Node tests
- open-source-friendly modular code structure

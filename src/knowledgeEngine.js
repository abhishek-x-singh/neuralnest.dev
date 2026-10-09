const DEFAULT_CHUNK_WORDS = 120;
const DEFAULT_CHUNK_OVERLAP = 20;

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)?.filter((token) => token.length > 1) || [];
}

function splitIntoChunks(text, maxWords = DEFAULT_CHUNK_WORDS, overlapWords = DEFAULT_CHUNK_OVERLAP) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    chunks.push(words.slice(start, end).join(" "));

    if (end === words.length) {
      break;
    }

    start = Math.max(end - overlapWords, start + 1);
  }

  return chunks;
}

function buildEmbedding(text) {
  const counts = new Map();
  const tokens = tokenize(text);

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return counts;
}

function cosineSimilarity(a, b) {
  if (!a.size || !b.size) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of a.values()) {
    normA += value * value;
  }

  for (const value of b.values()) {
    normB += value * value;
  }

  for (const [token, value] of a.entries()) {
    dot += value * (b.get(token) || 0);
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function sentenceSplit(text) {
  return (text || "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function localExtractiveAnswer(question, retrievedChunks) {
  const questionTokens = new Set(tokenize(question));

  const candidateSentences = retrievedChunks.flatMap((chunk) => {
    return sentenceSplit(chunk.text).map((sentence) => {
      const overlap = tokenize(sentence).filter((token) => questionTokens.has(token)).length;
      return { sentence, overlap };
    });
  });

  candidateSentences.sort((a, b) => b.overlap - a.overlap || b.sentence.length - a.sentence.length);

  const top = candidateSentences.filter((entry) => entry.overlap > 0).slice(0, 3);
  if (top.length === 0) {
    return "I could not find enough evidence in the uploaded documents to answer confidently.";
  }

  return top.map((entry) => entry.sentence).join(" ");
}

class KnowledgeBase {
  constructor({ provider = process.env.MODEL_PROVIDER || "local" } = {}) {
    this.provider = provider;
    this.documents = [];
    this.nextDocumentId = 1;
  }

  addDocument({ title, content, category = "General" }) {
    if (!title || !content) {
      throw new Error("Both title and content are required.");
    }

    const chunks = splitIntoChunks(content).map((chunkText, index) => ({
      id: index + 1,
      text: chunkText,
      embedding: buildEmbedding(chunkText),
    }));

    const document = {
      id: this.nextDocumentId++,
      title,
      category,
      content,
      chunks,
      createdAt: new Date().toISOString(),
    };

    this.documents.push(document);
    return {
      id: document.id,
      title: document.title,
      category: document.category,
      createdAt: document.createdAt,
      chunkCount: document.chunks.length,
    };
  }

  listDocuments() {
    return this.documents.map(({ id, title, category, createdAt, chunks }) => ({
      id,
      title,
      category,
      createdAt,
      chunkCount: chunks.length,
    }));
  }

  getDocument(id) {
    return this.documents.find((doc) => doc.id === Number(id));
  }

  search(query, topK = 3) {
    const queryEmbedding = buildEmbedding(query);

    const scored = [];
    for (const document of this.documents) {
      for (const chunk of document.chunks) {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (score > 0) {
          scored.push({
            documentId: document.id,
            documentTitle: document.title,
            category: document.category,
            chunkId: chunk.id,
            score,
            text: chunk.text,
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  answerQuestion(question, topK = 3) {
    if (!question) {
      throw new Error("Question is required.");
    }

    const retrieved = this.search(question, topK);

    const answer = this.provider === "local"
      ? localExtractiveAnswer(question, retrieved)
      : `Provider '${this.provider}' is configured but not implemented in this demo. Falling back to local answer: ${localExtractiveAnswer(question, retrieved)}`;

    return {
      question,
      answer,
      sources: retrieved.map((match) => ({
        documentId: match.documentId,
        title: match.documentTitle,
        category: match.category,
        chunkId: match.chunkId,
        score: Number(match.score.toFixed(4)),
        excerpt: match.text.slice(0, 280),
      })),
    };
  }

  summarizeDocument(id, maxSentences = 3) {
    const document = this.getDocument(id);
    if (!document) {
      throw new Error("Document not found.");
    }

    const sentences = sentenceSplit(document.content);
    const frequencies = new Map();

    for (const token of tokenize(document.content)) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }

    const scored = sentences.map((sentence, index) => {
      const score = tokenize(sentence).reduce((sum, token) => sum + (frequencies.get(token) || 0), 0);
      return { sentence, score, index };
    });

    const selected = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.sentence)
      .join(" ");

    return {
      documentId: document.id,
      title: document.title,
      summary: selected || document.content.slice(0, 300),
    };
  }

  generateFlashcards(id, maxCards = 5) {
    const document = this.getDocument(id);
    if (!document) {
      throw new Error("Document not found.");
    }

    const sentences = sentenceSplit(document.content).slice(0, maxCards);

    const cards = sentences.map((sentence, index) => {
      const words = tokenize(sentence);
      const keyword = words[0] || "concept";
      return {
        id: index + 1,
        question: `What does the document say about ${keyword}?`,
        answer: sentence,
      };
    });

    return {
      documentId: document.id,
      title: document.title,
      cards,
    };
  }
}

module.exports = {
  KnowledgeBase,
  tokenize,
  splitIntoChunks,
  buildEmbedding,
  cosineSimilarity,
};

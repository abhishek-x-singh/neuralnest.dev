const test = require("node:test");
const assert = require("node:assert/strict");
const { KnowledgeBase, splitIntoChunks, cosineSimilarity, buildEmbedding } = require("../src/knowledgeEngine");

test("splitIntoChunks creates at least one chunk for non-empty text", () => {
  const chunks = splitIntoChunks("alpha beta gamma delta", 2, 1);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0], "alpha beta");
});

test("cosineSimilarity ranks related text higher", () => {
  const query = buildEmbedding("vector search retrieval");
  const related = buildEmbedding("retrieval with vector search and sources");
  const unrelated = buildEmbedding("gardening soil compost flowers");

  assert.ok(cosineSimilarity(query, related) > cosineSimilarity(query, unrelated));
});

test("KnowledgeBase returns source-grounded answers", () => {
  const kb = new KnowledgeBase();
  kb.addDocument({
    title: "RAG Overview",
    category: "AI",
    content: "Retrieval-augmented generation combines search and language generation. It grounds answers in retrieved passages.",
  });
  kb.addDocument({
    title: "Database Notes",
    category: "Storage",
    content: "Relational databases store structured records and support SQL joins.",
  });

  const result = kb.answerQuestion("How does retrieval augmented generation ground answers?", 2);

  assert.match(result.answer, /retrieval|grounds?|passages?/i);
  assert.ok(result.sources.length >= 1);
  assert.equal(result.sources[0].title, "RAG Overview");
});

test("KnowledgeBase generates summaries and flashcards", () => {
  const kb = new KnowledgeBase();
  const { id } = kb.addDocument({
    title: "Learning Notes",
    content: "Neural search maps text into vectors. Semantic retrieval compares embeddings. Source attribution improves trust.",
  });

  const summary = kb.summarizeDocument(id);
  assert.ok(summary.summary.length > 0);

  const study = kb.generateFlashcards(id, 2);
  assert.equal(study.cards.length, 2);
  assert.ok(study.cards[0].question.length > 0);
});

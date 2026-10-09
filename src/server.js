const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { KnowledgeBase } = require("./knowledgeEngine");

const kb = new KnowledgeBase();
const port = Number(process.env.PORT || 3000);

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath, contentType = "text/html; charset=utf-8") {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 500, { error: "Failed to read file." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
    });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function notFound(res) {
  sendJson(res, 404, { error: "Route not found" });
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (method === "GET" && url.pathname === "/") {
    return sendFile(res, path.join(__dirname, "..", "public", "index.html"));
  }

  if (method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok", documents: kb.listDocuments().length });
  }

  if (method === "GET" && url.pathname === "/api/documents") {
    return sendJson(res, 200, { documents: kb.listDocuments() });
  }

  if (method === "POST" && url.pathname === "/api/documents") {
    try {
      const body = await parseBody(req);
      const created = kb.addDocument({
        title: body.title,
        content: body.content,
        category: body.category,
      });
      return sendJson(res, 201, { document: created });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (method === "POST" && url.pathname === "/api/query") {
    try {
      const body = await parseBody(req);
      const result = kb.answerQuestion(body.question, Number(body.topK || 3));
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const summarizeMatch = url.pathname.match(/^\/api\/documents\/(\d+)\/summarize$/);
  if (method === "POST" && summarizeMatch) {
    try {
      const summary = kb.summarizeDocument(Number(summarizeMatch[1]));
      return sendJson(res, 200, summary);
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  const studyMatch = url.pathname.match(/^\/api\/documents\/(\d+)\/study$/);
  if (method === "POST" && studyMatch) {
    try {
      const cards = kb.generateFlashcards(Number(studyMatch[1]));
      return sendJson(res, 200, cards);
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  return notFound(res);
});

if (require.main === module) {
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`NeuralNest Knowledge running at http://localhost:${port}`);
  });
}

module.exports = { server, kb };

# Knowledge Base

Place your knowledge files here before running the setup script.

Supported formats: .txt, .pdf, .docx, .md

Examples:
- faq.txt          — frequently asked questions
- products.pdf     — product catalog
- policies.txt     — shipping, returns, etc.

Scripts (from repo root):

  npm run knowledge:sync-instagram   # fetch IG posts → instagram-agenda.txt
  npm run knowledge:setup            # upload /knowledge to OpenAI vector store
  npm run knowledge:refresh          # sync Instagram + refresh vector store

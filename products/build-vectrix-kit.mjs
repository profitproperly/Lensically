import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "products", "vectrix-ai-income-system-starter-kit");
const distDir = path.join(root, "products", "dist", "vectrix-ai-income-system-starter-kit");
const htmlPath = path.join(distDir, "Vectrix AI Income System Starter Kit.html");
const pdfPath = path.join(distDir, "Vectrix AI Income System Starter Kit.pdf");
const customerReadmePath = path.join(distDir, "README.txt");

const sourceFiles = [
  "START_HERE.md",
  "01-niche-and-buyer-picker.md",
  "02-offer-builder.md",
  "03-content-engine.md",
  "04-landing-page-template.md",
  "05-email-sequence.md",
  "06-dm-script.md",
  "07-automation-checklist.md",
  "08-prompt-pack.md",
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listOpen = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listOpen) return;
    html.push("</ul>");
    listOpen = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join("\n");
}

function buildWorksheet(title, prompts) {
  return [
    `<section class="worksheet">`,
    `<h2>${escapeHtml(title)}</h2>`,
    ...prompts.map((prompt) => (
      `<div class="worksheet-row"><div class="prompt">${escapeHtml(prompt)}</div><div class="blank"></div></div>`
    )),
    `</section>`,
  ].join("\n");
}

async function main() {
  await fs.mkdir(distDir, { recursive: true });

  const sections = [];
  for (const file of sourceFiles) {
    const markdown = await fs.readFile(path.join(sourceDir, file), "utf8");
    sections.push(`<section class="chapter">${renderMarkdown(markdown)}</section>`);
  }

  const worksheets = [
    buildWorksheet("Buyer Clarity Worksheet", [
      "My buyer is",
      "The painful problem they want solved",
      "What they already tried",
      "What would save them time this week",
      "The smallest useful product I can build",
    ]),
    buildWorksheet("Offer Builder Worksheet", [
      "I help",
      "Get this specific result",
      "Without this frustration",
      "Using this simple mechanism",
      "My one sentence offer",
    ]),
    buildWorksheet("Content Planning Worksheet", [
      "Three beginner mistakes to post about",
      "Three systems I can explain",
      "Two examples I can break down",
      "One contrarian take",
      "One soft offer post",
    ]),
    buildWorksheet("Weekly Review Worksheet", [
      "Best performing topic",
      "Weakest topic",
      "Questions people asked",
      "Objections people raised",
      "One product improvement for next week",
    ]),
  ].join("\n");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vectrix AI Income System Starter Kit</title>
  <style>
    @page { margin: 0.62in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.55;
    }
    .page {
      max-width: 900px;
      margin: 0 auto;
      background: white;
    }
    .cover {
      min-height: 92vh;
      padding: 72px 64px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #101827;
      color: white;
      page-break-after: always;
    }
    .brand {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: #93c5fd;
      font-weight: 800;
    }
    .cover h1 {
      font-size: 58px;
      line-height: 1;
      margin: 40px 0 24px;
      letter-spacing: 0;
    }
    .cover p {
      max-width: 620px;
      font-size: 20px;
      color: #dbeafe;
    }
    .cover .note {
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 24px;
      color: #cbd5e1;
      font-size: 14px;
    }
    .toc, .chapter, .worksheet, .closing {
      padding: 42px 54px;
      border-bottom: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    .toc { page-break-after: always; }
    .toc h2, .worksheet h2 {
      margin-top: 0;
      font-size: 26px;
    }
    .toc ol {
      padding-left: 22px;
      font-size: 15px;
    }
    h1 {
      font-size: 34px;
      line-height: 1.08;
      margin: 0 0 20px;
      color: #0f172a;
      letter-spacing: 0;
    }
    h2 {
      font-size: 23px;
      margin: 30px 0 12px;
      color: #111827;
      letter-spacing: 0;
    }
    h3 {
      font-size: 17px;
      margin: 22px 0 8px;
      color: #1f2937;
      letter-spacing: 0;
    }
    p, li {
      font-size: 14.5px;
    }
    p {
      margin: 0 0 12px;
    }
    ul {
      margin: 0 0 16px;
      padding-left: 22px;
    }
    li {
      margin: 4px 0;
    }
    .chapter {
      page-break-after: always;
    }
    .chapter h1:first-child {
      padding-bottom: 12px;
      border-bottom: 3px solid #111827;
    }
    .worksheet {
      page-break-after: always;
    }
    .worksheet-row {
      margin: 18px 0;
    }
    .prompt {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 8px;
      color: #111827;
    }
    .blank {
      min-height: 58px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .closing {
      page-break-before: always;
      background: #f8fafc;
    }
    .disclaimer {
      margin-top: 32px;
      padding: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: white;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div>
        <div class="brand">Vectrix</div>
        <h1>AI Income System Starter Kit</h1>
        <p>A practical workbook for choosing one buyer, packaging one simple digital product, and building a content path that can lead to sales.</p>
      </div>
      <div class="note">Built for creators, freelancers, solo operators, and beginners who want a simple system instead of random posting.</div>
    </section>
    <section class="toc">
      <h2>Inside This Workbook</h2>
      <ol>
        <li>Start Here</li>
        <li>Niche And Buyer Picker</li>
        <li>Offer Builder</li>
        <li>Content Engine</li>
        <li>Landing Page Template</li>
        <li>Email Sequence</li>
        <li>DM Script</li>
        <li>Automation Checklist</li>
        <li>Prompt Pack</li>
        <li>Printable Worksheets</li>
      </ol>
    </section>
    ${sections.join("\n")}
    ${worksheets}
    <section class="closing">
      <h1>Build The First Version</h1>
      <p>Use this kit to build a first simple buyer path. Keep the offer narrow, publish useful content, then improve from actual feedback.</p>
      <div class="disclaimer">Educational material only. This workbook is not financial advice and does not guarantee income, revenue, business results, or investment outcomes.</div>
    </section>
  </main>
</body>
</html>`;

  await fs.writeFile(htmlPath, html, "utf8");
  await fs.writeFile(customerReadmePath, [
    "Vectrix AI Income System Starter Kit",
    "",
    "Start with the PDF workbook.",
    "",
    "Suggested use:",
    "1. Read Start Here.",
    "2. Complete the buyer worksheet.",
    "3. Fill out the offer builder.",
    "4. Use the content engine to publish your first posts.",
    "5. Review results weekly and improve the offer.",
    "",
    "This is educational material only. It is not financial advice and does not guarantee income or results.",
    "",
  ].join("\n"), "utf8");

  console.log(JSON.stringify({ htmlPath, pdfPath, customerReadmePath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

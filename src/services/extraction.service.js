const fs = require('fs');
const path = require('path');
const { fileTypeFromFile } = require('file-type');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const xlsx = require('xlsx');
const { parse: csvParse } = require('csv-parse/sync');
const { aggregateParts } = require('../utils/normalize');

class ExtractionService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async extractText(filePath) {
    const type = await fileTypeFromFile(filePath);
    const ext = (type?.ext || path.extname(filePath).replace('.', '')).toLowerCase();

    if (ext === 'pdf') return await this.extractFromPdf(filePath);
    if (ext === 'docx') return await this.extractFromDocx(filePath);
    if (ext === 'txt') return await fs.promises.readFile(filePath, 'utf8');
    if (['xls', 'xlsx'].includes(ext)) return await this.extractFromXlsx(filePath);
    if (['csv'].includes(ext)) return await this.extractFromCsv(filePath);
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return await this.extractWithAI(filePath, 'image');

    // Unknown: try AI direct
    return await this.extractWithAI(filePath, null);
  }

  async extractFromXlsx(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    return JSON.stringify({ rows: json });
  }

  async extractFromCsv(filePath) {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const rows = csvParse(raw, { columns: true, skip_empty_lines: true });
    return JSON.stringify({ rows });
  }

  async extractFromPdf(filePath) {
    const buffer = await fs.promises.readFile(filePath);
    try {
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 0) {
        return this.chunkAndSummarize(data.text);
      }
    } catch {}
    // Fallback to AI
    return await this.extractWithAI(filePath, 'pdf');
  }

  async extractFromDocx(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (result.value && result.value.trim().length > 0) {
        return this.chunkAndSummarize(result.value);
      }
    } catch {}
    return await this.extractWithAI(filePath, 'docx');
  }

  async extractWithAI(filePath, kind) {
    const buffer = await fs.promises.readFile(filePath);
    const base64 = buffer.toString('base64');
    const mime = kind === 'pdf' ? 'application/pdf' : kind === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : kind === 'image' ? 'image/png' : 'application/octet-stream';
    const prompt = 'You are extracting structured contact information from a call sheet. Return JSON with fields: contacts:[{name, role, phone, email, company}], production:{title, date, location}, meta:{confidence:0-1}. If input is a spreadsheet/CSV, treat each row as potential contact and infer fields.';

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the data. If the document is an image-based PDF, read all visible text and infer contacts.' },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' } }
          ]
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }

  chunkText(text, maxChars = 12000) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      chunks.push(text.slice(start, end));
      start = end;
    }
    return chunks;
  }

  async chunkAndSummarize(text) {
    const chunks = this.chunkText(text);
    if (chunks.length === 1) return text;
    const summaries = [];
    for (const part of chunks) {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize call sheet segment into structured JSON with arrays of contacts and high-level production info. Keep consistent keys.' },
          { role: 'user', content: part }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      });
      summaries.push(completion.choices[0].message.content);
    }
    return JSON.stringify(aggregateParts(summaries));
  }
}

module.exports = new ExtractionService();



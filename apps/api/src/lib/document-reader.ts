import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

export interface ReadDocumentResult {
  source: string
  title: string | null
  contentType: string
  text: string
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function htmlToText(html: string): string {
  return collapseWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|tr|h\d)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  )
}

function inferContentType(source: string, providedType: string | null): string {
  if (providedType) {
    return providedType
  }

  if (source.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf'
  }

  return 'text/html'
}

export interface PdfDocumentInfo {
  pageCount: number
  title: string | null
  author: string | null
}

export interface PdfPageRangeExtract {
  text: string
  firstPage: number
  lastPage: number
  pageCount: number
  truncated: boolean
}

/** One rasterized PDF page as PNG (base64), for vision-capable models. */
export interface PdfPageImagePng {
  mimeType: 'image/png'
  data: string
  page: number
  width: number
  height: number
}

async function runPymupdfRenderPage(request: Record<string, unknown>): Promise<PdfPageImagePng> {
  const script = `
import base64
import json
import sys

import fitz

req = json.loads(sys.stdin.read())
path = req["path"]
page1 = int(req["page"])
scale = float(req.get("scale", 2.0))
max_side = int(req.get("maxSide", 2000))

doc = fitz.open(path)
try:
    if page1 < 1 or page1 > doc.page_count:
        raise ValueError("page out of range")
    page = doc.load_page(page1 - 1)
    rect = page.rect
    tw = rect.width * scale
    th = rect.height * scale
    if max(tw, th) > max_side:
        scale *= max_side / max(tw, th)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    png = pix.tobytes("png")
    out = {
        "mimeType": "image/png",
        "data": base64.b64encode(png).decode("ascii"),
        "page": page1,
        "width": pix.width,
        "height": pix.height,
    }
    print(json.dumps(out))
finally:
    doc.close()
`.trim()

  const child = spawn('python3', ['-c', script], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
  child.stdin.end(JSON.stringify(request), 'utf8')

  await new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `PDF render failed: ${Buffer.concat(stderrChunks).toString('utf8') || `exit code ${code}`}`,
        ),
      )
    })
  })

  return JSON.parse(Buffer.concat(stdoutChunks).toString('utf8')) as PdfPageImagePng
}

/** Rasterize a single PDF page to PNG (PyMuPDF). Requires: pip install pymupdf */
export async function renderPdfPagePng(
  pdfPath: string,
  page: number,
  options?: { scale?: number; maxSide?: number },
): Promise<PdfPageImagePng> {
  return runPymupdfRenderPage({
    path: pdfPath,
    page,
    scale: options?.scale ?? 2,
    maxSide: options?.maxSide ?? 2000,
  })
}

async function runPypdfRpc(request: Record<string, unknown>): Promise<unknown> {
  const script = `
import json
import sys
from pypdf import PdfReader

req = json.loads(sys.stdin.read())
path = req["path"]
op = req["op"]
reader = PdfReader(path)

def norm(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None

if op == "info":
    meta = reader.metadata
    print(json.dumps({
        "pageCount": len(reader.pages),
        "title": norm(getattr(meta, "title", None) if meta else None),
        "author": norm(getattr(meta, "author", None) if meta else None),
    }))
elif op == "pages":
    n = len(reader.pages)
    first = max(1, int(req.get("firstPage", 1)))
    last = int(req.get("lastPage", max(n, 1)))
    max_chars = int(req.get("maxCharacters", 20000))
    if n == 0:
        print(json.dumps({
            "text": "",
            "firstPage": first,
            "lastPage": last,
            "pageCount": 0,
            "truncated": False,
        }))
    else:
        last = min(max(last, first), n)
        parts = []
        for idx in range(first - 1, last):
            t = reader.pages[idx].extract_text() or ""
            parts.append("--- Page %d ---\\n%s" % (idx + 1, t))
        text = "\\n\\n".join(parts).strip()
        truncated = len(text) > max_chars
        if truncated:
            text = text[:max_chars] + "\\n\\n...[truncated]"
        print(json.dumps({
            "text": text,
            "firstPage": first,
            "lastPage": last,
            "pageCount": n,
            "truncated": truncated,
        }))
else:
    raise SystemExit("unknown op: " + str(op))
`.trim()

  const child = spawn('python3', ['-c', script], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
  child.stdin.end(JSON.stringify(request), 'utf8')

  await new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `PDF operation failed: ${Buffer.concat(stderrChunks).toString('utf8') || `exit code ${code}`}`,
        ),
      )
    })
  })

  return JSON.parse(Buffer.concat(stdoutChunks).toString('utf8'))
}

/** Metadata and page count for a local PDF (uses pypdf on disk). */
export async function readPdfDocumentInfo(pdfPath: string): Promise<PdfDocumentInfo> {
  return (await runPypdfRpc({ op: 'info', path: pdfPath })) as PdfDocumentInfo
}

/** Extract text from inclusive 1-based page range. Large outputs are truncated to maxCharacters. */
export async function extractPdfTextPageRange(
  pdfPath: string,
  firstPage: number,
  lastPage: number,
  maxCharacters = 20_000,
): Promise<PdfPageRangeExtract> {
  return (await runPypdfRpc({
    op: 'pages',
    path: pdfPath,
    firstPage,
    lastPage,
    maxCharacters,
  })) as PdfPageRangeExtract
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const script = `
import json
import sys
from io import BytesIO
from pypdf import PdfReader

reader = PdfReader(BytesIO(sys.stdin.buffer.read()))
text = "\\n".join((page.extract_text() or "") for page in reader.pages)
print(json.dumps({"text": text}))
`.trim()

  const child = spawn('python3', ['-c', script], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
  child.stdin.end(buffer)

  await new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `PDF text extraction failed: ${Buffer.concat(stderrChunks).toString('utf8') || `exit code ${code}`}`,
        ),
      )
    })
  })

  return collapseWhitespace(
    (JSON.parse(Buffer.concat(stdoutChunks).toString('utf8')) as { text: string }).text,
  )
}

export async function readDocument(source: string, maxCharacters = 50000): Promise<ReadDocumentResult> {
  const isRemote = /^https?:\/\//i.test(source)
  let buffer: Buffer
  let contentType: string | null = null
  let title: string | null = null

  if (isRemote) {
    const response = await fetch(source, {
      headers: {
        'user-agent': 'BudgetBuckets/0.1 (+https://github.com/badlogic/pi-mono)',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
    contentType = response.headers.get('content-type')
  } else {
    buffer = await readFile(source)
  }

  const normalizedContentType = inferContentType(source, contentType)
  let text = ''

  if (normalizedContentType.includes('pdf')) {
    text = await extractPdfText(buffer)
    title = basename(source)
  } else {
    const html = buffer.toString('utf8')
    title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? basename(source)
    text = htmlToText(html)
  }

  return {
    source,
    title,
    contentType: normalizedContentType,
    text: text.slice(0, maxCharacters),
  }
}

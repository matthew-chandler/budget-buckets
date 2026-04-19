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

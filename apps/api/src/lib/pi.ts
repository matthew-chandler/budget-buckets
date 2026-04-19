import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  AuthStorage,
  createAgentSession,
  defineTool,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import {
  extractPdfTextPageRange,
  readDocument,
  readPdfDocumentInfo,
  renderPdfPagePng,
} from './document-reader.js'
import type {
  BudgetReport,
  ChatResponse,
  Citation,
  ScrapedBudgetPayload,
} from './types.js'
import { extractJsonObject } from './utils.js'

const FIREWORKS_PROVIDER = 'fireworks-router'
const FIREWORKS_MODEL_ID = 'accounts/fireworks/routers/kimi-k2p5-turbo'
const DEBUG_PI = process.env.BUDGET_BUCKETS_DEBUG_PI === '1'

const PDF_UPLOAD_SYSTEM_PROMPT = `
You are Budget Buckets' municipal budget analysis agent.

Your job:
1. Call pdf_document_info on the absolute PDF path in the user message to learn page count and document metadata.
2. Call pdf_extract_text one or more times on page ranges that contain the adopted budget figures you need (summary tables, functional/expenditure breakdowns, all-funds totals). Prefer targeted ranges over reading the entire document when the PDF is long.
3. When extracted text is empty, garbled, or clearly mis-ordered for wide tables or chart-heavy pages, call pdf_render_page on specific 1-based page numbers. The tool returns a PNG image in the tool result; use your vision capabilities to read numbers and labels from that page.
4. Use text from pdf_extract_text plus anything you read from pdf_render_page images to bucket spending into the standardized buckets below.

Hard rules:
- Use pdf_document_info, pdf_extract_text, and pdf_render_page only with the pdfPath given in the user message. Do not browse the web or use any other source.
- Do not inspect the environment, list directories, or run shell commands.
- Never invent a number, citation, or category. Missing fields must be null or [].
- Return JSON only. No markdown, no explanation, no code fences.
- For citations tied to the uploaded PDF, set "url" to "user-upload" and describe the page, table, or section in "title" and "note".

Stop once you have enough evidence from text and/or rendered pages to justify the JSON.
`.trim()

const SCRAPER_SYSTEM_PROMPT = `
You are Budget Buckets' municipal budget scraping agent.

Your job:
1. Use agent-browser through the browser_command tool to find an official city budget source.
2. Prefer official city websites, adopted budget books, CAFRs, or official PDF/HTML budget documents.
3. Once you find a credible source, use the read_document tool to extract text from the budget page or PDF.
4. Bucket the spending into the provided standardized buckets.

Hard rules:
- Use agent-browser for source discovery before reading documents.
- Use a dedicated session name supplied in the user prompt on every agent-browser command.
- Do not inspect the environment or available tools.
- Do not run ls, pwd, which, env, find, agent-browser --help, agent-browser skills, or documentation commands.
- Do not browse third-party summary sites once you have an official city source.
- Never invent a number, citation, or category.
- Missing fields are allowed and should be null or [].
- Return JSON only. No markdown, no explanation, no code fences.
- If multiple official budget docs exist, prefer the most recent adopted budget for the requested fiscal year.
- Stop once you have enough evidence to produce the JSON.
`.trim()

const CHAT_SYSTEM_PROMPT = `
You answer questions about one city's budget using only the provided structured budget record and citations.

Rules:
- Do not invent facts beyond the provided record.
- If the answer is uncertain or the data is missing, say so plainly.
- Keep answers concise and specific.
- When helpful, mention relevant source titles or URLs from the provided citations.
`.trim()

const readDocumentTool = defineTool({
  name: 'read_document',
  label: 'Read Document',
  description:
    'Fetch and extract plain text from an HTML page, PDF URL, or local file path. Use this after finding a promising budget source.',
  promptSnippet: 'read_document(source, maxCharacters) reads PDFs or HTML pages and returns extracted text.',
  promptGuidelines: [
    'Use read_document on official budget PDFs or city budget pages after finding them.',
    'Prefer the official adopted budget source over news summaries or third-party pages.',
  ],
  parameters: Type.Object({
    source: Type.String({ description: 'An https URL or local file path.' }),
    maxCharacters: Type.Optional(
      Type.Number({
        description: 'Maximum characters to return. Default 50000.',
      }),
    ),
  }) as any,
  async execute(_toolCallId, params: any) {
    const result = await readDocument(params.source, params.maxCharacters ?? 50000)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      details: {
        source: result.source,
        title: result.title,
        contentType: result.contentType,
        length: result.text.length,
      },
    }
  },
})

const pdfDocumentInfoTool = defineTool({
  name: 'pdf_document_info',
  label: 'PDF document info',
  description:
    'Return page count and basic metadata for a local PDF file. Call this first on an uploaded budget PDF.',
  promptSnippet:
    'pdf_document_info(pdfPath) returns pageCount, title, and author from the PDF.',
  promptGuidelines: [
    'Always call pdf_document_info once before pdf_extract_text so you know how many pages exist.',
    'Use only the pdfPath supplied in the user message.',
  ],
  parameters: Type.Object({
    pdfPath: Type.String({
      description: 'Absolute path to the PDF on the server (must match the path from the user message).',
    }),
  }) as any,
  async execute(_toolCallId, params: any) {
    const info = await readPdfDocumentInfo(String(params.pdfPath ?? '').trim())

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(info, null, 2),
        },
      ],
      details: {
        pageCount: info.pageCount,
        title: info.title,
      },
    }
  },
})

const pdfExtractTextTool = defineTool({
  name: 'pdf_extract_text',
  label: 'PDF extract text',
  description:
    'Extract text from an inclusive range of PDF pages (1-based page numbers). Use for budget tables and narrative sections.',
  promptSnippet:
    'pdf_extract_text(pdfPath, firstPage, lastPage, maxCharacters?) returns text with page markers.',
  promptGuidelines: [
    'Request only the page ranges you need; widen ranges if tables span pages.',
    'If output was truncated, narrow the range or split into additional calls.',
    'Use only the pdfPath supplied in the user message.',
  ],
  parameters: Type.Object({
    pdfPath: Type.String({
      description: 'Absolute path to the PDF on the server (must match the path from the user message).',
    }),
    firstPage: Type.Number({ description: 'First page to include (1-based).' }),
    lastPage: Type.Number({ description: 'Last page to include (1-based, inclusive).' }),
    maxCharacters: Type.Optional(
      Type.Number({
        description: 'Maximum characters of extracted text (default 20000).',
      }),
    ),
  }) as any,
  async execute(_toolCallId, params: any) {
    const pdfPath = String(params.pdfPath ?? '').trim()
    const firstPage = Math.max(1, Math.floor(Number(params.firstPage)))
    const lastPage = Math.max(firstPage, Math.floor(Number(params.lastPage)))
    const maxCharacters =
      params.maxCharacters !== undefined ? Math.floor(Number(params.maxCharacters)) : 20_000

    const result = await extractPdfTextPageRange(pdfPath, firstPage, lastPage, maxCharacters)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      details: {
        firstPage: result.firstPage,
        lastPage: result.lastPage,
        pageCount: result.pageCount,
        truncated: result.truncated,
        length: result.text.length,
      },
    }
  },
})

const pdfRenderPageTool = defineTool({
  name: 'pdf_render_page',
  label: 'PDF render page',
  description:
    'Rasterize one PDF page to a PNG image attached to the tool result (like the read tool for images). Use for dense tables, scans, or when pdf_extract_text is unusable.',
  promptSnippet:
    'pdf_render_page(pdfPath, page, scale?, maxSide?) returns a PNG for vision; page is 1-based.',
  promptGuidelines: [
    'Prefer pdf_extract_text for machine-readable text; use pdf_render_page when you need the visual layout.',
    'Render one page per call. Pick the smallest scale that keeps tables legible if context is tight.',
    'Use only the pdfPath supplied in the user message.',
  ],
  parameters: Type.Object({
    pdfPath: Type.String({
      description: 'Absolute path to the PDF on the server (must match the path from the user message).',
    }),
    page: Type.Number({ description: '1-based page index to render.' }),
    scale: Type.Optional(
      Type.Number({
        description:
          'Render scale factor before maxSide clamp (default 2). Lower (e.g. 1.25) for huge pages.',
      }),
    ),
    maxSide: Type.Optional(
      Type.Number({
        description: 'Maximum width or height in pixels after scaling (default 2000).',
      }),
    ),
  }) as any,
  async execute(_toolCallId, params: any) {
    const pdfPath = String(params.pdfPath ?? '').trim()
    const page = Math.max(1, Math.floor(Number(params.page)))
    const scale = params.scale !== undefined ? Number(params.scale) : undefined
    const maxSide = params.maxSide !== undefined ? Math.floor(Number(params.maxSide)) : undefined

    const image = await renderPdfPagePng(pdfPath, page, { scale, maxSide })
    const note = `Rendered PDF page ${image.page} as PNG (${image.width}x${image.height}). Read tables and figures from the attached image.`

    return {
      content: [
        { type: 'text', text: note },
        { type: 'image', data: image.data, mimeType: image.mimeType },
      ],
      details: {
        page: image.page,
        width: image.width,
        height: image.height,
      },
    }
  },
})

const browserCommandTool = defineTool({
  name: 'browser_command',
  label: 'Browser Command',
  description:
    'Run one agent-browser command for web navigation and extraction. Use this instead of bash.',
  promptSnippet:
    'browser_command(command) runs a single agent-browser command with the required session name.',
  promptGuidelines: [
    'Only use browser_command for agent-browser commands.',
    'Use direct page opens, snapshots, clicks, waits, url checks, and eval calls to reach the official source.',
    'Do not use browser_command for shell setup, environment discovery, or non-browser commands.',
  ],
  parameters: Type.Object({
    command: Type.String({
      description:
        'A single agent-browser command that includes --session <name>. Chaining with &&, ;, or pipes is not allowed.',
    }),
  }) as any,
  async execute(_toolCallId, params: any) {
    const command = String(params.command ?? '').trim()
    const timeoutMs = 30_000

    if (!command.startsWith('agent-browser ')) {
      throw new Error('browser_command only allows agent-browser commands.')
    }

    if (!command.includes('--session ')) {
      throw new Error('browser_command requires an agent-browser session name.')
    }

    if (/[;&|`]/.test(command)) {
      throw new Error('browser_command only allows a single command without shell chaining.')
    }

    if (
      /\b(--help|skills\b|which\b|pwd\b|ls\b|env\b|find\b|man\b|docs?\b)\b/i.test(
        command,
      )
    ) {
      throw new Error('browser_command rejected an exploratory or disallowed command.')
    }

    const child = spawn('zsh', ['-lc', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (code) => {
        clearTimeout(timeout)
        resolve(code ?? 1)
      })
    })

    const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim()
    const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
    const text = [stdout, stderr].filter(Boolean).join('\n')

    if (timedOut) {
      throw new Error(`browser_command timed out after ${timeoutMs}ms: ${command}`)
    }

    if (exitCode !== 0) {
      throw new Error(text || `browser_command failed with exit code ${exitCode}`)
    }

    return {
      content: [
        {
          type: 'text',
          text: text || '(no output)',
        },
      ],
      details: {
        command,
      },
    }
  },
})

function buildSearchUrls(input: {
  city: string
  state: string
  fiscalYearLabel?: string | null
}) {
  const yearHint = input.fiscalYearLabel?.trim() ? ` ${input.fiscalYearLabel.trim()}` : ''
  const queries = [
    `${input.city} ${input.state} official adopted budget pdf${yearHint}`,
    `${input.city} ${input.state} city budget pdf${yearHint}`,
    `${input.city} ${input.state} finance adopted budget${yearHint}`,
  ]

  return queries.map(
    (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  )
}

function summarizeToolArgs(args: unknown) {
  if (!args || typeof args !== 'object') {
    return ''
  }

  const command =
    'command' in args && typeof args.command === 'string'
      ? args.command
      : null
  const source =
    'source' in args && typeof args.source === 'string'
      ? args.source
      : null

  if (command) {
    return ` command=${JSON.stringify(command.slice(0, 240))}`
  }

  if (source) {
    return ` source=${JSON.stringify(source)}`
  }

  const pdfPath =
    'pdfPath' in args && typeof args.pdfPath === 'string' ? args.pdfPath : null
  const firstPage = 'firstPage' in args && typeof args.firstPage === 'number' ? args.firstPage : null
  const lastPage = 'lastPage' in args && typeof args.lastPage === 'number' ? args.lastPage : null

  if (pdfPath && firstPage != null && lastPage != null) {
    return ` pdfPath=${JSON.stringify(pdfPath)} pages=${firstPage}-${lastPage}`
  }

  const page = 'page' in args && typeof args.page === 'number' ? args.page : null
  if (pdfPath && page != null) {
    return ` pdfPath=${JSON.stringify(pdfPath)} page=${page}`
  }

  if (pdfPath) {
    return ` pdfPath=${JSON.stringify(pdfPath)}`
  }

  return ''
}

function attachSessionLogging(session: any, label: string) {
  if (!DEBUG_PI) {
    return () => {}
  }

  return session.subscribe((event: any) => {
    if (event?.type === 'tool_execution_start') {
      console.log(
        `[${label}] tool:start ${event.toolName ?? 'unknown'}${summarizeToolArgs(event.args)}`,
      )
      return
    }

    if (event?.type === 'tool_execution_end') {
      const detail = event.isError ? ' error=true' : ''
      console.log(`[${label}] tool:end ${event.toolName ?? 'unknown'}${detail}`)
    }
  })
}

async function createFireworksAgentSession(input: {
  cwd: string
  tools: any[]
  customTools?: any[]
}) {
  if (!process.env.FIREWORKS_API_KEY) {
    throw new Error('FIREWORKS_API_KEY is not set, so the Pi scraper cannot use the required Fireworks router model.')
  }

  const agentDir = await mkdtemp(join(tmpdir(), 'budget-buckets-pi-agent-'))
  const modelsPath = join(agentDir, 'models.json')

  await writeFile(
    modelsPath,
    JSON.stringify(
      {
        providers: {
          [FIREWORKS_PROVIDER]: {
            baseUrl: 'https://api.fireworks.ai/inference/v1',
            api: 'openai-completions',
            apiKey: 'FIREWORKS_API_KEY',
            authHeader: true,
            compat: {
              supportsDeveloperRole: false,
              supportsReasoningEffort: false,
            },
            models: [
              {
                id: FIREWORKS_MODEL_ID,
                name: 'Kimi K2.5 Turbo (Fireworks Router)',
                reasoning: false,
                input: ['text', 'image'],
                contextWindow: 256000,
                maxTokens: 256000,
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
              },
            ],
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  )

  const authStorage = AuthStorage.create(join(agentDir, 'auth.json'))
  const modelRegistry = ModelRegistry.create(authStorage, modelsPath)
  const model = modelRegistry.find(FIREWORKS_PROVIDER, FIREWORKS_MODEL_ID)

  if (!model) {
    throw new Error(`Could not load the required Pi model ${FIREWORKS_MODEL_ID}.`)
  }

  const result = await createAgentSession({
    cwd: input.cwd,
    agentDir,
    authStorage,
    modelRegistry,
    model,
    sessionManager: SessionManager.inMemory(),
    tools: input.tools,
    customTools: input.customTools,
  })

  return {
    ...result,
    agentDir,
  }
}

export async function scrapeBudgetFromUploadedPdfWithPi(input: {
  city: string
  state: string
  fiscalYearLabel?: string | null
  pdfPath: string
  fileName: string
}): Promise<ScrapedBudgetPayload> {
  const cwd = await mkdtemp(join(tmpdir(), 'budget-buckets-pdf-'))
  let agentDir: string | null = null

  try {
    const result = await createFireworksAgentSession({
      cwd,
      tools: [],
      customTools: [pdfDocumentInfoTool, pdfExtractTextTool, pdfRenderPageTool],
    })
    agentDir = result.agentDir
    const { session, modelFallbackMessage } = result

    if (!session.model) {
      throw new Error(modelFallbackMessage ?? 'No Pi model is configured. Run `pi /login` or set an API key first.')
    }

    session.agent.state.systemPrompt = PDF_UPLOAD_SYSTEM_PROMPT
    attachSessionLogging(session, `pdf:${input.city},${input.state}`)

    const prompt = `
Return this JSON shape exactly:
{
  "city": string | null,
  "state": string | null,
  "population": number | null,
  "fiscalYear": string | null,
  "currency": string | null,
  "totalBudget": number | null,
  "summary": string | null,
  "source": { "title": string | null, "url": string | null, "notes": string | null } | null,
  "buckets": [
    {
      "bucketKey": string | null,
      "label": string | null,
      "amount": number | null,
      "summary": string | null,
      "rawCategories": string[],
      "citationUrl": string | null,
      "citationTitle": string | null
    }
  ],
  "rawCategories": [
    {
      "name": string,
      "amount": number | null,
      "bucketKey": string | null,
      "note": string | null
    }
  ],
  "citations": [
    {
      "title": string,
      "url": string,
      "note": string | null,
      "appliesToBucketKey": string | null
    }
  ]
}

PDF file (use these tools only with this absolute pdfPath): ${input.pdfPath}
Original filename: ${input.fileName}
City and state for this budget: ${input.city}, ${input.state}
Fiscal year: ${input.fiscalYearLabel?.trim() ? input.fiscalYearLabel.trim() : 'infer from the document text if possible, otherwise null'}

Set source.title to the document or filename when known. Set source.url to null. Set source.notes to mention this came from a user-uploaded PDF.

Bucket keys:
- public-safety-justice
- public-works-infrastructure
- community-recreation
- health-human-services
- transportation
- government-operations-administration
- pensions-debt
- economic-development
- miscellaneous

Required workflow:
1. Call pdf_document_info with pdfPath="${input.pdfPath}".
2. Call pdf_extract_text with the same pdfPath for the page ranges that contain adopted budget totals and functional or departmental spending suitable for bucketing. Make additional calls if you need more sections.
3. If needed, call pdf_render_page for specific pages where vision will help (broken text extraction, wide tables, or scan-like pages).
4. Extract only supported figures from the returned text and/or rendered pages.
5. Return only JSON.
`.trim()

    await session.prompt(prompt, { expandPromptTemplates: false })

    const text = session.getLastAssistantText()
    if (!text) {
      throw new Error('The Pi PDF analysis session did not return any text.')
    }

    return extractJsonObject<ScrapedBudgetPayload>(text)
  } finally {
    await rm(cwd, { recursive: true, force: true })
    if (agentDir) {
      await rm(agentDir, { recursive: true, force: true })
    }
  }
}

export async function scrapeBudgetWithPi(input: {
  city: string
  state: string
  fiscalYearLabel?: string | null
}): Promise<ScrapedBudgetPayload> {
  const cwd = await mkdtemp(join(tmpdir(), 'budget-buckets-'))
  const browserSession = `budget-buckets-${Date.now().toString(36)}`
  const searchUrls = buildSearchUrls(input)
  let agentDir: string | null = null

  try {
    const result = await createFireworksAgentSession({
      cwd,
      tools: [],
      customTools: [browserCommandTool, readDocumentTool],
    })
    agentDir = result.agentDir
    const { session, modelFallbackMessage } = result

    if (!session.model) {
      throw new Error(modelFallbackMessage ?? 'No Pi model is configured. Run `pi /login` or set an API key first.')
    }

    session.agent.state.systemPrompt = SCRAPER_SYSTEM_PROMPT
    attachSessionLogging(session, `scrape:${input.city},${input.state}`)

    const prompt = `
Return this JSON shape exactly:
{
  "city": string | null,
  "state": string | null,
  "population": number | null,
  "fiscalYear": string | null,
  "currency": string | null,
  "totalBudget": number | null,
  "summary": string | null,
  "source": { "title": string | null, "url": string | null, "notes": string | null } | null,
  "buckets": [
    {
      "bucketKey": string | null,
      "label": string | null,
      "amount": number | null,
      "summary": string | null,
      "rawCategories": string[],
      "citationUrl": string | null,
      "citationTitle": string | null
    }
  ],
  "rawCategories": [
    {
      "name": string,
      "amount": number | null,
      "bucketKey": string | null,
      "note": string | null
    }
  ],
  "citations": [
    {
      "title": string,
      "url": string,
      "note": string | null,
      "appliesToBucketKey": string | null
    }
  ]
}

Requested city: ${input.city}, ${input.state}
Requested fiscal year: ${input.fiscalYearLabel ?? 'latest official adopted budget you can find'}
agent-browser session name: ${browserSession}
Suggested search URLs:
${searchUrls.map((url) => `- ${url}`).join('\n')}

Bucket keys:
- public-safety-justice
- public-works-infrastructure
- community-recreation
- health-human-services
- transportation
- government-operations-administration
- pensions-debt
- economic-development
- miscellaneous

Required workflow:
1. Use browser_command with agent-browser and the exact session name above on every command.
2. Start from one of the suggested search URLs above instead of a blank search homepage.
3. Find the best official city budget page or PDF on a first-party city domain.
4. Once you have an official budget page or PDF URL, call read_document on that source.
5. Extract only supported figures and citations from the document text.
6. Return only JSON.

Do not spend time exploring the environment. Do not run setup or discovery commands like ls, pwd, which, env, help pages, or tool documentation. Go directly to the search URL, then the official source, then read_document, then JSON.
`.trim()

    await session.prompt(prompt, { expandPromptTemplates: false })

    const text = session.getLastAssistantText()
    if (!text) {
      throw new Error('The Pi scraping session did not return any text.')
    }

    return extractJsonObject<ScrapedBudgetPayload>(text)
  } finally {
    await rm(cwd, { recursive: true, force: true })
    if (agentDir) {
      await rm(agentDir, { recursive: true, force: true })
    }
  }
}

export async function answerBudgetQuestion(report: BudgetReport, question: string): Promise<ChatResponse> {
  const cwd = await mkdtemp(join(tmpdir(), 'budget-buckets-chat-'))
  let agentDir: string | null = null

  try {
    const result = await createFireworksAgentSession({
      cwd,
      tools: [],
    })
    agentDir = result.agentDir
    const { session, modelFallbackMessage } = result

    if (!session.model) {
      throw new Error(modelFallbackMessage ?? 'No Pi model is configured. Run `pi /login` or set an API key first.')
    }

    session.agent.state.systemPrompt = CHAT_SYSTEM_PROMPT

    await session.prompt(
      [
        'Budget record:',
        JSON.stringify(report, null, 2),
        '',
        `Question: ${question}`,
      ].join('\n'),
      { expandPromptTemplates: false },
    )

    return {
      answer: session.getLastAssistantText() ?? 'No answer returned.',
      citations: report.citations as Citation[],
    }
  } finally {
    await rm(cwd, { recursive: true, force: true })
    if (agentDir) {
      await rm(agentDir, { recursive: true, force: true })
    }
  }
}

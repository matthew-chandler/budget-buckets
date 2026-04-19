import { serve } from '@hono/node-server'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import {
  bucketDefinitions,
  chatAboutBudget,
  compareBudgetReports,
  getBudgetHistory,
  resolveBudgetReport,
  resolveBudgetReportFromUploadedPdf,
  searchKnownCities,
} from './lib/budget-service.js'

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.onError((error, c) => {
  console.error(error)

  return c.json(
    {
      error: error.message || 'Unexpected server error.',
    },
    500,
  )
})

const resolveSchema = z.object({
  city: z.string().min(1),
  state: z.string().min(1),
  fiscalYear: z.string().trim().optional().nullable(),
})

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'budget-buckets-api',
    now: new Date().toISOString(),
  }),
)

app.get('/api/meta', (c) =>
  c.json({
    buckets: bucketDefinitions,
  }),
)

app.get('/api/search', async (c) => {
  const query = c.req.query('q') ?? ''
  return c.json({
    results: await searchKnownCities(query),
  })
})

app.post('/api/reports/resolve', zValidator('json', resolveSchema), async (c) => {
  const body = c.req.valid('json')
  return c.json(await resolveBudgetReport(body))
})

const MAX_PDF_BYTES = 100 * 1024 * 1024

app.post('/api/reports/upload-pdf', async (c) => {
  const body = await c.req.parseBody()
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const state = typeof body.state === 'string' ? body.state.trim() : ''
  const fiscalYearRaw = body.fiscalYear
  const fiscalYear =
    typeof fiscalYearRaw === 'string' && fiscalYearRaw.trim() ? fiscalYearRaw.trim() : null
  const file = body.file

  if (!city || !state) {
    return c.json({ error: 'city and state are required.' }, 400)
  }

  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'A PDF file is required.' }, 400)
  }

  const upload = file as File
  if (upload.size > MAX_PDF_BYTES) {
    return c.json({ error: `PDF must be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.` }, 400)
  }

  const arrayBuffer = await upload.arrayBuffer()
  const pdfBuffer = Buffer.from(arrayBuffer)

  if (pdfBuffer.length === 0) {
    return c.json({ error: 'The uploaded file is empty.' }, 400)
  }

  if (pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return c.json({ error: 'Upload must be a valid PDF file.' }, 400)
  }

  const fileName = typeof upload.name === 'string' && upload.name.trim() ? upload.name : 'budget.pdf'

  return c.json(
    await resolveBudgetReportFromUploadedPdf({
      city,
      state,
      fiscalYear,
      pdfBuffer,
      fileName,
    }),
  )
})

app.get('/api/reports/history', async (c) => {
  const city = c.req.query('city')
  const state = c.req.query('state')

  if (!city || !state) {
    return c.json({ error: 'city and state are required.' }, 400)
  }

  return c.json(await getBudgetHistory({ city, state }))
})

app.post(
  '/api/compare/cities',
  zValidator(
    'json',
    z.object({
      primary: resolveSchema,
      secondary: resolveSchema,
    }),
  ),
  async (c) => {
    const body = c.req.valid('json')
    return c.json(await compareBudgetReports(body))
  },
)

app.post(
  '/api/chat',
  zValidator(
    'json',
    resolveSchema.extend({
      question: z.string().min(1),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json')
    return c.json(await chatAboutBudget(body))
  },
)

const port = Number(process.env.PORT ?? 3001)

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Budget Buckets API listening on http://localhost:${info.port}`)
  },
)

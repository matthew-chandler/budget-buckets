import { existsSync, mkdirSync } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const sourcePdfDir = join(process.cwd(), 'data', 'source-pdfs')

mkdirSync(sourcePdfDir, { recursive: true })

export function sourcePdfPath(reportId: string): string {
  return join(sourcePdfDir, `${reportId}.pdf`)
}

export function sourcePdfExists(reportId: string): boolean {
  return existsSync(sourcePdfPath(reportId))
}

export async function writeSourcePdf(reportId: string, buffer: Buffer): Promise<void> {
  await writeFile(sourcePdfPath(reportId), buffer)
}

export async function deleteSourcePdf(reportId: string): Promise<void> {
  try {
    await unlink(sourcePdfPath(reportId))
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : ''
    if (code !== 'ENOENT') throw err
  }
}

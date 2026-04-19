import type { ReactNode } from 'react'

/**
 * Renders simple **bold** segments from agent answers (no full Markdown).
 */
export function formatChatAnswerToNodes(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  const out: ReactNode[] = []
  let k = 0
  for (const part of parts) {
    const m = part.match(/^\*\*([^*]+)\*\*$/)
    if (m) {
      out.push(<strong key={k++}>{m[1]}</strong>)
    } else if (part) {
      out.push(<span key={k++}>{part}</span>)
    }
  }
  return out
}

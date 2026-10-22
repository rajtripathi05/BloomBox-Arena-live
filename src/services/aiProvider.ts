/**
 * Future AI evaluation provider boundary. Nothing implements this yet: Round 1 scores are entered
 * or imported manually by council admins and stored with source 'manual' or 'import'.
 * A real integration should run server-side (Edge Function), write source 'ai' only from there,
 * and keep its API key out of the browser.
 */
export interface AiScoreRequest { teamName: string; pitchSummary: string; criteria: { key: string; max: number }[] }
export interface AiScoreResult { scores: Record<string, number>; rationale: string; model: string }
export interface AiEvaluationProvider { evaluate(req: AiScoreRequest): Promise<AiScoreResult> }

export const aiProvider: AiEvaluationProvider | null = null

/** Parse a CSV of `team,criterion1,criterion2,...` (header row required) for manual import. */
export function parseScoreCsv(csv: string, criteria: { key: string; max: number }[], teams: { id: string; name: string }[]) {
  const [head, ...lines] = csv.trim().split(/\r?\n/)
  const cols = head.split(',').map((c) => c.trim().toLowerCase())
  const rows: { teamId: string; scores: Record<string, number> }[] = []
  const errors: string[] = []
  lines.forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim())
    const team = teams.find((t) => t.name.toLowerCase() === cells[0]?.toLowerCase())
    if (!team) { errors.push(`Line ${i + 2}: unknown team "${cells[0]}"`); return }
    const scores: Record<string, number> = {}
    for (const c of criteria) {
      const idx = cols.indexOf(c.key.toLowerCase())
      const v = Number(cells[idx])
      if (idx < 0 || cells[idx] === '' || Number.isNaN(v) || v < 0 || v > c.max) { errors.push(`Line ${i + 2}: ${c.key} must be 0-${c.max}`); return }
      scores[c.key] = v
    }
    rows.push({ teamId: team.id, scores })
  })
  return { rows, errors }
}

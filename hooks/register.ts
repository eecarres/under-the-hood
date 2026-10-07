// under-the-hood mod: after each answered turn, a band above the prompt offers to explain it.
//   Explain                -> submits a prompt that runs the explain skill, so the explanation joins the conversation
//   Explain in new session -> the explanation runs in a session of its own, so this conversation stays on task:
//     desktop:  one short turn here writes a handoff and offers it as a suggested-task chip (spawn_task);
//               a mod cannot open a session or reach the desktop's ccd_session server, the model can
//     terminal: copies `claude --resume <id> --fork-session ...`, a real fork of this transcript, to paste in a new tab
// A specific topic goes through /under-the-hood:explain <topic>; the band covers "what we just did".
// On by default: only `explain_band: false` in the profile hides the band (the setup skill asks).
// State lives in $.state atoms, not module variables, so a hot reload keeps it.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

const offer = atom({ plugin: 'under-the-hood', key: 'offer' } as const, false)
const ownTurn = atom({ plugin: 'under-the-hood', key: 'ownTurn' } as const, false)

const EXPLAIN = 'Use the under-the-hood:explain skill on what we just did in this conversation.'

export const HANDOFF = [
  'Hand the explanation of what we just did off to a new session; do not explain it here.',
  'Call the mcp__ccd_session__spawn_task tool (load it with ToolSearch first if it is deferred) with:',
  '- title: "Explain: <the topic in a few words>"',
  '- tldr: one sentence on what the new session will explain',
  '- prompt: a self-contained handoff that starts with "Use the under-the-hood:explain skill on the work summarised below."',
  '  and then gives the new session everything it needs without this conversation: what was asked and what was done,',
  '  the decisions taken and why, the repos, file paths, PRs, commands and resources involved, and what is still open.',
  'Reply with one line saying the chip is ready. If the tool is not available here, say so in one line instead.',
].join('\n')

// Single quotes take everything literally in both shells; only the quote itself is escaped,
// POSIX by closing, escaping and reopening, PowerShell by doubling.
const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const ps = (s: string) => `'${s.replace(/'/g, `''`)}'`

// Windows terminals get PowerShell (the default there). Windows PowerShell 5.1 has no `&&`, so the
// launch is gated on -PassThru, which returns the new location only when the change succeeded.
// ponytail: cmd.exe is not covered; it would need its own quoting.
export function forkCommand(cwd: string, sessionId: string, isWindows = false): string {
  return isWindows
    ? `if (Set-Location -LiteralPath ${ps(cwd)} -PassThru) { claude --resume ${sessionId} --fork-session ${ps(EXPLAIN)} }`
    : `cd ${sh(cwd)} && claude --resume ${sessionId} --fork-session ${sh(EXPLAIN)}`
}

// A top-level flag; absent (or no profile) means on. YAML 1.2 spells false as false, False or FALSE.
export function isBandOn(profile: string): boolean {
  return !/^explain_band:[ \t]*(false|False|FALSE)[ \t]*(#.*)?$/m.test(profile)
}

// Never rejects: an unreadable profile behaves like a missing one (band on), and says so with a fixed line.
export async function readProfile($: EngineInterface): Promise<string> {
  const path = (await $.env.get('HOME')) + '/.claude/learning/profile.yaml'
  try {
    return (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  } catch {
    $.ui.log('Could not read the learner profile; using defaults')   // no path or OS error in the transcript
    return ''
  }
}

// A turn the band started: the band stays hidden after it, so it never offers to explain its own output.
async function submitOwn($: EngineInterface, text: string) {
  await update($, offer, () => false)
  await update($, ownTurn, () => true)
  // Not awaited: submit resolves only when the turn starts.
  $.prompt.submit({ text, asUser: true }).catch(async (err: Error) => {
    await update($, ownTurn, () => false)
    $.ui.toast('Could not start the explanation: ' + err.message)
  })
}

async function explainElsewhere($: EngineInterface, surface: RenderSurface) {
  if (surface !== 'terminal') return submitOwn($, HANDOFF)
  // The band stays up until the copy lands, so a failed one can be retried.
  try {
    const command = forkCommand(await $.session.cwd(), await $.session.id(), (await $.env.get('OS')) === 'Windows_NT')
    const copied = await $.ui.copy({ text: command, surface })
    if (!copied.isCopied) return $.ui.toast('Could not copy the fork command: ' + copied.reason)
  } catch (err) {
    return $.ui.toast('Could not build the fork command: ' + (err as Error).message)
  }
  await update($, offer, () => false)
  $.ui.toast('Fork command copied: paste it in a new terminal tab')
}

const explainHere = ($: EngineInterface) => submitOwn($, EXPLAIN)

export const register: Register = (on) => {
  // No prompt.submit hook: the band hides itself while a turn runs (isWorking), and turn.complete re-decides.
  on('turn.complete', async ($, e, next) => {
    try {
      if (!e.agentId) {   // subagent turns raise turn.complete too
        const wasOwn = await read($, ownTurn)
        await update($, ownTurn, () => false)
        const show = e.reason === 'answer' && !wasOwn && isBandOn(await readProfile($))
        await update($, offer, () => show)
      }
    } finally {
      return next(e)   // the plugins after this one see every turn, whatever happened above
    }
  })

  // The band is one slot shared by every plugin: draw what the plugins beneath drew too, never replace it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const theirs = await next(e)
    if (!(await read($, offer)) || e.props.hasSurvey || e.props.isWorking) return theirs
    const { Box, Text, Button } = $.ui.resolve(e)
    const row = Box({ flexDirection: 'row', children: [
      Text({ color: 'warning', bold: true, children: ['Under the Hood -> '] }),   // 'warning' is the theme's yellow
      Button({ key: 'here', label: 'Explain', variant: 'primary', onPress: () => explainHere($) }),
      Button({ key: 'aside', label: 'Explain in new session', onPress: (press) => explainElsewhere($, press.surface) }),
    ] })
    return theirs ? Box({ flexDirection: 'column', children: [row, theirs] }) : row
  })
}

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

// POSIX single quotes: nothing inside is expanded; a quote is closed, escaped and reopened.
const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

export function forkCommand(cwd: string, sessionId: string): string {
  return `cd ${sh(cwd)} && claude --resume ${sessionId} --fork-session ${sh(EXPLAIN)}`
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
  await update($, offer, () => false)
  const copied = await $.ui.copy({ text: forkCommand(await $.session.cwd(), await $.session.id()), surface })
  $.ui.toast(copied.isCopied
    ? 'Fork command copied: paste it in a new terminal tab'
    : 'Could not copy the fork command: ' + copied.reason)
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

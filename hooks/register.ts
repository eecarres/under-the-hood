// under-the-hood mod: after each answered turn, a band above the prompt offers to explain it.
//   Explain       -> submits a prompt that runs the explain skill, so the explanation joins the conversation
//   Explain in forked session -> $.model.fork answers over the transcript without adding to it, shown in a pane
// The fork has no tools, so the profile is read here and passed inside the prompt.
// A specific topic goes through /under-the-hood:explain <topic>; the band covers "what we just did".
// On by default: only `explain_band: false` in the profile hides the band (the setup skill asks).
// State lives in $.state atoms, not module variables, so a hot reload keeps it.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelForkResult, Register } from 'claude-code'

import type { Answer } from '../types'

const PANE = 'under-the-hood-explain'

const offer = atom({ plugin: 'under-the-hood', key: 'offer' } as const, false)
const ownTurn = atom({ plugin: 'under-the-hood', key: 'ownTurn' } as const, false)
const answer = atom({ plugin: 'under-the-hood', key: 'answer' } as const, null as Answer)
const forkSeq = atom({ plugin: 'under-the-hood', key: 'forkSeq' } as const, 0)

export function buildForkPrompt(profile: string): string {
  return [
    'Explain the mechanism underneath the most recent work in this conversation.',
    'Use only what is already in this conversation: you have no tools. If something you would need is not here, say so.',
    'Depth follows the learner profile below: level 0-1 from first principles, 2-3 straight to the mechanism, 4-5 only what is surprising.',
    'Cover what actually happens, why it is done this way here, and what would break otherwise. Lead with an analogy from background.home if analogies is true.',
    'Write in the profile\'s `language`. Keep it under 400 words.',
    '',
    profile ? 'Learner profile (YAML):\n' + profile : 'No learner profile found: explain at level 1.',
  ].join('\n')
}

// A top-level flag; absent (or no profile) means on. YAML 1.2 spells false as false, False or FALSE.
export function isBandOn(profile: string): boolean {
  return !/^explain_band:[ \t]*(false|False|FALSE)[ \t]*(#.*)?$/m.test(profile)
}

// The fork always resolves to a result, never null: branch on isAnswered, not on truthiness.
export function forkText(r: ModelForkResult): string {
  if (r.isAnswered) return r.text
  const why = {
    'nothing-to-fork': 'there is no answered turn to fork yet',
    'api-error': 'the API returned an error',
    'empty-reply': 'the fork replied without text',
    'aborted': 'the call was interrupted',
  }[r.reason]
  return `The fork could not answer: ${why}. Try again, or use Explain.`
}

// Never rejects: an unreadable profile behaves like a missing one (band on, level 1), and says so with a fixed line.
export async function readProfile($: EngineInterface): Promise<string> {
  const path = (await $.env.get('HOME')) + '/.claude/learning/profile.yaml'
  try {
    return (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  } catch {
    $.ui.log('Could not read the learner profile; using defaults')   // no path or OS error in the transcript
    return ''
  }
}

async function explainAside($: EngineInterface) {
  const id = await update($, forkSeq, (n) => n + 1)
  await update($, offer, () => false)
  await update($, answer, () => null)
  await $.ui.open({ id: PANE, title: 'Explain', focus: true, closeOnEscape: true })
  const text = forkText(await $.model.fork({ prompt: buildForkPrompt(await readProfile($)) }))
  if ((await read($, forkSeq)) === id) await update($, answer, () => text)   // a newer fork owns the pane
}

async function explainHere($: EngineInterface) {
  await update($, offer, () => false)
  await update($, ownTurn, () => true)
  // Not awaited: submit resolves only when the turn starts.
  $.prompt.submit({
    text: 'Use the under-the-hood:explain skill on what we just did in this conversation.',
    asUser: true,
  }).catch(async (err: Error) => {
    await update($, ownTurn, () => false)
    $.ui.toast('Could not start the explanation: ' + err.message)
  })
}

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
      Button({ key: 'aside', label: 'Explain in forked session', onPress: () => explainAside($) }),
    ] })
    return theirs ? Box({ flexDirection: 'column', children: [row, theirs] }) : row
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const text = await read($, answer)
    if (text === null) return Box({ children: [Text({ children: ['Asking the fork...'] })] })
    return Box({ flexDirection: 'column', children: [
      Markdown({ key: 'answer', text: text.slice(0, 10000) }),
      Button({ key: 'close', label: 'Close', hotkey: 'q', onPress: () => $.ui.close({ id: PANE }) }),
    ] })
  })
}

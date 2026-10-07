import { expect, test } from 'claude-code/testing'

import { forkCommand, isBandOn } from '../hooks/register.ts'

const BAND = {
  plugin: 'under-the-hood',
  component: 'AbovePrompt',
  viewport: { columns: 100, rows: 30 },
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 95, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const TURN = { answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as const
const ON = 'language: English\n'   // no explain_band key: on by default

function stubBasics(on: any, profile: string | null, readError?: string) {
  on('env.get', () => ({ value: '/home/me' }))
  on('fs.exists', () => ({ value: profile !== null }))
  on('fs.read', () => (readError ? { deny: readError } : { value: profile ?? '' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Box({ key: 'engine' }))   // the engine's own drawing when the band yields
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: no band before a turn answers, band after`, async ($, on) => {
    stubBasics(on, ON)
    const before = await $.ui.mount({ ...BAND, surface })
    expect(await before.find({ key: 'here' })).toBeUndefined()

    await $.turn.complete(TURN)
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'here' })).toBeDefined()
    expect(await ui.find({ key: 'aside' })).toBeDefined()
  })
}

test('no band after an interrupted turn', async ($, on) => {
  stubBasics(on, ON)
  await $.turn.complete({ ...TURN, reason: 'aborted', isAborted: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'here' })).toBeUndefined()
})

test('no band when the profile turns it off', async ($, on) => {
  stubBasics(on, 'explain_band: false\n')
  await $.turn.complete(TURN)
  expect(await (await $.ui.mount({ ...BAND, surface: 'terminal' })).find({ key: 'here' })).toBeUndefined()
})

test('band on by default: no profile, or a profile without the key', async ($, on) => {
  stubBasics(on, null)
  await $.turn.complete(TURN)
  expect(await (await $.ui.mount({ ...BAND, surface: 'terminal' })).find({ key: 'here' })).toBeDefined()
})

test('Explain submits the explain skill and does not offer to explain the explanation', async ($, on) => {
  stubBasics(on, ON)
  let submitted = ''
  on('prompt.submit', ($, e) => { submitted = e.text; return { text: e.text } })

  await $.turn.complete(TURN)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'here' })
  expect(submitted).toContain('under-the-hood:explain')

  await $.turn.complete({ ...TURN, turnId: 't2' })
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await after.find({ key: 'here' })).toBeUndefined()
})

test('Explain in new session on desktop: one turn here hands off to a spawn_task chip, then the band stays hidden', async ($, on) => {
  stubBasics(on, ON)
  let submitted = ''
  on('prompt.submit', ($, e) => { submitted = e.text; return { text: e.text } })

  await $.turn.complete(TURN)
  await (await $.ui.mount({ ...BAND, surface: 'desktop' })).press({ key: 'aside' })
  expect(submitted).toContain('mcp__ccd_session__spawn_task')
  expect(submitted).toContain('under-the-hood:explain')

  await $.turn.complete({ ...TURN, turnId: 't2' })
  expect(await (await $.ui.mount({ ...BAND, surface: 'desktop' })).find({ key: 'aside' })).toBeUndefined()
})

test('Explain in new session on the terminal: copies a fork of this session, no turn here', async ($, on) => {
  stubBasics(on, ON)
  let copied = ''
  let submitted = false
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.id', () => ({ value: 'abc-123' }))
  on('ui.copy', ($, e) => { copied = e.text; return { value: { isCopied: true as const } } })
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', ($, e) => { submitted = true; return { text: e.text } })

  await $.turn.complete(TURN)
  await (await $.ui.mount({ ...BAND, surface: 'terminal' })).press({ key: 'aside' })
  expect(copied).toBe(forkCommand('/repo', 'abc-123'))
  expect(copied).toContain('--resume abc-123 --fork-session')
  expect(submitted).toBe(false)
})

test('Explain in new session on the terminal: a failed copy keeps the band up so it can be retried', async ($, on) => {
  stubBasics(on, ON)
  let toast = ''
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.id', () => ({ value: 'abc-123' }))
  on('ui.copy', () => ({ value: { isCopied: false as const, reason: 'no clipboard' } }))
  on('ui.toast', ($, e) => { toast = e.text; return { value: undefined } })

  await $.turn.complete(TURN)
  await (await $.ui.mount({ ...BAND, surface: 'terminal' })).press({ key: 'aside' })
  expect(toast).toContain('Could not copy')
  expect(await (await $.ui.mount({ ...BAND, surface: 'terminal' })).find({ key: 'aside' })).toBeDefined()
})

test('the Windows fork command is PowerShell: doubled quotes, launch gated on the location change, no &&', async () => {
  const cmd = forkCommand("C:\\Users\\me\\it's here", 'id', true)
  expect(cmd).toStartWith(`if (Set-Location -LiteralPath 'C:\\Users\\me\\it''s here' -PassThru) { claude --resume id --fork-session `)
  expect(cmd.endsWith(' }')).toBe(true)
  expect(cmd).not.toContain('&&')
})

test('the fork command quotes a cwd with spaces and quotes so the shell takes it literally', async () => {
  expect(forkCommand("/Users/me/it's here", 'id')).toContain(`cd '/Users/me/it'\\''s here' && `)
})

test('the band stacks on what the plugins beneath drew instead of replacing it', async ($, on) => {
  stubBasics(on, ON)
  await $.turn.complete(TURN)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'here' })).toBeDefined()
  expect(await ui.find({ key: 'engine' })).toBeDefined()
})

test('explain_band: false is honored in every YAML 1.2 spelling, and nothing else turns the band off', async () => {
  for (const v of ['false', 'False', 'FALSE', 'false  # hidden for now']) expect(isBandOn(`explain_band: ${v}\n`)).toBe(false)
  for (const v of ['true', '"false"', 'falsey']) expect(isBandOn(`explain_band: ${v}\n`)).toBe(true)
  expect(isBandOn('language: English\n')).toBe(true)
})

test('an unreadable profile still passes the turn on and falls back to the default band', async ($, on) => {
  stubBasics(on, ON, 'EACCES: permission denied')
  let logged = ''
  on('ui.log', ($, e) => { logged = e.text; return { value: undefined } })

  const result = await $.turn.complete(TURN)
  expect(result).toEqual({ text: 'done' })   // the engine's stub ran, so next(e) was called
  expect(logged).toBe('Could not read the learner profile; using defaults')
  expect(logged).not.toContain('/home/me')
  expect(await (await $.ui.mount({ ...BAND, surface: 'terminal' })).find({ key: 'here' })).toBeDefined()
})

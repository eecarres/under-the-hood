import { expect, test } from 'claude-code/testing'

import { isBandOn } from '../hooks/register.ts'

const PANE = {
  plugin: 'under-the-hood',
  component: 'Pane',
  requestId: 'under-the-hood-explain',
  viewport: { columns: 100, rows: 30 },
  props: { title: 'Explain', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const BAND = {
  plugin: 'under-the-hood',
  component: 'AbovePrompt',
  viewport: { columns: 100, rows: 30 },
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 95, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const TURN = { answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as const
const ON = 'language: English\n'   // no explain_band key: on by default
const USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const ANSWERED = (text: string) => ({ value: { isAnswered: true as const, text, usage: USAGE } })

function stubBasics(on: any, profile: string | null, readError?: string) {
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
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

test('Explain aside: profile goes into the fork prompt and the answer is drawn', async ($, on) => {
  stubBasics(on, ON + 'language: Spanish\nareas:\n  - key: terraform\n    level: 2\n')
  let sent = ''
  on('model.fork', ($, e) => { sent = e.prompt; return ANSWERED('Terraform guarda estado...') })

  await $.turn.complete(TURN)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'aside' })

  expect(sent).toContain('language: Spanish')
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ key: 'answer' })).toBeDefined()
})

test('Explain aside: a fork that did not answer shows why instead of breaking the pane', async ($, on) => {
  stubBasics(on, ON)
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded' as const, usage: USAGE } }))

  await $.turn.complete(TURN)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'aside' })

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(JSON.stringify(await pane.find({ key: 'answer' }))).toContain('the API returned an error')
})

test('Explain aside: a late reply from an older fork does not replace the newer one', async ($, on) => {
  stubBasics(on, ON)
  let release = () => {}
  const first = new Promise<void>((r) => { release = r })
  let calls = 0
  on('model.fork', async () => {
    calls += 1
    if (calls === 1) { await first; return ANSWERED('old') }
    return ANSWERED('new')
  })

  await $.turn.complete(TURN)
  const slow = (await $.ui.mount({ ...BAND, surface: 'terminal' })).press({ key: 'aside' })
  await $.turn.complete({ ...TURN, turnId: 't2' })
  await (await $.ui.mount({ ...BAND, surface: 'terminal' })).press({ key: 'aside' })
  release()
  await slow

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const drawn = JSON.stringify(await pane.find({ key: 'answer' }))
  expect(drawn).toContain('new')
  expect(drawn).not.toContain('old')
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
  expect(logged).toContain('could not read')
  expect(await (await $.ui.mount({ ...BAND, surface: 'terminal' })).find({ key: 'here' })).toBeDefined()
})

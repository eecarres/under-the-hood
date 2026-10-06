import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'under-the-hood',
  component: 'Pane',
  requestId: 'under-the-hood-why',
  viewport: { columns: 100, rows: 30 },
  props: { title: 'Why', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

function stubBasics(on: any, profile: string | null) {
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('fs.exists', () => ({ value: profile !== null }))
  on('fs.read', () => ({ value: profile ?? '' }))
}

test('forked: profile goes into the fork prompt and the answer is drawn', async ($, on) => {
  stubBasics(on, 'language: Spanish\nareas:\n  - key: terraform\n    level: 2\n')
  let sent = ''
  on('model.fork', ($, e) => { sent = e.prompt; return { value: { text: 'Terraform guarda estado...', usage: {} } } })

  await $.command.run({ command: 'why', args: 'the moved block' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'fork' })

  expect(sent).toContain('"the moved block"')
  expect(sent).toContain('language: Spanish')
  expect(await ui.find({ key: 'answer' })).toBeDefined()
})

test('forked: a null fork (cold cache) shows a fallback instead of nothing', async ($, on) => {
  stubBasics(on, null)
  on('model.fork', () => ({ value: null }))

  await $.command.run({ command: 'why', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'fork' })

  const a = await ui.find({ key: 'answer' })
  expect(JSON.stringify(a)).toContain('could not answer')
})

test('this session: submits a prompt that invokes the explain skill', async ($, on) => {
  stubBasics(on, null)
  let submitted = ''
  on('prompt.submit', ($, e) => { submitted = e.text; return {} })

  await $.command.run({ command: 'why', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'here' })

  expect(submitted).toContain('under-the-hood:explain')
})

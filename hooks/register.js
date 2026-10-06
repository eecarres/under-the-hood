// under-the-hood mod: /why explains the latest work, either in this session or in a fork.
//   this session -> submits a prompt, so the explanation becomes part of the conversation
//   fork         -> $.model.fork answers over the transcript without adding to it, shown in a pane
// The fork has no tools, so the profile is read here and passed inside the prompt.

const PANE = 'under-the-hood-why'

let topic = ''        // text typed after /why, empty = "what we just did"
let answer = null     // fork result shown in the pane, null = show the choice
let busy = false

export function buildForkPrompt(profile, topic) {
  return [
    'Explain the mechanism underneath ' + (topic ? '"' + topic + '"' : 'the most recent work in this conversation') + '.',
    'Use only what is already in this conversation: you have no tools. If something you would need is not here, say so.',
    'Depth follows the learner profile below: level 0-1 from first principles, 2-3 straight to the mechanism, 4-5 only what is surprising.',
    'Cover what actually happens, why it is done this way here, and what would break otherwise. Lead with an analogy from background.home if analogies is true.',
    'Write in the profile\'s `language`. Keep it under 400 words.',
    '',
    profile ? 'Learner profile (YAML):\n' + profile : 'No learner profile found: explain at level 1.',
  ].join('\n')
}

async function readProfile($) {
  const home = await $.env.get('HOME')
  const path = home + '/.claude/learning/profile.yaml'
  return (await $.fs.exists(path)) ? await $.fs.read(path) : ''
}

async function runFork($) {
  busy = true
  $.ui.invalidate('ui.render')
  const reply = await $.model.fork({ prompt: buildForkPrompt(await readProfile($), topic) })
  answer = reply ? reply.text
    : 'The fork could not answer (cold cache or API error). Try again after the next turn, or pick "This session".'
  busy = false
  $.ui.invalidate('ui.render')
}

function runHere($) {
  // Not awaited: submit resolves only when the turn starts.
  $.prompt.submit({
    text: 'Use the under-the-hood:explain skill on ' + (topic || 'what we just did in this conversation') + '.',
    asUser: true,
  }).catch((err) => $.ui.toast('Could not start the explanation: ' + err.message))
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'why',
      description: 'Explain the latest work at your profile depth: here or in a fork',
      argumentHint: '[topic]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'why' }, async ($, e) => {
    topic = (e.args || '').trim()
    answer = null
    await $.ui.open({ id: PANE, title: 'Why', focus: true, closeOnEscape: true })
    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const close = () => $.ui.close({ id: PANE })

    if (busy) return Box({ children: [Text({ children: ['Asking the fork...'] })] })
    if (answer !== null) {
      return Box({ flexDirection: 'column', children: [
        Markdown({ key: 'answer', text: answer.slice(0, 10000) }),
        Button({ key: 'close', label: 'Close', hotkey: 'q', onPress: close }),
      ] })
    }
    return Box({ flexDirection: 'column', children: [
      Text({ children: ['Explain ' + (topic || 'what we just did') + ':'] }),
      Box({ flexDirection: 'row', children: [
        Button({ key: 'here', label: 'This session', hotkey: '1', onPress: () => { close(); runHere($) } }),
        Button({ key: 'fork', label: 'Forked (keeps the transcript clean)', hotkey: '2', onPress: () => runFork($) }),
      ] }),
    ] })
  })
}

// The fork's reply shown in the pane, null while the fork runs.
export type Answer = string | null

declare module 'claude-code' {
  interface PluginState {
    'under-the-hood': {
      offer: boolean      // show the band: the last main-loop turn answered and the band is on
      ownTurn: boolean    // the running turn is the explanation the band started
      answer: Answer
      forkSeq: number     // id of the latest fork: a reply from an older one is dropped
    }
  }
}

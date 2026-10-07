// A contract exports at least one type (the validator refuses a bare `export {}`); this names the flag below.
export type TurnOwner = boolean

declare module 'claude-code' {
  interface PluginState {
    'under-the-hood': {
      offer: boolean      // show the band: the last main-loop turn answered and the band is on
      ownTurn: TurnOwner  // the running turn is one the band started (an explanation or a handoff)
    }
  }
}

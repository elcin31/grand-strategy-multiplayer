/** Synchronous latch: two taps in the same React render may start only one operation. */
export class LaunchAction {
  private busy = false;
  constructor(private readonly changed: (busy: boolean) => void, private readonly paint: () => Promise<void>, private readonly started: (latencyMs:number) => void = ()=>{}) {}
  async run(action: () => Promise<void>): Promise<boolean> {
    if (this.busy) return false;
    const tapAt=performance.now();
    this.busy = true;
    this.changed(true);
    // Android can suspend RAF while another surface is being prepared.
    // Painting is a courtesy, never a precondition for dispatching the action.
    let timer:ReturnType<typeof setTimeout>|undefined;
    try { await Promise.race([this.paint(),new Promise<void>(r=>{timer=setTimeout(r,100);})]);clearTimeout(timer); this.started(performance.now()-tapAt); await action(); return true; }
    finally {clearTimeout(timer); this.busy = false; this.changed(false); }
  }
}

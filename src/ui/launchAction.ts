/** Synchronous latch: two taps in the same React render may start only one operation. */
export class LaunchAction {
  private busy = false;
  constructor(private readonly changed: (busy: boolean) => void, private readonly paint: () => Promise<void>, private readonly started: (latencyMs:number) => void = ()=>{}) {}
  async run(action: () => Promise<void>): Promise<boolean> {
    if (this.busy) return false;
    const tapAt=performance.now();
    this.busy = true;
    this.changed(true);
    try { await this.paint(); this.started(performance.now()-tapAt); await action(); return true; }
    finally { this.busy = false; this.changed(false); }
  }
}

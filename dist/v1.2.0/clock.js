export const COUNTDOWN_MS = 3000, ROUND_MS = 60000;
export class RoundClock {
  constructor({startsAt = null, endsAt = null, countdownRemaining = null}) {
    this.startsAt = startsAt; this.endsAt = endsAt; this.countdownRemaining = countdownRemaining;
  }
  static prepare() { return new RoundClock({countdownRemaining:COUNTDOWN_MS}); }
  static start(now) { return new RoundClock({startsAt: now + COUNTDOWN_MS, endsAt: now + COUNTDOWN_MS + ROUND_MS}); }
  static restore(value) {
    if (!value) return null;
    if (value.countdownRemaining != null) {
      return value.startsAt === null && value.endsAt === null && Number.isSafeInteger(value.countdownRemaining) && value.countdownRemaining > 0 && value.countdownRemaining <= COUNTDOWN_MS ? new RoundClock(value) : null;
    }
    return Number.isSafeInteger(value.startsAt) && value.startsAt >= 0 && Number.isSafeInteger(value.endsAt) && value.endsAt - value.startsAt === ROUND_MS ? new RoundClock(value) : null;
  }
  startCountdown(now) {
    if (this.countdownRemaining === null) return false;
    this.startsAt = now + this.countdownRemaining; this.endsAt = this.startsAt + ROUND_MS;
    this.countdownRemaining = null; return true;
  }
  pauseCountdown(now) {
    if (this.at(now).phase !== 'countdown') return false;
    this.countdownRemaining = this.startsAt - now; this.startsAt = null; this.endsAt = null;
    return true;
  }
  at(now) {
    if (this.countdownRemaining !== null) return {phase:'ready',count:Math.ceil(this.countdownRemaining/1000),remaining:ROUND_MS,seconds:60};
    if (now < this.startsAt) return {phase:'countdown',count:Math.min(3,Math.ceil((this.startsAt - now)/1000)),remaining:ROUND_MS,seconds:60};
    const remaining = Math.max(0, this.endsAt - now);
    return {phase:remaining > 0 ? 'playing' : 'ended',count:0,remaining,seconds:Math.ceil(remaining/1000)};
  }
  canPlay(now) { return this.countdownRemaining === null && now >= this.startsAt && now < this.endsAt; }
  snapshot() {
    const value = {startsAt:this.startsAt, endsAt:this.endsAt};
    if (this.countdownRemaining !== null) value.countdownRemaining = this.countdownRemaining;
    return value;
  }
}

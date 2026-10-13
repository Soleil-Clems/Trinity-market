const DAY_MS = 86_400_000;

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

export function dateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(dateOnly(isoDate).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function isoWeekday(isoDate: string): number {
  return dateOnly(isoDate).getUTCDay() || 7;
}

export function weekIndex(isoDate: string): number {
  return Math.floor((dateOnly(isoDate).getTime() / DAY_MS + 3) / 7);
}

export function timeOfDay(minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, 0, minutes));
}

export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallClock = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );

  return wallClock - instant;
}

export function zonedDateTime(
  isoDate: string,
  minutes: number,
  timeZone: string,
): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, 0, minutes);
  const firstGuess = wallClock - offsetAt(wallClock, timeZone);

  return new Date(wallClock - offsetAt(firstGuess, timeZone));
}

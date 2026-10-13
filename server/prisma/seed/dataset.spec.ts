import { buildDataset, TIME_ZONE } from './dataset.js';
import { todayIn, zonedDateTime } from './time.js';

const TODAY = '2026-11-09';

describe('zonedDateTime', () => {
  it('converts a Paris summer time to UTC', () => {
    expect(zonedDateTime('2026-10-24', 480, TIME_ZONE).toISOString()).toBe(
      '2026-10-24T06:00:00.000Z',
    );
  });

  it('converts a Paris winter time to UTC', () => {
    expect(zonedDateTime('2026-10-26', 480, TIME_ZONE).toISOString()).toBe(
      '2026-10-26T07:00:00.000Z',
    );
  });

  it('rolls over to the next day past midnight', () => {
    expect(zonedDateTime('2026-11-06', 1460, TIME_ZONE).toISOString()).toBe(
      '2026-11-06T23:20:00.000Z',
    );
  });
});

describe('todayIn', () => {
  it('uses the local date of the time zone', () => {
    expect(todayIn(TIME_ZONE, new Date('2026-11-08T23:30:00.000Z'))).toBe(
      '2026-11-09',
    );
  });
});

describe('buildDataset', () => {
  const dataset = buildDataset(TODAY);
  const sessionsOf = (email: string) =>
    dataset.sessions
      .filter((session) => session.email === email)
      .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());

  it('contains the people and teams required by the ticket', () => {
    const count = (role: string) =>
      dataset.people.filter((person) => person.role === role).length;

    expect(count('MANAGER')).toBe(2);
    expect(count('EMPLOYEE')).toBe(15);
    expect(count('ADMIN')).toBe(1);
    expect(dataset.teams).toHaveLength(3);
    expect(new Set(dataset.people.map(({ email }) => email)).size).toBe(18);
  });

  it('is reproducible for a given day', () => {
    expect(buildDataset(TODAY)).toEqual(dataset);
  });

  it('covers four weeks ending the day before', () => {
    const times = dataset.sessions.map(({ clockIn }) => clockIn.getTime());

    expect(new Date(Math.min(...times)).toISOString().slice(0, 10)).toBe(
      '2026-10-12',
    );
    expect(Math.max(...times)).toBeLessThan(
      zonedDateTime(TODAY, 0, TIME_ZONE).getTime(),
    );
  });

  it('never ends a session before it starts', () => {
    for (const session of dataset.sessions) {
      if (session.clockOut) {
        expect(session.clockOut.getTime()).toBeGreaterThan(
          session.clockIn.getTime(),
        );
      }
    }
  });

  it('never overlaps two sessions of the same person', () => {
    for (const { email } of dataset.people) {
      const sessions = sessionsOf(email);

      for (let index = 1; index < sessions.length; index += 1) {
        const previous = sessions[index - 1];

        expect(previous.clockOut).not.toBeNull();
        expect(sessions[index].clockIn.getTime()).toBeGreaterThanOrEqual(
          previous.clockOut!.getTime(),
        );
      }
    }
  });

  it('leaves two forgotten clock-outs, each as the last session', () => {
    const open = dataset.sessions.filter(({ clockOut }) => clockOut === null);

    expect(open).toHaveLength(2);
    for (const session of open) {
      expect(sessionsOf(session.email).at(-1)).toBe(session);
    }
  });

  it('plans at most one shift per person and per day', () => {
    const keys = dataset.shifts.map(({ email, date }) => `${email}|${date}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('records no session during an absence', () => {
    for (const absence of dataset.absences) {
      const start = zonedDateTime(absence.startDate, 0, TIME_ZONE).getTime();
      const end = zonedDateTime(absence.endDate, 1440, TIME_ZONE).getTime();
      const during = sessionsOf(absence.email).filter(
        ({ clockIn }) => clockIn.getTime() >= start && clockIn.getTime() < end,
      );

      expect(during).toHaveLength(0);
    }
  });

  it('includes the situations the KPIs must detect', () => {
    const localDay = (date: Date) => todayIn(TIME_ZONE, date);
    const minutes = (session: (typeof dataset.sessions)[number]) =>
      (session.clockOut!.getTime() - session.clockIn.getTime()) / 60_000;
    const closed = dataset.sessions.filter(({ clockOut }) => clockOut);

    const crossesMidnight = closed.some(
      (session) => localDay(session.clockIn) !== localDay(session.clockOut!),
    );
    const sixHoursWithoutBreak = closed.some(
      (session) => minutes(session) > 360,
    );
    const lateArrivals = dataset.shifts.filter((shift) => {
      const first = sessionsOf(shift.email).find(
        ({ clockIn }) => localDay(clockIn) === shift.date,
      );
      const limit = zonedDateTime(
        shift.date,
        shift.startMinutes + 5,
        TIME_ZONE,
      );

      return first !== undefined && first.clockIn > limit;
    });
    const dailyTotals = new Map<string, number>();
    for (const session of closed) {
      const key = `${session.email}|${localDay(session.clockIn)}`;
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + minutes(session));
    }

    expect(crossesMidnight).toBe(true);
    expect(sixHoursWithoutBreak).toBe(true);
    expect(lateArrivals.length).toBeGreaterThan(5);
    expect(Math.max(...dailyTotals.values())).toBeGreaterThan(600);
    expect(dataset.corrections).toHaveLength(1);
  });
});

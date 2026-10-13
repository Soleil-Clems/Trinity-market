import {
  addDays,
  createRandom,
  isoWeekday,
  randomInt,
  weekIndex,
  zonedDateTime,
} from './time.js';

export const TIME_ZONE = 'Europe/Paris';
export const HISTORY_DAYS = 28;

type TeamKey = 'support' | 'warehouse' | 'accounting';
type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export interface PersonSpec {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  teams: TeamKey[];
  contractMinutesPerWeek: number;
  rotation?: number;
  lateRate?: number;
  overtime?: boolean;
  skipsBreak?: boolean;
  closesLate?: boolean;
  dayOff?: number;
  forgetsClockOut?: boolean;
}

export interface TeamSpec {
  key: TeamKey;
  name: string;
  description: string;
  managerEmail: string;
}

export interface ShiftSpec {
  email: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SessionSpec {
  email: string;
  clockIn: Date;
  clockOut: Date | null;
  source: 'WEB' | 'MANUAL';
}

export interface AbsenceSpec {
  email: string;
  startDate: string;
  endDate: string;
  type: 'PAID_LEAVE' | 'RTT' | 'OTHER';
  createdByEmail: string;
}

export interface CorrectionSpec {
  email: string;
  clockIn: Date;
  clockOut: Date;
  actorEmail: string;
  reason: string;
}

export interface Dataset {
  people: PersonSpec[];
  teams: TeamSpec[];
  shifts: ShiftSpec[];
  sessions: SessionSpec[];
  absences: AbsenceSpec[];
  corrections: CorrectionSpec[];
}

const FULL_TIME = 35 * 60;
const PART_TIME = 28 * 60;
const SOPHIE = 'sophie.martin@trinitymarket.example';
const NADIA = 'nadia.benali@trinitymarket.example';
const CAMILLE = 'camille.laurent@trinitymarket.example';
const KARIM = 'karim.haddad@trinitymarket.example';

function person(
  firstName: string,
  lastName: string,
  role: Role,
  teams: TeamKey[],
  options: Partial<PersonSpec> = {},
): PersonSpec {
  const slug = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]+/g, '-');

  return {
    email: `${slug(firstName)}.${slug(lastName)}@trinitymarket.example`,
    firstName,
    lastName,
    role,
    teams,
    contractMinutesPerWeek: FULL_TIME,
    ...options,
  };
}

export const PEOPLE: PersonSpec[] = [
  person('Marc', 'Dubois', 'ADMIN', []),
  person('Sophie', 'Martin', 'MANAGER', []),
  person('Nadia', 'Benali', 'MANAGER', []),
  person('Camille', 'Laurent', 'EMPLOYEE', ['support'], { rotation: 0 }),
  person('Lucas', 'Petit', 'EMPLOYEE', ['support'], {
    rotation: 1,
    lateRate: 0.35,
  }),
  person('Inès', 'Moreau', 'EMPLOYEE', ['support'], {
    rotation: 0,
    closesLate: true,
  }),
  person('Hugo', 'Fournier', 'EMPLOYEE', ['support'], {
    rotation: 1,
    forgetsClockOut: true,
  }),
  person('Léa', 'Girard', 'EMPLOYEE', ['support'], {
    rotation: 0,
    lateRate: 0.2,
  }),
  person('Yanis', 'Roux', 'EMPLOYEE', ['support', 'warehouse'], {
    rotation: 1,
  }),
  person('Karim', 'Haddad', 'EMPLOYEE', ['warehouse'], { overtime: true }),
  person('Emma', 'Lefèvre', 'EMPLOYEE', ['warehouse'], { overtime: true }),
  person('Thomas', 'Garnier', 'EMPLOYEE', ['warehouse'], {
    skipsBreak: true,
  }),
  person('Fatou', 'Diallo', 'EMPLOYEE', ['warehouse'], { lateRate: 0.15 }),
  person('Julien', 'Mercier', 'EMPLOYEE', ['warehouse']),
  person('Chloé', 'Blanc', 'EMPLOYEE', ['warehouse']),
  person('Antoine', 'Chevalier', 'EMPLOYEE', ['accounting']),
  person('Manon', 'Robin', 'EMPLOYEE', ['accounting'], {
    contractMinutesPerWeek: PART_TIME,
    dayOff: 3,
  }),
  person('Paul', 'Vidal', 'EMPLOYEE', ['accounting'], {
    forgetsClockOut: true,
  }),
];

export const TEAMS: TeamSpec[] = [
  {
    key: 'support',
    name: 'Service client',
    description: 'Créneaux tournants du matin et de l’après-midi',
    managerEmail: SOPHIE,
  },
  {
    key: 'warehouse',
    name: 'Entrepôt',
    description: 'Préparation et expédition des commandes',
    managerEmail: NADIA,
  },
  {
    key: 'accounting',
    name: 'Comptabilité',
    description: 'Horaires de bureau, sans créneau imposé',
    managerEmail: NADIA,
  },
];

function isBetween(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function buildDataset(today: string, seed = 2026): Dataset {
  const random = createRandom(seed);
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) =>
    addDays(today, index - HISTORY_DAYS),
  );
  const mondays = days.filter((date) => isoWeekday(date) === 1);
  const lastWorkday = [...days]
    .reverse()
    .find((date) => isoWeekday(date) <= 5)!;
  const peakStart = mondays[2] ?? mondays[0];
  const lateEvening = addDays(peakStart, 2);

  const absences: AbsenceSpec[] = [
    {
      email: 'lea.girard@trinitymarket.example',
      startDate: mondays[1],
      endDate: addDays(mondays[1], 4),
      type: 'PAID_LEAVE',
      createdByEmail: SOPHIE,
    },
    {
      email: 'antoine.chevalier@trinitymarket.example',
      startDate: addDays(mondays[0], 4),
      endDate: addDays(mondays[0], 4),
      type: 'RTT',
      createdByEmail: NADIA,
    },
    {
      email: 'julien.mercier@trinitymarket.example',
      startDate: addDays(mondays[1], 1),
      endDate: addDays(mondays[1], 2),
      type: 'OTHER',
      createdByEmail: NADIA,
    },
  ];

  const shifts: ShiftSpec[] = [];
  const sessions: SessionSpec[] = [];
  const corrections: CorrectionSpec[] = [];
  const at = (date: string, minutes: number) =>
    zonedDateTime(date, minutes, TIME_ZONE);

  for (const worker of PEOPLE.filter(({ role }) => role === 'EMPLOYEE')) {
    const team = worker.teams[0];

    for (const date of days) {
      const weekday = isoWeekday(date);
      const isAbsent = absences.some(
        (absence) =>
          absence.email === worker.email &&
          isBetween(date, absence.startDate, absence.endDate),
      );
      const isPeak = date >= peakStart;

      if (isAbsent || weekday === 7 || weekday === worker.dayOff) {
        continue;
      }

      if (weekday === 6) {
        if (worker.overtime && date === addDays(peakStart, 5)) {
          sessions.push({
            email: worker.email,
            clockIn: at(date, 360 + randomInt(random, -5, 5)),
            clockOut: at(date, 715 + randomInt(random, 0, 10)),
            source: 'WEB',
          });
        }
        continue;
      }

      let start = 540;
      let end = 1050;
      let breakMinutes = 60;
      let hasShift = false;

      if (team === 'support') {
        const isMorning = (weekIndex(date) + (worker.rotation ?? 0)) % 2 === 0;
        start = isMorning ? 480 : 840;
        end = start + 480;
        breakMinutes = 45;
        hasShift = true;
      } else if (team === 'warehouse') {
        start = 360;
        end = 840;
        breakMinutes = 30;
        hasShift = true;

        if (worker.email === KARIM && date === lateEvening) {
          start = 840;
          end = 1320;
        }
      }

      if (hasShift) {
        shifts.push({
          email: worker.email,
          date,
          startMinutes: start,
          endMinutes: end,
        });
      }

      const isLate = random() < (worker.lateRate ?? 0.05);
      const arrival =
        start +
        (isLate ? randomInt(random, 6, 25) : randomInt(random, -10, 4)) +
        (team === 'accounting' ? randomInt(random, -10, 20) : 0);
      let departure = end + randomInt(random, -3, 12);

      if (worker.overtime && isPeak) {
        departure += randomInt(random, 60, 150);
      }
      if (worker.email === KARIM && date === addDays(peakStart, 1)) {
        departure = end + 250;
      }
      if (worker.email === KARIM && date === lateEvening) {
        departure = end + 30;
      }
      if (worker.closesLate && weekday === 5 && start === 840) {
        departure = 1440 + randomInt(random, 10, 30);
      }

      const isLastDay = date === lastWorkday;
      const leavesOpen = Boolean(worker.forgetsClockOut) && isLastDay;
      const skipsBreak = Boolean(worker.skipsBreak) && random() < 0.25;

      if (skipsBreak) {
        sessions.push({
          email: worker.email,
          clockIn: at(date, arrival),
          clockOut: at(date, departure),
          source: 'WEB',
        });
        continue;
      }

      const breakStart = start + 240 + randomInt(random, -5, 5);
      const breakEnd = breakStart + breakMinutes + randomInt(random, 0, 5);
      const isCorrected =
        worker.email === CAMILLE && date === addDays(mondays[0], 1);

      sessions.push({
        email: worker.email,
        clockIn: at(date, arrival),
        clockOut: at(date, breakStart),
        source: 'WEB',
      });
      sessions.push({
        email: worker.email,
        clockIn: at(date, breakEnd),
        clockOut: leavesOpen ? null : at(date, departure),
        source: isCorrected ? 'MANUAL' : 'WEB',
      });

      if (isCorrected) {
        corrections.push({
          email: worker.email,
          clockIn: at(date, breakEnd),
          clockOut: at(date, departure),
          actorEmail: SOPHIE,
          reason: 'Départ oublié, heure confirmée par l’employée',
        });
      }
    }
  }

  return {
    people: PEOPLE,
    teams: TEAMS,
    shifts,
    sessions,
    absences,
    corrections,
  };
}

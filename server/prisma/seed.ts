import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { buildDataset, TIME_ZONE } from './seed/dataset.js';
import { dateOnly, timeOfDay, todayIn } from './seed/time.js';

export const DEMO_PASSWORD = 'TimeManager-Demo-2026';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must not run in production');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const dataset = buildDataset(todayIn(TIME_ZONE, new Date()));
    const passwordHash = await hash(DEMO_PASSWORD);

    await prisma.$transaction(
      async (tx) => {
        await tx.auditLog.deleteMany();
        await tx.passwordResetToken.deleteMany();
        await tx.refreshToken.deleteMany();
        await tx.absence.deleteMany();
        await tx.workSession.deleteMany();
        await tx.shift.deleteMany();
        await tx.teamMembership.deleteMany();
        await tx.team.deleteMany();
        await tx.user.deleteMany();

        const users = await tx.user.createManyAndReturn({
          data: dataset.people.map((person, index) => ({
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: `+336000000${String(index + 1).padStart(2, '0')}`,
            role: person.role,
            contractMinutesPerWeek: person.contractMinutesPerWeek,
            timezone: TIME_ZONE,
            passwordHash,
          })),
          select: { id: true, email: true },
        });
        const userId = new Map(users.map(({ id, email }) => [email, id]));
        const idOf = (email: string) => userId.get(email)!;

        const teams = await tx.team.createManyAndReturn({
          data: dataset.teams.map((team) => ({
            name: team.name,
            description: team.description,
            managerId: idOf(team.managerEmail),
          })),
          select: { id: true, name: true },
        });
        const teamId = new Map(
          dataset.teams.map((team) => [
            team.key,
            teams.find(({ name }) => name === team.name)!.id,
          ]),
        );

        await tx.teamMembership.createMany({
          data: dataset.people.flatMap((person) =>
            person.teams.map((team) => ({
              userId: idOf(person.email),
              teamId: teamId.get(team)!,
            })),
          ),
        });
        await tx.shift.createMany({
          data: dataset.shifts.map((shift) => ({
            userId: idOf(shift.email),
            date: dateOnly(shift.date),
            startTime: timeOfDay(shift.startMinutes),
            endTime: timeOfDay(shift.endMinutes),
          })),
        });
        await tx.absence.createMany({
          data: dataset.absences.map((absence) => ({
            userId: idOf(absence.email),
            startDate: dateOnly(absence.startDate),
            endDate: dateOnly(absence.endDate),
            type: absence.type,
            createdById: idOf(absence.createdByEmail),
          })),
        });
        await tx.workSession.createMany({
          data: dataset.sessions.map((session) => ({
            userId: idOf(session.email),
            clockIn: session.clockIn,
            clockOut: session.clockOut,
            source: session.source,
          })),
        });

        for (const correction of dataset.corrections) {
          const session = await tx.workSession.findFirstOrThrow({
            where: {
              userId: idOf(correction.email),
              clockIn: correction.clockIn,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: idOf(correction.actorEmail),
              action: 'work_session.corrected',
              entityType: 'work_session',
              entityId: session.id,
              before: { clockOut: null },
              after: { clockOut: correction.clockOut.toISOString() },
              reason: correction.reason,
            },
          });
        }
      },
      { timeout: 60_000 },
    );

    console.log(
      `Seed done: ${dataset.people.length} users, ${dataset.teams.length} teams, ` +
        `${dataset.shifts.length} shifts, ${dataset.sessions.length} sessions, ` +
        `${dataset.absences.length} absences.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();

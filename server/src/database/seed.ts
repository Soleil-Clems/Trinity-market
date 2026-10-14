// Chemin : server/src/database/seed.ts (compilé en dist/database/seed.js)
// Crée les comptes de test utilisés par les audits d'accessibilité de la CI.
// Entrée : SEED_USERS = [{"email":"…","password":"…","role":"employee|manager|admin"}]
// À ADAPTER : remplacer l'appel marqué TODO par votre service de création d'utilisateur
// (il doit hacher le mot de passe comme l'inscription normale).
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
// import { UsersService } from '../users/users.service';

type SeedUser = { email: string; password: string; role: 'employee' | 'manager' | 'admin' };

async function main() {
  if (process.env.ALLOW_SEED !== 'true') {
    throw new Error('Seed refusé : définir ALLOW_SEED=true (jamais en production).');
  }
  const users: SeedUser[] = JSON.parse(process.env.SEED_USERS ?? '[]');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  // const usersService = app.get(UsersService);
  for (const u of users) {
    // TODO : await usersService.upsertForSeed({ email: u.email, password: u.password, role: u.role });
    void u;
  }
  await app.close();
  // Jamais d'e-mail ni de mot de passe dans les logs : seulement des compteurs
  console.log(JSON.stringify({ level: 'info', msg: 'seed terminé', users: users.length }));
}

main().catch((e: Error) => {
  console.error(JSON.stringify({ level: 'error', msg: 'seed en échec', error: e.message }));
  process.exit(1);
});

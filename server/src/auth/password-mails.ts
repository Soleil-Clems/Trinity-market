import type { MailMessage } from '../mail/mail.service.js';

export interface MailRecipient {
  email: string;
  firstName: string;
}

export function activationMail(
  recipient: MailRecipient,
  link: string,
): MailMessage {
  return {
    to: recipient.email,
    subject: 'Activez votre compte Time Manager',
    text: [
      `Bonjour ${recipient.firstName},`,
      '',
      'Votre manager vous a créé un compte Time Manager.',
      'Choisissez votre mot de passe en suivant ce lien, valable 72 heures et utilisable une seule fois :',
      link,
      '',
      "Si vous n'attendiez pas ce message, ignorez-le.",
    ].join('\n'),
  };
}

export function passwordResetMail(
  recipient: MailRecipient,
  link: string,
): MailMessage {
  return {
    to: recipient.email,
    subject: 'Réinitialisation de votre mot de passe Time Manager',
    text: [
      `Bonjour ${recipient.firstName},`,
      '',
      'Une réinitialisation de votre mot de passe a été demandée.',
      'Choisissez un nouveau mot de passe en suivant ce lien, valable 30 minutes et utilisable une seule fois :',
      link,
      '',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
    ].join('\n'),
  };
}

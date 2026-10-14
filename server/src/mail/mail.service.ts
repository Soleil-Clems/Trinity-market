import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Mail } from 'nodemailer';
import { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly transporter: Mail;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
    });
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}

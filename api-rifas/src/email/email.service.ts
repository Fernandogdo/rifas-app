import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from 'src/prisma/prisma.service';
import * as Handlebars from 'handlebars';
import { Resend } from 'resend';

type TemplateName =
  | 'payment_confirmed'
  | 'numbers_assigned'
  | 'order_pending'
  | 'mis_numeros_link';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /** Driver: 'smtp' para nodemailer | 'resend' para API HTTP */
  private driver: 'smtp' | 'resend';

  /** SMTP (local o cuando se permita) */
  private transporter?: nodemailer.Transporter;

  /** Resend (Render u otros PaaS con egress SMTP bloqueado) */
  private resend?: Resend;

  constructor(private prisma: PrismaService) {
    // Preferimos el valor explícito; si estamos en Render y no seteaste, usamos 'resend'
    const envDriver = (process.env.MAIL_DRIVER || '').toLowerCase();
    this.driver =
      (envDriver === 'smtp' || envDriver === 'resend')
        ? (envDriver as 'smtp' | 'resend')
        : (process.env.RENDER ? 'resend' : 'smtp');

    if (this.driver === 'smtp') {
      // SMTP clásico (Gmail o el que uses)
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT || 465);
      const secure = port === 465; // 465 = SSL; 587 = STARTTLS
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else {
      // Resend por API HTTP (no requiere puerto SMTP)
      if (!process.env.RESEND_API_KEY) {
        this.logger.warn('MAIL_DRIVER=resend pero falta RESEND_API_KEY');
      }
      this.resend = new Resend(process.env.RESEND_API_KEY || '');
    }
  }

  async onModuleInit() {
    if (this.driver === 'smtp') {
      try {
        await this.transporter!.verify();
        this.logger.log('SMTP conectado correctamente');
      } catch (e: any) {
        this.logger.error('SMTP verify falló: ' + (e?.message || e));
      }
    } else {
      this.logger.log('Email driver: Resend (HTTP API)');
    }
  }

  // === Fallback en código por si no hay plantilla en BD ===
  private codeFallback(template: TemplateName, data: Record<string, any>) {
    switch (template) {
      case 'payment_confirmed': {
        const subject = `Pago confirmado - ${data.rifaTitulo}`;
        const html = `
          <h2>¡Pago confirmado!</h2>
          <p>Gracias por tu compra de ${data.cantidad} boleto(s) para <b>${data.rifaTitulo}</b>.</p>
          <p>Total: <b>$${Number(data.total).toFixed(2)}</b></p>
          <p>En breve recibirás otro correo con tus números asignados.</p>
        `;
        return { subject, html };
      }
      case 'numbers_assigned': {
        const nums = (data.numeros as number[]).slice().sort((a,b)=>a-b).join(', ');
        const subject = `Tus números - ${data.rifaTitulo}`;
        const html = `
          <h2>Tus números</h2>
          <p>Estos son tus números para <b>${data.rifaTitulo}</b>:</p>
          <p style="font-size:18px"><b>${nums}</b></p>
          <p>¡Mucha suerte!</p>
        `;
        return { subject, html };
      }
      case 'order_pending': {
        const subject = `Orden creada - ${data.rifaTitulo}`;
        const html = `
          <h2>Orden creada</h2>
          <p>Generaste una orden por ${data.cantidad} boleto(s) para <b>${data.rifaTitulo}</b>.</p>
          <p>Total: <b>$${Number(data.total).toFixed(2)}</b></p>
          <p>Completa tu pago para confirmar. ID de orden: ${data.orderId}</p>
        `;
        return { subject, html };
      }
      case 'mis_numeros_link': {
        const minutos = Number(data.minutos ?? 30);
        const url = String(data.url ?? '#');
        const subject = `Consulta tus números`;
        const html = `
          <h2>Consulta tus números</h2>
          <p>Generamos un enlace seguro para que puedas ver tus órdenes y números asignados.</p>
          <p>Este enlace expira en <b>${minutos} minutos</b>.</p>
          <p>
            <a href="${url}" style="
              display:inline-block;padding:12px 18px;text-decoration:none;
              background:#4f46e5;color:#fff;border-radius:6px;font-weight:600;">
              Ver mis números
            </a>
          </p>
          <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <p style="word-break:break-all"><a href="${url}">${url}</a></p>
          <hr/>
          <p style="color:#555;font-size:12px">Si no solicitaste este enlace, puedes ignorar este mensaje.</p>
        `;
        return { subject, html };
      }
    }
  }

  // === Render dinámico desde BD con Handlebars; cae al fallback si no hay tpl activa ===
  private async renderFromDbOrFallback(
    template: TemplateName,
    data: Record<string, any>,
    locale = 'es-EC',
  ): Promise<{ subject: string; html: string }> {
    const prepared: Record<string, any> = { ...data };

    if (template === 'numbers_assigned' && Array.isArray(prepared.numeros)) {
      prepared.numerosStr = prepared.numeros.slice().sort((a:number,b:number)=>a-b).join(', ');
    }
    if (typeof prepared.total === 'number') {
      prepared.total = Number(prepared.total).toFixed(2);
    }

    const tpl = await this.prisma.emailTemplate.findUnique({
      where: { name_locale: { name: template, locale } as any },
    });

    if (!tpl || !tpl.isActive) {
      return this.codeFallback(template, prepared);
    }

    const subject = Handlebars.compile(tpl.subjectTpl)(prepared);
    const html    = Handlebars.compile(tpl.htmlTpl)(prepared);
    return { subject, html };
  }

  async send(
    template: TemplateName,
    to: string,
    data: Record<string, any>,
    ordenId?: string,
  ) {
    const { subject, html } = await this.renderFromDbOrFallback(template, data);
    const from = process.env.FROM_EMAIL ?? 'no-reply@midominio.com';

    try {
      if (this.driver === 'smtp') {
        await this.transporter!.sendMail({ from, to, subject, html });
      } else {
        // Resend via HTTP API
        const res = await this.resend!.emails.send({ from, to, subject, html });
        if ('error' in res && res.error) {
          throw new Error(res.error.message);
        }
      }

      await this.prisma.emailLog.create({
        data: { to, template, data, status: 'sent', ordenId: ordenId ?? null },
      });
    } catch (err: any) {
      this.logger.error(`Email error [${template}] to ${to}: ${err?.message}`);
      await this.prisma.emailLog.create({
        data: {
          to, template, data,
          status: 'failed',
          error: String(err?.message ?? err),
          ordenId: ordenId ?? null,
        },
      });
      // Si quieres reintentos con BullMQ, puedes relanzar:
      // throw err;
    }
  }
}

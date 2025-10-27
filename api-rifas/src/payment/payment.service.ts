import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/email/email.service';
import { AssignService } from 'src/orders/assign.service';
import axios from 'axios';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly base =
    process.env.PAYPHONE_API_BASE_URL ||
    'https://pay.payphonetodoesposible.com';

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private assign: AssignService,
  ) {}

  // ---------- Helpers -------------------------------------------------------

  private parsePayphoneUrl(data: any): string | undefined {
    return (
      data?.payWithCard ||
      data?.shortUrl ||
      data?.link ||
      data?.url ||
      (typeof data === 'string' && /^https?:\/\//.test(data) ? data : undefined)
    );
  }

  private requireEnv() {
    const token = process.env.PAYPHONE_API_TOKEN;
    const storeId = process.env.PAYPHONE_STORE_ID;
    if (!token || !storeId) {
      throw new InternalServerErrorException(
        'PayPhone no configurado. Define PAYPHONE_API_TOKEN y PAYPHONE_STORE_ID en .env',
      );
    }
    return { token, storeId };
  }

  // Convierte Prisma.Decimal | string | number a centavos enteros válidos
  private toCents(input: any): number {
    const n =
      typeof input === 'number'
        ? input
        : typeof input === 'string'
          ? parseFloat(input.replace(',', '.'))
          : input && typeof input.toNumber === 'function'
            ? input.toNumber()
            : Number(input);

    if (!Number.isFinite(n)) {
      throw new InternalServerErrorException('Total inválido (no numérico)');
    }
    const cents = Math.round(n * 100);
    if (!Number.isInteger(cents) || cents <= 0) {
      throw new InternalServerErrorException('Amount inválido (centavos <= 0)');
    }
    return cents;
  }

  private async ensureClientTx(orderId: string): Promise<{ clientTx: string }> {
    const order = await this.prisma.orden.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const sanitize = (v: string) => v.replace(/[^A-Za-z0-9]/g, '');
    let id = order.clientTransactionId
      ? sanitize(order.clientTransactionId)
      : '';

    // Re-generar si no existe, si es >15 o si quedó vacío tras sanear
    if (!id || id.length > 15) {
      id = (
        sanitize(order.id).slice(0, 12) + Date.now().toString(36).slice(-3)
      ).slice(0, 15);
      await this.prisma.orden.update({
        where: { id: orderId },
        data: { clientTransactionId: id, paymentIntentId: id },
      });
    } else if (!order.paymentIntentId) {
      await this.prisma.orden.update({
        where: { id: orderId },
        data: { paymentIntentId: id },
      });
    }
    return { clientTx: id };
  }

  // --------- Utilidades para normalización del webhook ----------------------

  // getByPathCaseInsensitive(payload, 'transaction.amount') / 'Amount' / etc.
  private getByPathCaseInsensitive(obj: any, path: string) {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
      if (!cur || typeof cur !== 'object') return undefined;
      const key = Object.keys(cur).find(
        (k) => k.toLowerCase() === part.toLowerCase(),
      );
      if (!key) return undefined;
      cur = cur[key];
    }
    return cur;
  }

  private pickFirst(obj: any, candidates: string[]) {
    for (const c of candidates) {
      const v = this.getByPathCaseInsensitive(obj, c);
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  }

  // Normaliza payload PayPhone (acepta PascalCase/camelCase y raíz/transaction.*)
  private normalizePayphonePayload(payload: any) {
    const toNum = (v: any) => (v == null ? undefined : Number(v));
    const toStr = (v: any) => (v == null ? undefined : String(v));

    const amount = toNum(
      this.pickFirst(payload, ['Amount', 'amount', 'transaction.amount']),
    );
    const clientTransactionId = toStr(
      this.pickFirst(payload, [
        'ClientTransactionId',
        'clientTransactionId',
        'transaction.clientTransactionId',
      ]),
    );
    const statusCode = toNum(
      this.pickFirst(payload, [
        'StatusCode',
        'statusCode',
        'transaction.statusCode',
      ]),
    );
    const transactionStatus = toStr(
      this.pickFirst(payload, [
        'TransactionStatus',
        'transactionStatus',
        'transaction.status',
      ]),
    );
    const storeId = toStr(
      this.pickFirst(payload, ['StoreId', 'storeId', 'transaction.storeId']),
    );
    const transactionId = toStr(
      this.pickFirst(payload, [
        'TransactionId',
        'transactionId',
        'transaction.id',
      ]),
    );
    const authorizationCode = toStr(
      this.pickFirst(payload, [
        'AuthorizationCode',
        'authorizationCode',
        'transaction.authorizationCode',
      ]),
    );
    const email = toStr(this.pickFirst(payload, ['Email', 'email']));
    const phoneNumber = toStr(
      this.pickFirst(payload, ['PhoneNumber', 'phoneNumber']),
    );
    const reference = toStr(
      this.pickFirst(payload, ['Reference', 'reference']),
    );

    return {
      amount,
      clientTransactionId,
      statusCode,
      transactionStatus,
      storeId,
      transactionId,
      authorizationCode,
      email,
      phoneNumber,
      reference,
      raw: payload,
    };
  }

  // ---------- API pública usada por el front --------------------------------

  /**
   * Crea un Link de pago para una orden. Usa AXIOS (robusto) + toCents.
   */
  async createSession(provider: string, orderId: string) {
    if (provider !== 'payphone') {
      throw new BadRequestException(`Proveedor no soportado: ${provider}`);
    }

    const order = await this.prisma.orden.findUnique({
      where: { id: orderId },
      include: { rifa: { select: { titulo: true } } },
    });
    if (!order) throw new NotFoundException('Orden no existe');
    if (order.estado !== 'pendiente') {
      throw new BadRequestException('Orden no está pendiente');
    }

    // Asegura clientTransactionId <= 15
    const { clientTx } = await this.ensureClientTx(orderId);
    const { token, storeId } = this.requireEnv();

    const amountCents = this.toCents(order.total);

    const body = {
      amount: amountCents,
      amountWithoutTax: amountCents,
      clientTransactionId: clientTx,
      currency: 'USD',
      storeId,
      reference:
        `Rifa ${order.rifa?.titulo ?? ''} #${order.id.slice(-6)}`.slice(0, 100),
      oneTime: true,
    };

    const linksUrl = new URL('api/Links', this.base).toString();

    const resp = await axios.post(linksUrl, body, {
      headers: {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'rifas-app/axios',
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const { status, statusText, headers, data } = resp;

    if (status < 200 || status >= 300) {
      const code = data?.errorCode ?? data?.ErrorCode;
      this.logger.error(
        `PP SESSION FAIL ${status} ${statusText} order=${order.id} clientTx=${clientTx}
Headers: ${JSON.stringify(headers)}
Body: ${
          typeof data === 'string'
            ? String(data).slice(0, 1000)
            : JSON.stringify(data).slice(0, 1000)
        }`,
      );

      const friendly =
        (code ? `ErrorCode ${code}: ` : '') +
        (data?.message ||
          data?.error ||
          (Array.isArray(data?.errors)
            ? data.errors
                .map(
                  (e: any) =>
                    `${e.message}: ${(e.errorDescriptions || []).join(', ')}`,
                )
                .join(' | ')
            : '') ||
          statusText ||
          `HTTP ${status}`);

      throw new InternalServerErrorException(`PayPhone: ${friendly}`);
    }

    // Captura del link (string o JSON)
    let checkoutUrl: string | undefined;
    if (typeof data === 'string') {
      checkoutUrl = /^https?:\/\//.test(data) ? data : undefined;
    } else if (data && typeof data === 'object') {
      checkoutUrl =
        data.payWithCard || data.shortUrl || data.link || data.url || undefined;
    }

    if (!checkoutUrl) {
      this.logger.warn(
        `PayPhone OK ${status} pero sin URL. typeof data=${typeof data}; ejemplo= ${
          typeof data === 'string'
            ? data.slice(0, 200)
            : JSON.stringify(data).slice(0, 200)
        }`,
      );
      throw new InternalServerErrorException(
        'PayPhone no devolvió un link de pago',
      );
    }

    return { checkoutUrl, paymentIntentId: clientTx };
  }

  // ---------- Webhook (Notificación Externa PayPhone) -----------------------
  /**
   * NOTA: Este handler devuelve el esquema que PayPhone espera:
   *   { "Response": true|false, "ErrorCode": "000|..." }
   * Códigos típicos:
   *   000 OK, 111/222 genérico, 333 auth, 444 requeridos, 666 storeId inválido, 777, etc.
   */
  async handleWebhook(
    provider: string,
    _headers: Record<string, string>,
    payload: any,
  ) {
    if (provider !== 'payphone') {
      throw new BadRequestException(`Proveedor no soportado: ${provider}`);
    }

    const { storeId: envStoreId } = this.requireEnv();
    const p = this.normalizePayphonePayload(payload);

    // Requeridos por la doc (mínimos para procesar)
    // Amount (centavos), AuthorizationCode, ClientTransactionId, StatusCode,
    // TransactionStatus, StoreId, TransactionId
    if (
      p.amount == null ||
      !p.authorizationCode ||
      !p.clientTransactionId ||
      p.statusCode == null ||
      !p.transactionStatus ||
      !p.storeId ||
      !p.transactionId
    ) {
      this.logger.warn(
        `Webhook PayPhone faltan requeridos: ${JSON.stringify({
          amount: p.amount,
          authorizationCode: !!p.authorizationCode,
          clientTransactionId: !!p.clientTransactionId,
          statusCode: p.statusCode,
          transactionStatus: p.transactionStatus,
          storeId: p.storeId,
          transactionId: p.transactionId,
        })}`,
      );
      return { Response: false, ErrorCode: '444' }; // variables requeridas
    }

    // (Opcional pero recomendable) validar StoreId exacto
    if (envStoreId && p.storeId !== envStoreId) {
      this.logger.warn(
        `Webhook StoreId no coincide: got=${p.storeId} expected=${envStoreId}`,
      );
      return { Response: false, ErrorCode: '666' }; // tienda inválida
    }

    // Aprobación (doc: 3 = Aprobada, TransactionStatus = Approved)
    const approved =
      p.statusCode === 3 ||
      (typeof p.transactionStatus === 'string' &&
        p.transactionStatus.toLowerCase() === 'approved');

    if (!approved) {
      this.logger.warn(
        `Webhook PayPhone NO aprobado: statusCode=${p.statusCode} status=${p.transactionStatus}`,
      );
      // Consumimos igual para que no reintenten
      return { Response: true, ErrorCode: '000' };
    }

    // Idempotencia: registra por clientTx (o usa transactionId como respaldo)
    const uniqueKey = String(p.clientTransactionId || p.transactionId);
    const already = await this.prisma.webhookEvent.findFirst({
      where: { paymentIntentId: uniqueKey },
    });
    if (!already) {
      await this.prisma.webhookEvent.create({
        data: {
          provider,
          paymentIntentId: uniqueKey,
          signatureValid: true, // no hay firma oficial
          payload,
          processedAt: new Date(),
        },
      });
    }

    // Busca la orden por clientTransactionId
    const order = await this.prisma.orden.findFirst({
      where: { clientTransactionId: p.clientTransactionId },
      include: { rifa: { select: { titulo: true } } },
    });
    if (!order) {
      this.logger.warn(
        `Webhook PayPhone: no existe orden para clientTx=${p.clientTransactionId}`,
      );
      // No forzar reintentos
      return { Response: true, ErrorCode: '000' };
    }

    // Valida monto (PayPhone manda centavos)
    const expectedCents = this.toCents(order.total);
    if (p.amount !== expectedCents) {
      await this.prisma.orden.update({
        where: { id: order.id },
        data: { estado: 'cancelado' },
      });
      this.logger.warn(
        `Monto mismatch order=${order.id}: esperado=${expectedCents} vs recibido=${p.amount} (centavos)`,
      );
      return { Response: true, ErrorCode: '000' };
    }

    // Marca pagado y dispara asignación una vez
    if (order.estado === 'pendiente') {
      const updated = await this.prisma.orden.update({
        where: { id: order.id },
        data: { estado: 'pagado' },
        include: { rifa: { select: { titulo: true } } },
      });

      await this.email.send(
        'payment_confirmed',
        order.compradorEmail,
        {
          rifaTitulo: updated.rifa?.titulo ?? 'Rifa',
          cantidad: order.cantidad,
          total: order.total,
        },
        order.id,
      );

      await this.assign.assign(order.id);
    }

    // Respuesta éxito para PayPhone
    return { Response: true, ErrorCode: '000' };
  }
}

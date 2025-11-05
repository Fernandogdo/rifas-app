import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment.prod';

import { OrdenEstado } from '../../interfaces/orden/orden.interface';
import { Orden } from '../../interfaces/orden/orden.interface';
import {OrdenDetalle} from '../../interfaces/orden/orden-detalle.interface'; 
import { OrdenListResponse } from '../../interfaces/orden/orden-list-response.interface';



@Injectable({ providedIn: 'root' })
export class OrdenesService {
  private static readonly ADMIN_PATH = '/admin/ordenes';
  private static readonly DEV_PAY = '/dev/pay'; // protegida con JWT/rol admin
  private readonly base: string;
  private readonly devPayBase: string;

  constructor(private http: HttpClient) {
    const baseApi = environment.apiBaseUrl.replace(/\/+$/, '');
    this.base = `${baseApi}${OrdenesService.ADMIN_PATH}`;
    this.devPayBase = `${baseApi}${OrdenesService.DEV_PAY}`;
  }

  list(
    opts: {
      estado?: OrdenEstado;
      rifa?: string;
      email?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<OrdenListResponse<Orden>> {
    let params = new HttpParams();
    if (opts.estado) params = params.set('estado', opts.estado);
    if (opts.rifa) params = params.set('rifa', opts.rifa);
    if (opts.email) params = params.set('email', opts.email);
    if (opts.page) params = params.set('page', String(opts.page));
    if (opts.limit) params = params.set('limit', String(opts.limit));

    return firstValueFrom(
      this.http.get<{ items: any[]; total: number; page: number; limit: number }>(this.base, {
        params,
      })
    ).then((resp) => ({
      items: (resp.items ?? []).map((it) => ({
        ...it,
        cantidad: Number(it.cantidad ?? 0),
        total: Number(it.total ?? 0),
      })) as Orden[],
      total: resp.total ?? 0,
      page: resp.page ?? opts.page ?? 1,
      limit: resp.limit ?? opts.limit ?? 20,
    }));
  }

  get(id: string): Promise<OrdenDetalle> {
    return firstValueFrom(this.http.get<OrdenDetalle>(`${this.base}/${id}`)).then((it) => ({
      ...it,
      cantidad: Number(it.cantidad ?? 0),
      total: Number(it.total ?? 0),
      asignaciones: (it.asignaciones ?? []).map((a) => ({ ...a, numero: Number(a.numero) })),
    }));
  }

  /** Solo para desarrollo: marca la orden como pagada y dispara asignación */
  devPay(orderId: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.post<{ ok: boolean }>(`${this.devPayBase}/${orderId}`, {}));
  }
}

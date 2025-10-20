import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {  Rifa, Estado }from '../../interfaces/rifa/rifa.interface';
import {  RifaDTO }from '../../DTOs/rifa.dto';



export interface RifaListResponse<T> {
  items: T[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class RifasService {
  private static readonly ADMIN_PATH = '/admin/rifas'; 
  private readonly base: string;

  constructor(private http: HttpClient) {
    const baseApi = environment.apiBaseUrl.replace(/\/+$/, '');
    this.base = `${baseApi}${RifasService.ADMIN_PATH}`;
  }

  getRifas(opts: {
    search?: string;
    estado?: Estado;
    page?: number;
    limit?: number;
    sort?: string;
  } = {}): Promise<RifaListResponse<Rifa>> {
    let params = new HttpParams();
    if (opts.search) params = params.set('search', opts.search);
    if (opts.estado) params = params.set('estado', opts.estado);
    if (opts.page)   params = params.set('page', String(opts.page));
    if (opts.limit)  params = params.set('limit', String(opts.limit));
    if (opts.sort)   params = params.set('sort', opts.sort);

    return firstValueFrom(
      this.http.get<{ items: any[]; total: number }>(this.base, { params })
    ).then(resp => ({
      items: (resp.items ?? []).map(it => ({
        ...it,
        // Asegura números aunque lleguen como string
        precioUnitario: Number(it.precioUnitario ?? 0),
        stockTotal:     Number(it.stockTotal ?? 0),
        stockAsignado:  Number(it.stockAsignado ?? 0),
      })) as Rifa[],
      total: resp.total ?? 0,
    }));
  }

  getRifa(id: string): Promise<Rifa> {
    return firstValueFrom(this.http.get<Rifa>(`${this.base}/${id}`)).then(it => ({
      ...it,
      precioUnitario: Number(it.precioUnitario ?? 0),
      stockTotal:     Number(it.stockTotal ?? 0),
      stockAsignado:  Number(it.stockAsignado ?? 0),
    }));
  }

  createRifa(payload: RifaDTO): Promise<Rifa> {
    return firstValueFrom(this.http.post<Rifa>(this.base, payload));
  }

  updateRifa(id: string, payload: RifaDTO): Promise<Rifa> {
    return firstValueFrom(this.http.patch<Rifa>(`${this.base}/${id}`, payload));
  }

  deleteRifa(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  publicar(id: string): Promise<Rifa> {
    return this.updateRifa(id, { estado: 'publicada' });
  }

  cerrar(id: string): Promise<Rifa> {
    return this.updateRifa(id, { estado: 'cerrada' });
  }
}

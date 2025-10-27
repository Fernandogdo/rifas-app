import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RifaPublic {
  id: string;
  titulo: string;
  precioUnitario: number;
  stockTotal: number;
  stockAsignado: number;
  media?: { url: string }[];
}

export interface RifaDetail extends RifaPublic {
  descripcion?: string;
  estado?: 'publicada'|'agotada'|'cerrada'|'borrador';
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class PublicRifasService {
  private base = environment.apiBaseUrl.replace(/\/+$/,''); // ej: http://localhost:3000

  constructor(private http: HttpClient) {}

  listPublic({ page = 1, limit = 12 }: { page?: number; limit?: number; })
  : Promise<Paginated<RifaPublic>> {
    let params = new HttpParams()
      .set('estado', 'publicada')
      .set('page', String(page))
      .set('limit', String(limit));
    return firstValueFrom(this.http.get<Paginated<RifaPublic>>(`${this.base}/rifas`, { params }));
  }

  getPublic(id: string): Promise<RifaDetail> {
    return firstValueFrom(this.http.get<RifaDetail>(`${this.base}/rifas/${id}`));
  }
}

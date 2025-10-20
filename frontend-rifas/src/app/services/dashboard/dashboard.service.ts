import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import {RifaDetailsDto} from '../../DTOs/rifa-detail.dto';
import {RifaSummary} from '../../interfaces/rifa/rifa-summary.interface';
import { environment } from '../../../environments/environment';

/** --------- Tipos resumen global --------- */

export interface UltimaOrden {
  id: string;
  compradorEmail: string;
  total: string | number;
  estado: 'pendiente'|'pagado'|'asignado'|'cancelado';
  createdAt: string;
  rifa: { titulo: string };
}
export interface AdminDashboardDto {
  ventasMonto: string | number;
  rifas: RifaSummary[];
  ultimasOrdenes: UltimaOrden[];
}


@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  getSummary(limit = 10) {
    return this.http.get<AdminDashboardDto>(`${this.base}/admin/dashboard?limit=${limit}`)
      .pipe(map(res => ({
        ...res,
        ventasMonto: Number(res.ventasMonto ?? 0),
        ultimasOrdenes: (res.ultimasOrdenes ?? []).map(o => ({ ...o, total: Number(o.total) }))
      })));
  }

  getRifaDetails(rifaId: string, opts?: { limitOrdenes?: number; days?: number }) {
    const limit = opts?.limitOrdenes ?? 10;
    const days  = opts?.days ?? 30;
    return this.http.get<RifaDetailsDto>(`${this.base}/admin/dashboard/rifas/${rifaId}?limitOrdenes=${limit}&days=${days}`)
      .pipe(map(res => ({
        ...res,
        counters: {
          ...res.counters,
          ventasMonto: Number(res.counters.ventasMonto ?? 0)
        },
        estados: res.estados.map(e => ({ ...e, monto: Number(e.monto) })),
        topCompradores: res.topCompradores.map(t => ({ ...t, monto: Number(t.monto) })),
        serieDiaria: res.serieDiaria.map(p => ({ ...p, monto: Number(p.monto) })),
        ultimasOrdenes: res.ultimasOrdenes.map(o => ({ ...o, total: Number(o.total) }))
      })));
  }
}

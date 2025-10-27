import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OrdenEstado } from '../../../interfaces/orden/orden.interface';
import { Orden } from '../../../interfaces/orden/orden.interface';
import { OrdenDetalle } from '../../../interfaces/orden/orden-detalle.interface';
import { OrdenListResponse } from '../../../interfaces/orden/orden-list-response.interface';

import { OrdenesService } from '../../../services/ordenes/ordenes.service';
import { RifasService } from '../../../services/rifas/rifas.service';
import { Rifa } from '../../../interfaces/rifa/rifa.interface';

type GroupMode = 'none' | 'date' | 'rifa';

@Component({
  selector: 'app-admin-ordenes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './ordenes.component.html',
  styleUrls: ['./ordenes.component.css'],
})
export default class OrdenesComponent implements OnInit {

  // -------- Filtros ----------
  estado = signal<OrdenEstado | 'todas'>('todas');
  rifa   = signal<string>('');     // rifaId seleccionado (filtro)
  email  = signal<string>('');     // email filtro

  // Paginación
  page  = signal<number>(1);
  limit = signal<number>(20);

  // Datos tabla
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);
  data    = signal<OrdenListResponse<Orden>>({ items: [], total: 0 });

  readonly totalPages = computed(() => {
    const t = this.data().total || 0;
    const l = this.limit() || 20;
    return Math.max(1, Math.ceil(t / l));
  });

  // KPIs (de la página actual)
  kpis = computed(() => {
    const items = this.data().items ?? [];
    let pendiente = 0, pagado = 0, asignado = 0, cancelado = 0;
    let monto = 0;
    for (const o of items) {
      if (o.estado === 'pendiente') pendiente++;
      else if (o.estado === 'pagado') pagado++;
      else if (o.estado === 'asignado') asignado++;
      else if (o.estado === 'cancelado') cancelado++;
      monto += Number(o.total ?? 0);
    }
    return { pendiente, pagado, asignado, cancelado, monto };
  });

  // -------- Vista / Agrupación ----------
  groupMode = signal<GroupMode>('date');

  groupsByDate = computed(() => {
    if (this.groupMode() !== 'date') return [];
    const items = this.data().items ?? [];
    const map = new Map<string, Orden[]>();
    for (const o of items) {
      const d = new Date(o.createdAt);
      // clave por día (YYYY-MM-DD)
      const key = isNaN(+d) ? 'desconocido' : d.toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    // etiqueta legible
    const format = (key: string) => {
      if (key === 'desconocido') return 'Fecha desconocida';
      const d = new Date(key + 'T00:00:00Z');
      try {
        return d.toLocaleDateString('es-EC', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      } catch { return key; }
    };
    return Array.from(map.entries())
      .sort((a, b) => a[0] < b[0] ? 1 : -1) // desc
      .map(([key, items]) => ({ key, label: format(key), items }));
  });

  groupsByRifa = computed(() => {
    if (this.groupMode() !== 'rifa') return [];
    const items = this.data().items ?? [];
    const map = new Map<string, Orden[]>();
    for (const o of items) {
      const key = o.rifaId ?? 'desconocido';
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    // Ordenar por tamaño desc
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, items]) => ({ key, items }));
  });

  // -------- Modal Detalle ----------
  showDetail  = signal<boolean>(false);
  detailId    = signal<string | null>(null);
  detailLoad  = signal<boolean>(false);
  detailError = signal<string | null>(null);
  detail      = signal<OrdenDetalle | null>(null);

  // -------- Cache de títulos de rifas ----------
  rifaTitle = new Map<string, string>();
  rifaLoading = new Set<string>();

  // -------- Autocompletar de rifas ----------
  rifaSearch       = signal<string>(''); // texto en el input
  rifaOptions      = signal<Rifa[]>([]); // sugerencias
  rifaSuggestOpen  = signal<boolean>(false);
  private rifaBlurTimer: any;

  constructor(
    private ordersService: OrdenesService,
    private rifasService: RifasService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  // -------- Carga principal ----------
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const resp = await this.ordersService.list({
        estado: this.estado() !== 'todas' ? (this.estado() as OrdenEstado) : undefined,
        rifa:   this.rifa() || undefined,
        email:  this.email() || undefined,
        page:   this.page(),
        limit:  this.limit(),
      });
      this.data.set(resp);

      // cargar títulos de rifas (para la vista)
      resp.items.forEach(o => this.ensureRifaTitle(o.rifaId));
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message ?? 'Error cargando órdenes');
    } finally {
      this.loading.set(false);
    }
  }

  // -------- Handlers de filtros ----------
  resetAndLoad() { this.page.set(1); this.load(); }
  onEstadoChange(v: OrdenEstado | 'todas') { this.estado.set(v ?? 'todas'); this.resetAndLoad(); }
  onEmailChange(v: string) { this.email.set((v ?? '').trim()); this.resetAndLoad(); }
  onLimitChange(v: number | string) {
    const n = typeof v === 'string' ? parseInt(v, 10) : v;
    this.limit.set(Number.isFinite(n as number) ? (n as number) : 20);
    this.resetAndLoad();
  }

  // Autocompletar rifa
  async onRifaSearch(term: string) {
    this.rifaSearch.set(term);
    this.rifaSuggestOpen.set(true);
    if (!term || term.trim().length < 2) {
      this.rifaOptions.set([]);
      return;
    }
    try {
      const resp = await this.rifasService.getRifas({ search: term, limit: 10, page: 1, sort: 'created_at:desc' });
      this.rifaOptions.set(resp.items);
    } catch (e) {
      this.rifaOptions.set([]);
    }
  }

  onRifaBlur() {
    // da tiempo a hacer click en la opción
    clearTimeout(this.rifaBlurTimer);
    this.rifaBlurTimer = setTimeout(() => this.rifaSuggestOpen.set(false), 150);
  }

  selectRifa(r: Rifa) {
    this.rifa.set(r.id);
    this.rifaSearch.set(r.titulo || r.id);
    this.rifaOptions.set([]);
    this.rifaSuggestOpen.set(false);
    this.resetAndLoad();
  }

  clearRifa() {
    this.rifa.set('');
    this.rifaSearch.set('');
    this.rifaOptions.set([]);
    this.rifaSuggestOpen.set(false);
    this.resetAndLoad();
  }

  prev() { this.page.set(Math.max(1, this.page() - 1)); this.load(); }
  next() { this.page.set(Math.min(this.totalPages(), this.page() + 1)); this.load(); }

  // -------- UI helpers ----------
  badgeClass(estado: OrdenEstado): string {
    switch (estado) {
      case 'pendiente': return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
      case 'pagado':    return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200';
      case 'asignado':  return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
      case 'cancelado': return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
      default:          return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    }
  }

  async ensureRifaTitle(rifaId: string) {
    if (!rifaId || this.rifaTitle.has(rifaId) || this.rifaLoading.has(rifaId)) return;
    this.rifaLoading.add(rifaId);
    try {
      const r: Rifa = await this.rifasService.getRifa(rifaId);
      this.rifaTitle.set(rifaId, r?.titulo ?? rifaId);
    } catch {
      this.rifaTitle.set(rifaId, rifaId);
    } finally {
      this.rifaLoading.delete(rifaId);
    }
  }

  titleFor(rifaId: string): string {
    return this.rifaTitle.get(rifaId) ?? rifaId;
  }

  // -------- Modal Detalle ----------
  async openDetail(o: Orden) {
    this.detailId.set(o.id);
    this.detail.set(null);
    this.detailError.set(null);
    this.showDetail.set(true);

    this.detailLoad.set(true);
    try {
      const d = await this.ordersService.get(o.id);
      this.detail.set(d);
    } catch (e: any) {
      console.error(e);
      this.detailError.set(e?.message ?? 'No se pudo cargar el detalle');
    } finally {
      this.detailLoad.set(false);
    }
  }

  closeDetail() {
    this.showDetail.set(false);
    this.detailId.set(null);
    this.detail.set(null);
    this.detailError.set(null);
  }

  // -------- Solo DEV ----------
  async devMarkPaid() {
    const d = this.detail();
    if (!d || d.estado !== 'pendiente') return;
    if (!confirm('¿Marcar esta orden como pagada y asignar números? (DEV)')) return;

    this.detailLoad.set(true);
    try {
      await this.ordersService.devPay(d.id);
      // recargar detalle + lista
      await this.openDetail({ ...d } as Orden);
      await this.load();
    } catch (e: any) {
      console.error(e);
      this.detailError.set(e?.message ?? 'No se pudo marcar como pagada');
    } finally {
      this.detailLoad.set(false);
    }
  }
}

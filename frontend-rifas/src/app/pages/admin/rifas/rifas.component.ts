import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RifasService, RifaListResponse } from '../../../services/rifas/rifas.service';
import { Rifa, Estado } from '../../../interfaces/rifa/rifa.interface';
import { RifaDTO } from '../../../DTOs/rifa.dto';

/** Form types */
type EditForm = {
  titulo: string;
  descripcion: string;
  precioUnitario: string;
  stockTotal: string;
  estado: Estado;
  mediaUrl: string;
};

type CreateForm = {
  titulo: string;
  descripcion: string;
  precioUnitario: string;
  stockTotal: string;
  estado: Estado;     // puedes dejarlo fijo en 'borrador' si prefieres
  mediaUrl: string;
};

@Component({
  selector: 'app-admin-rifas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './rifas.component.html',
  styleUrls: ['./rifas.component.css']
})
export default class RifasComponent implements OnInit {

  // Filtros/estado de UI
  search = signal<string>('');
  estado = signal<Estado | 'todas'>('todas');
  page   = signal<number>(1);
  limit  = signal<number>(10);
  sort   = signal<string>('created_at:desc');

  // Datos
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);
  data    = signal<RifaListResponse<Rifa>>({ items: [], total: 0 });

  readonly totalPages = computed(() => {
    const t = this.data().total || 0;
    const l = this.limit() || 10;
    return Math.max(1, Math.ceil(t / l));
  });

  // -------- MODAL EDIT --------
  showEdit = signal<boolean>(false);
  saving   = signal<boolean>(false); // se reutiliza para crear/editar
  editId   = signal<string | null>(null);

  edit = signal<EditForm>({
    titulo: '',
    descripcion: '',
    precioUnitario: '',
    stockTotal: '',
    estado: 'borrador',
    mediaUrl: ''
  });

  // -------- MODAL CREATE --------
  showCreate = signal<boolean>(false);
  create = signal<CreateForm>({
    titulo: '',
    descripcion: '',
    precioUnitario: '',
    stockTotal: '',
    estado: 'borrador',
    mediaUrl: ''
  });

  constructor(private rifasService: RifasService) {}

  ngOnInit(): void {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const resp = await this.rifasService.getRifas({
        search: this.search() || undefined,
        estado: this.estado() !== 'todas' ? (this.estado() as Estado) : undefined,
        page:   this.page(),
        limit:  this.limit(),
        sort:   this.sort(),
      });
      this.data.set(resp);
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message ?? 'Error cargando rifas');
    } finally {
      this.loading.set(false);
    }
  }

  resetAndLoad() { this.page.set(1); this.load(); }
  onSearchChange(v: string) { this.search.set(v ?? ''); this.resetAndLoad(); }
  onEstadoChange(v: Estado | 'todas') { this.estado.set(v ?? 'todas'); this.resetAndLoad(); }
  onLimitChange(v: number | string) {
    const n = typeof v === 'string' ? parseInt(v, 10) : v;
    this.limit.set(Number.isFinite(n as number) ? (n as number) : 10);
    this.resetAndLoad();
  }

  prev() { this.page.set(Math.max(1, this.page() - 1)); this.load(); }
  next() { this.page.set(Math.min(this.totalPages(), this.page() + 1)); this.load(); }

  soldPct(r: Rifa): number {
    if (!r?.stockTotal) return 0;
    return Math.min(100, Math.round((r.stockAsignado / r.stockTotal) * 100));
  }

  badgeClass(estado?: Estado): string {
    switch (estado) {
      case 'publicada': return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
      case 'borrador':  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
      case 'agotada':   return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
      case 'cerrada':   return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
      default:          return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    }
  }

  async publicar(r: Rifa) {
    if (r.estado === 'publicada') return;
    if (!confirm(`¿Publicar la rifa "${r.titulo}"?`)) return;
    await this.safeRun(() => this.rifasService.updateRifa(r.id, { estado: 'publicada' }));
  }
  async cerrar(r: Rifa) {
    if (!confirm(`¿Cerrar la rifa "${r.titulo}"?`)) return;
    await this.safeRun(() => this.rifasService.updateRifa(r.id, { estado: 'cerrada' }));
  }
  async eliminar(r: Rifa) {
    if (!confirm(`Eliminar "${r.titulo}"?`)) return;
    await this.safeRun(() => this.rifasService.deleteRifa(r.id));
  }

  private async safeRun(fn: () => Promise<any>) {
    this.loading.set(true);
    try { await fn(); await this.load(); }
    catch (e: any) { console.error(e); this.error.set(e?.message ?? 'Error en la operación'); }
    finally { this.loading.set(false); }
  }

  imgSrc(r: Rifa): string {
    const first = Array.isArray(r.media) && r.media.length ? r.media[0] : null;
    return first?.url || '/assets/placeholder-rifa.jpg';
  }

  gotoPublic(r: Rifa) { window.open(`/rifas/${r.id}`, '_blank'); }

  // --------- EDIT MODAL LOGIC ----------
  openEdit(r: Rifa) {
    this.editId.set(r.id);
    this.edit.set({
      titulo: r.titulo ?? '',
      descripcion: r.descripcion ?? '',
      precioUnitario: (r.precioUnitario ?? 0).toString(),
      stockTotal: (r.stockTotal ?? 0).toString(),
      estado: (r.estado ?? 'borrador') as Estado,
      mediaUrl: (Array.isArray(r.media) && r.media[0]?.url) ? r.media[0].url : ''
    });
    this.showEdit.set(true);

    queueMicrotask(() => {
      const el = document.getElementById('edit-titulo') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }

  closeEdit() {
    this.showEdit.set(false);
    this.editId.set(null);
  }

  updateEdit<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    this.edit.update(prev => ({ ...prev, [key]: value }));
  }

  isEditValid(): boolean {
    const e = this.edit();
    return !!e.titulo?.trim()
      && Number(e.precioUnitario) > 0
      && Number(e.stockTotal) >= 1;
  }

  async saveEdit(ev: Event) {
    ev.preventDefault();
    if (!this.isEditValid() || !this.editId()) return;

    const e = this.edit();
    const dto: RifaDTO = {
      titulo: e.titulo?.trim(),
      descripcion: e.descripcion?.trim() || undefined,
      precioUnitario: Number(e.precioUnitario),
      stockTotal: Number(e.stockTotal),
      estado: e.estado,
      media: e.mediaUrl ? [{ url: e.mediaUrl }] : undefined,
    };

    this.saving.set(true);
    try {
      await this.rifasService.updateRifa(this.editId()!, dto);
      this.closeEdit();
      await this.load();
    } catch (err: any) {
      console.error(err);
      this.error.set(err?.message ?? 'No se pudo guardar los cambios');
    } finally {
      this.saving.set(false);
    }
  }

  // --------- CREATE MODAL LOGIC ----------
  openCreate() {
    this.create.set({
      titulo: '',
      descripcion: '',
      precioUnitario: '',
      stockTotal: '',
      estado: 'borrador',
      mediaUrl: ''
    });
    this.showCreate.set(true);

    queueMicrotask(() => {
      const el = document.getElementById('create-titulo') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  updateCreate<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    this.create.update(prev => ({ ...prev, [key]: value }));
  }

  isCreateValid(): boolean {
    const c = this.create();
    return !!c.titulo?.trim()
      && Number(c.precioUnitario) > 0
      && Number(c.stockTotal) >= 1;
  }

  async saveCreate(ev: Event) {
    ev.preventDefault();
    if (!this.isCreateValid()) return;

    const c = this.create();
    const dto: RifaDTO = {
      titulo: c.titulo?.trim(),
      descripcion: c.descripcion?.trim() || undefined,
      precioUnitario: Number(c.precioUnitario),
      stockTotal: Number(c.stockTotal),
      estado: c.estado, // o no lo envíes y el backend lo deja en 'borrador'
      media: c.mediaUrl ? [{ url: c.mediaUrl }] : undefined,
    };

    this.saving.set(true);
    try {
      await this.rifasService.createRifa(dto);
      this.closeCreate();
      await this.load();
    } catch (err: any) {
      console.error(err);
      this.error.set(err?.message ?? 'No se pudo crear la rifa');
    } finally {
      this.saving.set(false);
    }
  }
}

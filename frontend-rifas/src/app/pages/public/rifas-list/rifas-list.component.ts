import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PublicRifasService, Paginated, RifaPublic } from '../../../services/public-rifas/public-rifas.service';

@Component({
  selector: 'app-rifas-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rifas-list.component.html',
  styleUrls: ['./rifas-list.component.css'],
})
export default class RifasListComponent implements OnInit, OnChanges {
  /** Config */
  @Input() limit: number = 12;
  @Input() showPager: boolean = true;
  /** Centra y fluye las cards con auto-fit para que 1 o 2 no se vean “perdidas” */
  @Input() centerWhenFew: boolean = true;

  loading = signal<boolean>(false);
  error   = signal<string | null>(null);
  page    = signal<number>(1);
  data    = signal<Paginated<RifaPublic>>({ items: [], total: 0, page: 1, limit: this.limit });

  /** Total de páginas — usar totalPages() en el template */
  totalPages = computed(() =>
    Math.max(1, Math.ceil((this.data().total || 0) / (this.data().limit || this.limit)))
  );

  // === Imagen responsiva ===
  private readonly CARD_RATIO = 16 / 9; // debe coincidir con aspect-[16/9] del HTML
  private fitById = new Map<string, 'cover' | 'contain'>(); // <-- id es string

  constructor(private publicRifasService: PublicRifasService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['limit'] && !changes['limit'].firstChange) {
      this.page.set(1);
      this.load();
    }
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const resp = await this.publicRifasService.listPublic({
        page: this.page(),
        limit: this.limit,
      });

      // Normaliza numéricos
      resp.items = resp.items.map(it => ({
        ...it,
        precioUnitario: Number(it.precioUnitario ?? 0),
        stockTotal: Number(it.stockTotal ?? 0),
        stockAsignado: Number(it.stockAsignado ?? 0),
      }));

      this.data.set(resp);
    } catch (e: any) {
      console.log('🚀 ~ RifasListComponent ~ load ~ e:', e?.message ?? e);
      this.error.set(e?.message ?? 'No se pudieron cargar las rifas');
    } finally {
      this.loading.set(false);
    }
  }

  // Proporción vendida para la barra
  soldPct(r: RifaPublic): number {
    if (!r.stockTotal) return 0;
    return Math.min(100, Math.round((r.stockAsignado / r.stockTotal) * 100));
  }

  // URL de imagen (fallback si no hay)
  img(r: RifaPublic) {
    const first = Array.isArray(r.media) && r.media.length ? r.media[0] : null;
    return first?.url || 'https://images.unsplash.com/photo-1520975938317-6a23f0b1e91d?q=80&w=1200&auto=format&fit=crop';
  }

  // === Fit dinámico cover/contain según el ratio real de la foto ===
  fit(r: RifaPublic): 'cover' | 'contain' {
    return this.fitById.get(r.id) ?? 'cover';
  }

  onImgLoad(ev: Event, r: RifaPublic) {
    const img = ev.target as HTMLImageElement;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;

    const ratio = w / h;

    // Si la imagen es muy vertical comparada con el contenedor 16:9,
    // evita recortes agresivos usando contain (ajusta el factor a gusto).
    this.fitById.set(r.id, ratio < this.CARD_RATIO * 0.8 ? 'contain' : 'cover');
  }

  // Paginación
  prev() {
    this.page.set(Math.max(1, this.page() - 1));
    this.load();
  }

  next() {
    this.page.set(Math.min(this.totalPages(), this.page() + 1));
    this.load();
  }
}

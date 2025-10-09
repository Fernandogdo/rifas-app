import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, switchMap, takeUntil, timer } from 'rxjs';
import { DashboardService, AdminDashboardDto } from '../../../services/dashboard/dashboard.service';
import { RifaDetailsDto } from '../../../interfaces/rifa/rita-detail.interface';
import { RifaSummary } from '../../../interfaces/rifa/rifa-summary.interface';

import { FormsModule } from '@angular/forms';
import { ViewChild, ElementRef } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule, FormsModule, RouterLink, NgClass],
  templateUrl: './dashboard.component.html',
})
export default class DashboardComponent implements OnInit, OnDestroy {
  private svc = inject(DashboardService);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef); // 👈 inyecta
  @ViewChild('serieChart') serieChartRef?: ElementRef<HTMLCanvasElement>;
  private serieChart: Chart | null = null;

  ngOnInit() {
    // resumen cada 15s
    timer(0, 15000)
      .pipe(
        switchMap(() => this.svc.getSummary(10).pipe(catchError(() => of(null)))),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        if (res) {
          this.data.set(res);
          this.error.set(null);
          if (!this.selectedRifaId() && res.rifas.length) {
            this.onSelectRifa(res.rifas[0].id);
          }
        }
        this.loading.set(false);
      });
  }

  // Global summary
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<AdminDashboardDto | null>(null);

  // Drilldown por rifa
  selectedRifaId = signal<string | null>(null);
  detailsLoading = signal(false);
  detailsError = signal<string | null>(null);
  details = signal<RifaDetailsDto | null>(null);

  /** ---- Helpers resumen ---- */
  ventasMonto() {
    return Number(this.data()?.ventasMonto ?? 0);
  }
  rifas() {
    return this.data()?.rifas ?? [];
  }
  rifasActivas() {
    return this.rifas().length;
  }
  ticketsRestantes() {
    return this.rifas().reduce((a, r) => a + r.restantes, 0);
  }
  avancePromedio() {
    const rs = this.rifas();
    if (!rs.length) return 0;
    return (rs.reduce((a, r) => a + r.porcentajeVendido, 0) / rs.length) * 100;
  }
  topRifas() {
    return [...this.rifas()].sort((a, b) => b.porcentajeVendido - a.porcentajeVendido).slice(0, 5);
  }
  ultimasOrdenesGlobal() {
    return this.data()?.ultimasOrdenes ?? [];
  }

  /** ---- Helpers detalle ---- */
  series() {
    return this.details()?.serieDiaria ?? [];
  }
  maxTickets() {
    const s = this.series();
    return Math.max(1, ...s.map((p) => p.tickets));
  }

  /** ---- Loaders ---- */
  private loadSummary() {
    this.loading.set(true);
    this.svc
      .getSummary(10)
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || 'No se pudo cargar el dashboard');
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        if (res) {
          this.data.set(res);
          this.error.set(null);
          // seleccionar 1ª rifa si no hay una elegida
          if (!this.selectedRifaId()) {
            const first = res.rifas[0]?.id ?? null;
            if (first) this.onSelectRifa(first);
          }
        }
        this.loading.set(false);
      });
  }

  private loadDetails(rifaId: string) {
    this.detailsLoading.set(true);
    this.detailsError.set(null);

    this.destroySerieChart(); // por si cambiaste de rifa

    this.svc
      .getRifaDetails(rifaId, { limitOrdenes: 10, days: 30 })
      .pipe(
        catchError((err) => {
          this.detailsError.set(err?.error?.message || 'No se pudo cargar el detalle');
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        if (res) {
          this.details.set(res);

          // Asegura que Angular pinte el @if(details()) y el <canvas>
          this.cdr.detectChanges();
          // Espera a que el layout calcule tamaños del contenedor
          requestAnimationFrame(() => this.renderSerieChart());
        }
        this.detailsLoading.set(false);
      });
  }

  /** ---- Eventos UI ---- */
  onSelectRifa(id: string) {
    this.selectedRifaId.set(id);
    this.loadDetails(id);
  }
  clickTopRifa(r: RifaSummary) {
    this.onSelectRifa(r.id);
  }

  private renderSerieChart() {
    const detail = this.details();
    const canvas = this.serieChartRef?.nativeElement;

    // Si no hay canvas o no hay detail, no intentes dibujar
    if (!detail || !canvas) {
      this.destroySerieChart();
      return;
    }

    // Fuente de datos (ordenada por fecha)
    let pts = [...(detail.serieDiaria ?? [])].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    // Fallback: si la rifa no tiene actividad, pinto 30 días con ceros,
    // así el gráfico SIEMPRE aparece.
    if (pts.length === 0) {
      const days = 30;
      const today = new Date();
      pts = Array.from({ length: days }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (days - 1 - i));
        return { fecha: d.toISOString(), tickets: 0, monto: 0 };
      });
    }

    const labels = pts.map((p) => new Date(p.fecha).toLocaleDateString());
    const tickets = pts.map((p) => p.tickets);
    const monto = pts.map((p) => Number(p.monto));

    this.destroySerieChart();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration<'bar' | 'line'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Tickets',
            data: tickets,
            borderWidth: 1,
            backgroundColor: 'rgba(59, 130, 246, 0.5)', // 👈 aseguro visibilidad
            borderColor: 'rgb(59, 130, 246)',
          },
          {
            type: 'line',
            label: 'Monto (USD)',
            data: monto,
            yAxisID: 'y1',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            borderColor: 'rgb(16, 185, 129)', // 👈 aseguro visibilidad
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: 'Tickets' },
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Monto USD' },
          },
        },
        plugins: { legend: { display: true } },
      },
    };

    this.serieChart = new Chart(ctx, config);
    this.serieChart.update(); // 👈 por si acaso
  }

  private destroySerieChart() {
    if (this.serieChart) {
      this.serieChart.destroy();
      this.serieChart = null;
    }
  }

  /** ---- Ciclo de vida ---- */

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroySerieChart();
  }
}

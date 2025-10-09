export interface RifaDetailsDto {
  rifa: {
    id: string;
    titulo: string;
    precioUnitario: number | string;
    stockTotal: number;
    stockAsignado: number;
    estado: string;
  };
  counters: {
    ticketsVendidos: number;
    ticketsPendientes: number;
    ventasMonto: number | string;
    porcentajeVendido: number; // 0..1
    restantes: number;
  };
  estados: Array<{
    estado: 'pendiente'|'pagado'|'asignado'|'cancelado';
    ordenes: number;
    tickets: number;
    monto: number | string;
  }>;
  topCompradores: Array<{
    email: string;
    ordenes: number;
    tickets: number;
    monto: number | string;
  }>;
  serieDiaria: Array<{
    fecha: string;  // ISO
    monto: number | string;
    tickets: number;
  }>;
  ultimasOrdenes: Array<{
    id: string;
    compradorEmail: string;
    total: number | string;
    estado: 'pendiente'|'pagado'|'asignado'|'cancelado';
    createdAt: string;
  }>;
}
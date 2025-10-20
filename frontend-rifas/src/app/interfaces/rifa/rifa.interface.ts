export type Estado = 'borrador' | 'publicada' | 'agotada' | 'cerrada';


export interface Rifa {
  id: string;
  titulo: string;
  descripcion?: string;
  precioUnitario: number;   // <- camelCase como llega del backend
  stockTotal: number;       // <- camelCase
  stockAsignado: number;    // <- camelCase
  estado?: Estado;
  media?: { url: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export type OrdenEstado = 'pendiente' | 'pagado' | 'asignado' | 'cancelado';


export interface Orden {
  id: string;
  rifaId: string;
  compradorEmail: string;
  cantidad: number;
  total: number; // lo normalizamos a number
  estado: OrdenEstado;
  createdAt: string;
}
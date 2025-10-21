import { Orden } from "./orden.interface";

export interface Asignacion {
  id: string;
  numero: number;
  createdAt?: string;
}


export interface OrdenDetalle extends Orden {
  asignaciones: Asignacion[];
  rifa?: { titulo: string } | null;
}

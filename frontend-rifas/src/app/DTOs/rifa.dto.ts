
import { Estado }from '../interfaces/rifa/rifa.interface';

export interface RifaDTO {
  titulo?: string;
  descripcion?: string;
  precioUnitario?: number;
  stockTotal?: number;
  stockAsignado?: number;
  estado?: Estado;
  media?: any;
}
export interface OrdenListResponse<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}
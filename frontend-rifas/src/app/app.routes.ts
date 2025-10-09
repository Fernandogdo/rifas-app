import { Routes } from '@angular/router';
import { canMatchAdmin } from './guards/auth.guard';

export const routes: Routes = [
  // ------- PÚBLICO (SPA) -------
  {
    path: '',
    loadComponent: () =>
      import('./pages/public/public-layout/public-layout.component'),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/public/home/home.component')
           
      },
      {
        path: 'rifa/:id',
        loadComponent: () =>
          import('./pages/public/rifa-detail/rifa-detail.component')
            
      },
      {
        path: 'checkout/:orderId',
        loadComponent: () =>
          import('./pages/public/checkout/checkout.component')
            
      },
      {
        path: 'checkout-result',
        loadComponent: () =>
          import('./pages/public/checkout-result/checkout-result')
      },
      {
        path: 'mis-numeros',
        loadComponent: () =>
          import('./pages/public/mis-numeros/mis-numeros')
      },
    ],
  },

  // ------- ADMIN (login público, resto protegido) -------
  {
    path: 'login', // ruta conocida solo por admins
    loadComponent: () =>
      import('./pages/admin/login/login.component')
      
  },

  // --- Zona admin PROTEGIDA con layout ---
  {
    path: 'admin',
    canMatch: [canMatchAdmin],
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout.component'),
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/admin/dashboard/dashboard.component') },
      { path: 'rifas', loadComponent: () => import('./pages/admin/rifas/rifas.component') },
      { path: 'ordenes', loadComponent: () => import('./pages/admin/ordenes/ordenes.component') },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  // ------- fallback -------
  { path: '**', redirectTo: '' },
];

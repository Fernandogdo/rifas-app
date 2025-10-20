import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
})
export default class AdminLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  sidebarOpen = signal(false);
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  closeSidebar()  { this.sidebarOpen.set(false); }

  @HostListener('document:keydown.escape') onEsc() { this.closeSidebar(); }

  logout() {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login'], { replaceUrl: true }),
      error: () => this.router.navigate(['/login'], { replaceUrl: true }),
    });
  }
}

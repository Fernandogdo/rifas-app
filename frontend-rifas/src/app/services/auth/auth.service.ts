import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';


export type Rol = 'admin' | 'operador';
export interface AuthUser {
  id: string;
  email: string;
  rol: Rol;
  nombreUnido: string;
  isActive: boolean;
}
interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const STORAGE_TOKEN = 'auth.token';
const STORAGE_USER  = 'auth.user';

// Ajusta si usas environments:
const API = environment.apiBaseUrl; 

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private _user$ = new BehaviorSubject<AuthUser | null>(this.readUser());
  user$ = this._user$.asObservable();

  get token(): string | null { return localStorage.getItem(STORAGE_TOKEN); }
  get user(): AuthUser | null { return this._user$.value; }
  isLoggedIn(): boolean { return !!this.token && !!this.user; }

  // ---------- helpers persistencia ----------
  private saveSession(token: string, user: AuthUser) {
    localStorage.setItem(STORAGE_TOKEN, token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    this._user$.next(user);
  }
  private clearSession() {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    this._user$.next(null);
  }
  private readUser(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_USER);
    try { return raw ? JSON.parse(raw) as AuthUser : null; } catch { return null; }
  }

  // ---------- endpoints ----------
  logIn(email: string, password: string) {
    return this.http.post<LoginResponse>(`${API}/auth/log-in`, { email, password }).pipe(
      tap(res => this.saveSession(res.accessToken, res.user))
    );
  }

  signUp(dto: { email: string; password: string; nombreUnido: string; rol: Rol }) {
    return this.http.post<LoginResponse>(`${API}/auth/sign-up`, dto).pipe(
      tap(res => this.saveSession(res.accessToken, res.user))
    );
  }

  forgotPassword(email: string) {
    return this.http.post(`${API}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${API}/auth/reset-password`, { token, newPassword });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post(`${API}/auth/change-password`, { currentPassword, newPassword });
  }

  logout() {
    return this.http.post(`${API}/auth/logout`, {}).pipe(
      // si tu backend devolviera 401/403 por un token ya inválido, igual limpiamos
      catchError(() => of(null)),
      tap(() => this.clearSession())
    );
  }

  // Útil si no quieres llamar al backend: logout local
  logoutLocal() { this.clearSession(); }
}

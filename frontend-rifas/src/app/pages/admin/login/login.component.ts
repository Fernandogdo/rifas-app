import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-admin-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export default class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  infoMsg = signal<string | null>(null);

  currentYear = new Date().getFullYear();

  mode = signal<'login'|'forgot'|'reset'>('login');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [true],
  });

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  resetForm = this.fb.group({
    token: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  async onLogin() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    const { email, password } = this.form.value as any;

    this.auth.logIn(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/admin/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'Error de autenticación');
        this.loading.set(false);
      }
    });
  }

  onForgot() {
    if (this.forgotForm.invalid) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    const { email } = this.forgotForm.value as any;

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.infoMsg.set('Te enviamos un correo con instrucciones para recuperar tu contraseña.');
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No pudimos enviar el correo.');
        this.loading.set(false);
      }
    });
  }

  onReset() {
    if (this.resetForm.invalid) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    const { token, newPassword } = this.resetForm.value as any;

    this.auth.resetPassword(token, newPassword).subscribe({
      next: () => {
        this.infoMsg.set('Contraseña actualizada. Ya puedes iniciar sesión.');
        this.mode.set('login');
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No se pudo actualizar la contraseña.');
        this.loading.set(false);
      }
    });
  }
}

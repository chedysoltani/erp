import { Injectable } from '@angular/core';
import {
  HttpRequest, HttpHandler, HttpEvent,
  HttpInterceptor, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(private router: Router, private toast: ToastService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          // 401 on login = wrong credentials — let the component handle it, don't redirect
          if (req.url.includes('/users/login')) {
            return throwError(() => err);
          }

          // Real session expiry: clear tokens and redirect to appropriate login
          const hadEmployeeSession = !!localStorage.getItem('employeeToken');
          localStorage.removeItem('managerToken');
          localStorage.removeItem('currentManager');
          localStorage.removeItem('employeeToken');
          localStorage.removeItem('currentEmployee');

          this.toast.error('Session expirée. Veuillez vous reconnecter.');
          this.router.navigate([hadEmployeeSession ? '/employee-login' : '/manager-login']);

        } else if (err.status === 403) {
          this.toast.error("Accès refusé. Vous n'avez pas les permissions nécessaires.");
        } else if (err.status === 429) {
          this.toast.warning('Trop de requêtes. Veuillez patienter avant de réessayer.');
        } else if (err.status >= 500) {
          this.toast.error("Erreur serveur. Veuillez réessayer ou contacter l'administrateur.");
        }
        return throwError(() => err);
      })
    );
  }
}

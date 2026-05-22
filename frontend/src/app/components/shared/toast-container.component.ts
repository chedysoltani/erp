import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container-erp" aria-live="polite">
      <div
        *ngFor="let toast of toasts$ | async"
        class="toast-erp toast-erp--{{ toast.type }}"
        role="alert">
        <span class="toast-erp__icon">
          <ng-container [ngSwitch]="toast.type">
            <i *ngSwitchCase="'success'" class="bi bi-check-circle-fill"></i>
            <i *ngSwitchCase="'error'"   class="bi bi-x-circle-fill"></i>
            <i *ngSwitchCase="'warning'" class="bi bi-exclamation-triangle-fill"></i>
            <i *ngSwitchDefault          class="bi bi-info-circle-fill"></i>
          </ng-container>
        </span>
        <span class="toast-erp__message">{{ toast.message }}</span>
        <button class="toast-erp__close" (click)="dismiss(toast.id)" aria-label="Fermer">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container-erp {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    }
    .toast-erp {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 10px;
      background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.08);
      color: #e2e8f0;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      animation: toastIn 200ms ease forwards;
      font-size: 0.875rem;
      font-weight: 500;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .toast-erp--success { border-left: 3px solid #22c55e; }
    .toast-erp--error   { border-left: 3px solid #ef4444; }
    .toast-erp--warning { border-left: 3px solid #f59e0b; }
    .toast-erp--info    { border-left: 3px solid #3b82f6; }
    .toast-erp__icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
    .toast-erp--success .toast-erp__icon { color: #22c55e; }
    .toast-erp--error   .toast-erp__icon { color: #ef4444; }
    .toast-erp--warning .toast-erp__icon { color: #f59e0b; }
    .toast-erp--info    .toast-erp__icon { color: #3b82f6; }
    .toast-erp__message { flex: 1; line-height: 1.4; }
    .toast-erp__close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      padding: 0;
      font-size: 1rem;
      flex-shrink: 0;
      transition: color 150ms;
    }
    .toast-erp__close:hover { color: rgba(255,255,255,0.8); }
  `]
})
export class ToastContainerComponent implements OnInit {
  toasts$!: Observable<Toast[]>;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toasts$ = this.toastService.toasts$;
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}

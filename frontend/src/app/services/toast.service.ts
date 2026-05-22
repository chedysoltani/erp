import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts$ = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts$.asObservable();
  private nextId = 1;

  show(message: string, type: ToastType = 'info', duration = 4000): void {
    const toast: Toast = { id: this.nextId++, type, message, duration };
    this._toasts$.next([...this._toasts$.getValue(), toast]);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void   { this.show(message, 'error', 6000); }
  warning(message: string): void { this.show(message, 'warning'); }
  info(message: string): void    { this.show(message, 'info'); }

  dismiss(id: number): void {
    this._toasts$.next(this._toasts$.getValue().filter(t => t.id !== id));
  }
}

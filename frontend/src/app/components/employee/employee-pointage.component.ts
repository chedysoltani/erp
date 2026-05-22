import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AttendanceService } from '../../services/attendance.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-employee-pointage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="pointage-wrapper">

  <!-- ─── CARTE PRINCIPALE : HORLOGE + ACTIONS ─── -->
  <div class="pointage-card">
    <div class="pointage-header">
      <div class="pointage-date">
        <span class="day-label">{{ todayLabel }}</span>
        <span class="full-date">{{ fullDate }}</span>
      </div>
      <div class="live-clock">{{ currentTime }}</div>
    </div>

    <!-- Statut actuel -->
    <div class="status-banner" [ngClass]="statusClass">
      <i class="bi" [ngClass]="statusIcon"></i>
      <span>{{ statusLabel }}</span>
    </div>

    <!-- Informations de la session -->
    <div class="session-info" *ngIf="todayRecord?.check_in_time">
      <div class="info-row">
        <span class="info-label"><i class="bi bi-box-arrow-in-right"></i> Arrivée</span>
        <span class="info-value">{{ formatTime(todayRecord.check_in_time) }}</span>
      </div>
      <div class="info-row" *ngIf="todayRecord?.check_out_time">
        <span class="info-label"><i class="bi bi-box-arrow-right"></i> Départ</span>
        <span class="info-value">{{ formatTime(todayRecord.check_out_time) }}</span>
      </div>
      <div class="info-row" *ngIf="todayRecord?.total_hours > 0">
        <span class="info-label"><i class="bi bi-clock"></i> Heures</span>
        <span class="info-value accent">{{ todayRecord.total_hours }}h</span>
      </div>
      <div class="info-row late" *ngIf="todayRecord?.late_minutes > 0">
        <span class="info-label"><i class="bi bi-exclamation-triangle"></i> Retard</span>
        <span class="info-value danger">{{ todayRecord.late_minutes }} min</span>
      </div>
      <div class="info-row" *ngIf="todayRecord?.overtime_minutes > 0">
        <span class="info-label"><i class="bi bi-plus-circle"></i> Heures sup.</span>
        <span class="info-value success">+{{ (todayRecord.overtime_minutes / 60).toFixed(1) }}h</span>
      </div>
      <!-- Timer en temps réel si présent -->
      <div class="live-timer" *ngIf="todayRecord?.check_in_time && !todayRecord?.check_out_time">
        <i class="bi bi-clock-history"></i>
        En présence depuis <strong>{{ elapsedTime }}</strong>
      </div>
    </div>

    <!-- Horaire prévu -->
    <div class="schedule-info" *ngIf="todayRecord?.scheduled_start">
      <span class="schedule-label">Horaire : </span>
      <span>{{ todayRecord.scheduled_start?.substring(0,5) }} – {{ todayRecord.scheduled_end?.substring(0,5) }}</span>
    </div>

    <!-- Actions -->
    <div class="pointage-actions">
      <button class="btn-checkin" *ngIf="canCheckIn" (click)="doCheckIn()" [disabled]="loading">
        <i class="bi bi-box-arrow-in-right"></i>
        {{ loading ? "En cours..." : "Pointer l'arrivée" }}
      </button>
      <button class="btn-checkout" *ngIf="canCheckOut" (click)="doCheckOut()" [disabled]="loading">
        <i class="bi bi-box-arrow-right"></i>
        {{ loading ? "En cours..." : "Pointer le départ" }}
      </button>
      <div class="done-badge" *ngIf="isDone">
        <i class="bi bi-check-circle-fill"></i> Journée complète enregistrée
      </div>
      <div class="waiting-badge" *ngIf="!canCheckIn && !canCheckOut && !isDone">
        <i class="bi bi-hourglass-split"></i>
        Pointage disponible à <strong>{{ checkInWindowTime }}</strong>
      </div>
    </div>
  </div>

  <!-- ─── DEMANDE DE CONGÉ ─── -->
  <div class="leave-card">
    <div class="card-title">
      <i class="bi bi-calendar-x"></i> Demande de congé
    </div>
    <div class="leave-form">
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select [(ngModel)]="leaveForm.type">
            <option value="vacation">Congés payés</option>
            <option value="sick">Arrêt maladie</option>
            <option value="personal">Congé personnel</option>
            <option value="other">Autre</option>
          </select>
        </div>
      </div>
      <div class="form-row two-cols">
        <div class="form-group">
          <label>Date début</label>
          <input type="date" [(ngModel)]="leaveForm.start_date" />
        </div>
        <div class="form-group">
          <label>Date fin</label>
          <input type="date" [(ngModel)]="leaveForm.end_date" />
        </div>
      </div>
      <div class="form-group">
        <label>Motif (facultatif)</label>
        <textarea [(ngModel)]="leaveForm.reason" rows="2" placeholder="Raison de la demande..."></textarea>
      </div>
      <button class="btn-leave" (click)="submitLeave()" [disabled]="loading || !leaveForm.start_date || !leaveForm.end_date">
        <i class="bi bi-send"></i> Soumettre la demande
      </button>
    </div>

    <!-- Mes demandes -->
    <div class="my-leaves" *ngIf="myLeaves.length > 0">
      <div class="leaves-title">Mes demandes récentes</div>
      <div class="leave-item" *ngFor="let leave of myLeaves.slice(0, 5)" [ngClass]="'leave-' + leave.status">
        <div class="leave-dates">{{ formatDate(leave.start_date) }} → {{ formatDate(leave.end_date) }}</div>
        <div class="leave-meta">
          <span class="leave-type-badge">{{ leaveTypeLabel(leave.type) }}</span>
          <span class="leave-status-badge">{{ leaveStatusLabel(leave.status) }}</span>
          <span class="leave-days">{{ leave.days_count }}j</span>
        </div>
        <div class="leave-response" *ngIf="leave.response_note">
          <i class="bi bi-chat-left-text"></i> {{ leave.response_note }}
        </div>
      </div>
    </div>
  </div>

  <!-- ─── HISTORIQUE ─── -->
  <div class="history-card">
    <div class="card-title">
      <i class="bi bi-calendar3"></i> Historique du mois
      <div class="history-stats" *ngIf="monthStats">
        <span class="stat-chip present">{{ monthStats.present_days }} présents</span>
        <span class="stat-chip absent">{{ monthStats.absent_days }} absents</span>
        <span class="stat-chip late" *ngIf="monthStats.late_days > 0">{{ monthStats.late_days }} retards</span>
        <span class="stat-chip hours">{{ (+monthStats.total_hours).toFixed(0) }}h travaillées</span>
      </div>
    </div>
    <div class="history-list">
      <div class="history-item" *ngFor="let record of history.slice(0, 10)"
           [ngClass]="'status-' + (record.status || 'absent')">
        <div class="h-date">{{ formatDate(record.date) }}</div>
        <div class="h-times">
          <span *ngIf="record.check_in_time">{{ formatTime(record.check_in_time) }}</span>
          <span *ngIf="!record.check_in_time" class="no-data">—</span>
          <i class="bi bi-arrow-right"></i>
          <span *ngIf="record.check_out_time">{{ formatTime(record.check_out_time) }}</span>
          <span *ngIf="!record.check_out_time" class="no-data">—</span>
        </div>
        <div class="h-hours" *ngIf="record.total_hours > 0">{{ record.total_hours }}h</div>
        <div class="h-status">
          <span class="status-dot" [ngClass]="record.status || 'absent'"></span>
          {{ statusLabels[record.status || 'absent'] || record.status }}
        </div>
        <div class="h-late" *ngIf="record.late_minutes > 0">+{{ record.late_minutes }}min</div>
        <div class="h-validated" *ngIf="record.manager_validated">
          <i class="bi bi-patch-check-fill text-success" title="Validé par le manager"></i>
        </div>
      </div>
      <div class="no-history" *ngIf="history.length === 0">
        <i class="bi bi-calendar3"></i> Aucun enregistrement ce mois-ci
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    .pointage-wrapper { display: flex; flex-direction: column; gap: 20px; max-width: 700px; }

    /* Carte principale */
    .pointage-card {
      background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .pointage-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .day-label { display: block; color: rgba(255,255,255,0.5); font-size: .75rem; text-transform: uppercase; letter-spacing: 1px; }
    .full-date { font-size: 1rem; font-weight: 600; color: #e2e8f0; }
    .live-clock { font-size: 2rem; font-weight: 700; color: #e2e8f0; font-variant-numeric: tabular-nums; }

    /* Status banner */
    .status-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 10px; margin-bottom: 20px;
      font-weight: 600; font-size: .875rem;
    }
    .status-banner.present { background: rgba(34,197,94,.15); color: #22c55e; border: 1px solid rgba(34,197,94,.3); }
    .status-banner.late    { background: rgba(245,158,11,.15); color: #f59e0b; border: 1px solid rgba(245,158,11,.3); }
    .status-banner.absent  { background: rgba(239,68,68,.15);  color: #ef4444; border: 1px solid rgba(239,68,68,.3); }
    .status-banner.done    { background: rgba(59,130,246,.15); color: #3b82f6; border: 1px solid rgba(59,130,246,.3); }
    .status-banner.idle    { background: rgba(107,114,128,.15); color: #9ca3af; border: 1px solid rgba(107,114,128,.2); }

    /* Infos session */
    .session-info { background: rgba(255,255,255,0.04); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: rgba(255,255,255,0.5); font-size: .85rem; display: flex; align-items: center; gap: 6px; }
    .info-value { font-weight: 600; color: #e2e8f0; }
    .info-value.accent  { color: #3b82f6; }
    .info-value.danger  { color: #ef4444; }
    .info-value.success { color: #22c55e; }
    .live-timer {
      margin-top: 12px; padding: 8px 12px; background: rgba(59,130,246,.1);
      border-radius: 8px; color: #93c5fd; font-size: .85rem;
      display: flex; align-items: center; gap: 6px;
    }

    /* Schedule */
    .schedule-info { color: rgba(255,255,255,0.4); font-size: .8rem; margin-bottom: 20px; }
    .schedule-label { font-weight: 600; }

    /* Actions */
    .pointage-actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn-checkin, .btn-checkout {
      flex: 1; padding: 14px 20px; border: none; border-radius: 10px;
      font-size: .9rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 150ms;
    }
    .btn-checkin  { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; }
    .btn-checkin:hover  { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-checkout { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; }
    .btn-checkout:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-checkin:disabled, .btn-checkout:disabled { opacity: .5; cursor: not-allowed; transform: none; }
    .done-badge {
      flex: 1; padding: 14px; text-align: center; border-radius: 10px;
      background: rgba(59,130,246,.1); color: #60a5fa;
      font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .waiting-badge {
      flex: 1; padding: 14px; text-align: center; border-radius: 10px;
      background: rgba(245,158,11,.1); color: #fbbf24;
      font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;
      font-size: .9rem;
    }

    /* Leave card */
    .leave-card, .history-card {
      background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 24px;
    }
    .card-title {
      font-weight: 700; color: #e2e8f0; margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .history-stats { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
    .stat-chip {
      padding: 3px 10px; border-radius: 20px; font-size: .75rem; font-weight: 600;
    }
    .stat-chip.present { background: rgba(34,197,94,.2); color: #22c55e; }
    .stat-chip.absent  { background: rgba(239,68,68,.2);  color: #ef4444; }
    .stat-chip.late    { background: rgba(245,158,11,.2); color: #f59e0b; }
    .stat-chip.hours   { background: rgba(59,130,246,.2); color: #60a5fa; }

    /* Form */
    .leave-form { display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: flex; gap: 12px; }
    .form-row.two-cols .form-group { flex: 1; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { color: rgba(255,255,255,0.6); font-size: .8rem; font-weight: 500; }
    .form-group input, .form-group select, .form-group textarea {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; padding: 10px 12px; color: #e2e8f0; font-size: .875rem;
    }
    .form-group textarea { resize: vertical; }
    .btn-leave {
      padding: 12px; background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      color: #fff; border: none; border-radius: 10px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-leave:disabled { opacity: .5; cursor: not-allowed; }

    /* My leaves */
    .my-leaves { margin-top: 20px; }
    .leaves-title { color: rgba(255,255,255,0.5); font-size: .8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .leave-item { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid transparent; }
    .leave-item.leave-pending  { background: rgba(245,158,11,.08); border-color: #f59e0b; }
    .leave-item.leave-approved { background: rgba(34,197,94,.08);  border-color: #22c55e; }
    .leave-item.leave-rejected { background: rgba(239,68,68,.08);  border-color: #ef4444; }
    .leave-dates { font-weight: 600; color: #e2e8f0; font-size: .875rem; margin-bottom: 4px; }
    .leave-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .leave-type-badge, .leave-status-badge, .leave-days {
      padding: 2px 8px; border-radius: 20px; font-size: .75rem; font-weight: 500;
      background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6);
    }
    .leave-response { margin-top: 4px; font-size: .8rem; color: rgba(255,255,255,0.4); font-style: italic; }

    /* History */
    .history-list { display: flex; flex-direction: column; gap: 6px; }
    .history-item {
      display: grid; grid-template-columns: 100px 1fr auto auto auto auto;
      align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 8px;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
      font-size: .85rem;
    }
    .history-item.status-present { border-left: 3px solid #22c55e; }
    .history-item.status-late    { border-left: 3px solid #f59e0b; }
    .history-item.status-absent  { border-left: 3px solid #ef4444; opacity: .7; }
    .history-item.status-leave   { border-left: 3px solid #8b5cf6; }
    .h-date { color: rgba(255,255,255,0.7); font-weight: 600; font-size: .8rem; }
    .h-times { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.6); }
    .no-data { color: rgba(255,255,255,0.25); }
    .h-hours { color: #60a5fa; font-weight: 600; }
    .h-status { display: flex; align-items: center; gap: 5px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-dot.present { background: #22c55e; }
    .status-dot.late    { background: #f59e0b; }
    .status-dot.absent  { background: #ef4444; }
    .status-dot.leave   { background: #8b5cf6; }
    .h-late { color: #f59e0b; font-size: .78rem; }
    .no-history {
      text-align: center; padding: 30px; color: rgba(255,255,255,0.3);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .no-history i { font-size: 2rem; }
  `]
})
export class EmployeePointageComponent implements OnInit, OnDestroy {
  @Input() employeeId!: number;
  private destroy$ = new Subject<void>();

  loading = false;
  todayRecord: any = null;
  history: any[] = [];
  monthStats: any = null;
  myLeaves: any[] = [];
  elapsedTime = '00:00:00';
  currentTime = '';
  todayLabel = '';
  fullDate = '';
  private nowMs = Date.now();

  leaveForm = { type: 'vacation', start_date: '', end_date: '', reason: '' };

  readonly statusLabels: Record<string, string> = {
    present: 'Présent', late: 'En retard', absent: 'Absent',
    leave: 'Congé', half_day: 'Demi-journée', holiday: 'Férié'
  };

  // Returns true once the current time reaches scheduled_start minus 1 hour.
  // Falls back to always-open when no schedule is configured.
  get checkInWindowOpen(): boolean {
    const start = this.todayRecord?.scheduled_start as string | undefined;
    if (!start) return true;
    const [h, m] = start.split(':').map(Number);
    const windowStart = new Date();
    windowStart.setHours(h, m, 0, 0);
    windowStart.setTime(windowStart.getTime() - 60 * 60 * 1000);
    return this.nowMs >= windowStart.getTime();
  }

  get checkInWindowTime(): string {
    const start = this.todayRecord?.scheduled_start as string | undefined;
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const windowStart = new Date();
    windowStart.setHours(h - 1, m, 0, 0);
    return windowStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  get canCheckIn():  boolean { return !this.todayRecord?.check_in_time && this.checkInWindowOpen; }
  get canCheckOut(): boolean { return !!this.todayRecord?.check_in_time && !this.todayRecord?.check_out_time; }
  get isDone():      boolean { return !!this.todayRecord?.check_in_time && !!this.todayRecord?.check_out_time; }

  get statusClass(): string {
    if (!this.todayRecord?.check_in_time) return 'idle';
    if (this.isDone) return 'done';
    return this.todayRecord?.status || 'present';
  }

  get statusIcon(): string {
    const m: Record<string, string> = {
      idle: 'bi-clock', present: 'bi-person-check-fill',
      late: 'bi-exclamation-circle-fill', done: 'bi-check-circle-fill',
      absent: 'bi-person-x-fill', leave: 'bi-calendar-check'
    };
    return m[this.statusClass] || 'bi-clock';
  }

  get statusLabel(): string {
    if (!this.todayRecord?.check_in_time) return 'Non pointé';
    if (this.isDone) return 'Journée terminée';
    if (this.todayRecord?.status === 'late') return `En retard (${this.todayRecord.late_minutes} min)`;
    return 'En présence';
  }

  constructor(private attendanceService: AttendanceService, private toast: ToastService) {}

  ngOnInit(): void {
    this.updateDateTime();
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateDateTime();
      this.updateElapsed();
    });
    this.loadTodayStatus();
    this.loadHistory();
    this.loadMyLeaves();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateDateTime(): void {
    const now = new Date();
    this.nowMs = now.getTime();
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    this.todayLabel = days[now.getDay()];
    this.fullDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    this.currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private updateElapsed(): void {
    if (!this.todayRecord?.check_in_time || this.todayRecord?.check_out_time) return;
    const diff = Math.floor((Date.now() - new Date(this.todayRecord.check_in_time).getTime()) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    this.elapsedTime = `${h}:${m}:${s}`;
  }

  loadTodayStatus(): void {
    this.attendanceService.getTodayStatus(this.employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.todayRecord = res.data.status === 'not_checked_in'
              ? { scheduled_start: res.data.schedule?.start_time, scheduled_end: res.data.schedule?.end_time }
              : res.data;
          }
        },
        error: () => {}
      });
  }

  loadHistory(): void {
    this.attendanceService.getHistory(this.employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.history = res.data.records || [];
            this.monthStats = res.data.stats;
          }
        },
        error: () => {}
      });
  }

  loadMyLeaves(): void {
    this.attendanceService.getMyLeaves(this.employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => { if (res.success) this.myLeaves = res.data || []; },
        error: () => {}
      });
  }

  doCheckIn(): void {
    this.loading = true;
    this.attendanceService.checkIn(this.employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            this.toast.success(res.message);
            this.loadTodayStatus();
            this.loadHistory();
          }
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(err?.error?.message || 'Erreur lors du pointage d\'arrivée.');
        }
      });
  }

  doCheckOut(): void {
    this.loading = true;
    this.attendanceService.checkOut(this.employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            this.toast.success(res.message);
            this.loadTodayStatus();
            this.loadHistory();
          }
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(err?.error?.message || 'Erreur lors du pointage de départ.');
        }
      });
  }

  submitLeave(): void {
    if (!this.leaveForm.start_date || !this.leaveForm.end_date) {
      this.toast.warning('Veuillez saisir les dates de congé.');
      return;
    }
    this.loading = true;
    this.attendanceService.requestLeave(this.employeeId, this.leaveForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            this.toast.success(res.message);
            this.leaveForm = { type: 'vacation', start_date: '', end_date: '', reason: '' };
            this.loadMyLeaves();
          }
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(err?.error?.message || 'Erreur lors de la demande de congé.');
        }
      });
  }

  formatTime(dt: string): string {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  leaveTypeLabel(type: string): string {
    return ({ vacation: 'Congés', sick: 'Maladie', personal: 'Personnel', maternity: 'Maternité', other: 'Autre' } as any)[type] || type;
  }

  leaveStatusLabel(status: string): string {
    return ({ pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' } as any)[status] || status;
  }
}

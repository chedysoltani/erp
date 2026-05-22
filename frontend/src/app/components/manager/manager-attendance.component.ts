import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AttendanceService } from '../../services/attendance.service';
import { ToastService } from '../../services/toast.service';

interface AttendanceRecord {
  employee_id: number;
  employee_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  late_minutes: number;
  overtime_minutes: number;
  total_hours: number;
  manager_validated: boolean;
  record_id: number | null;
}

interface LeaveRequest {
  id: number;
  employee_name: string;
  type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: string;
  created_at: string;
}

interface MonthlyStat {
  employee_id: number;
  employee_name: string;
  present_days: number;
  absent_days: number;
  late_days: number;
  total_hours: number;
  total_overtime_min: number;
  leave_days: number;
}

@Component({
  selector: 'app-manager-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  template: `
<div class="attendance-manager">

  <!-- Tabs -->
  <div class="att-tabs">
    <button class="att-tab" [class.active]="activeTab === 'team'" (click)="activeTab = 'team'; loadTeam()">
      <i class="bi bi-people-fill"></i> Équipe du jour
    </button>
    <button class="att-tab" [class.active]="activeTab === 'leaves'" (click)="activeTab = 'leaves'; loadPendingLeaves()">
      <i class="bi bi-calendar-x"></i> Congés en attente
      <span class="badge-count" *ngIf="pendingLeaves.length > 0">{{ pendingLeaves.length }}</span>
    </button>
    <button class="att-tab" [class.active]="activeTab === 'stats'" (click)="activeTab = 'stats'; loadMonthlyStats()">
      <i class="bi bi-bar-chart-line"></i> Stats mensuelles
    </button>
  </div>

  <!-- ── TEAM TAB ─────────────────────────────────────── -->
  <div *ngIf="activeTab === 'team'" class="tab-content">
    <!-- Date picker -->
    <div class="toolbar">
      <div class="date-selector">
        <button class="btn-icon" (click)="changeDate(-1)" title="Jour précédent">
          <i class="bi bi-chevron-left"></i>
        </button>
        <input type="date" [(ngModel)]="selectedDate" (change)="loadTeam()" class="date-input" />
        <button class="btn-icon" (click)="changeDate(1)" title="Jour suivant">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
      <button class="btn-refresh" (click)="loadTeam()" [disabled]="loading">
        <i class="bi bi-arrow-clockwise" [class.spin]="loading"></i>
        Actualiser
      </button>
    </div>

    <!-- Summary chips -->
    <div class="summary-chips" *ngIf="teamSummary">
      <div class="chip chip-green">
        <i class="bi bi-check-circle-fill"></i>
        <span>{{ teamSummary.present }}</span>
        <label>Présents</label>
      </div>
      <div class="chip chip-red">
        <i class="bi bi-x-circle-fill"></i>
        <span>{{ teamSummary.absent }}</span>
        <label>Absents</label>
      </div>
      <div class="chip chip-orange">
        <i class="bi bi-clock-fill"></i>
        <span>{{ teamSummary.late }}</span>
        <label>En retard</label>
      </div>
      <div class="chip chip-blue">
        <i class="bi bi-calendar-check-fill"></i>
        <span>{{ teamSummary.leave }}</span>
        <label>Congé</label>
      </div>
      <div class="chip chip-purple">
        <i class="bi bi-hourglass-split"></i>
        <span>{{ teamSummary.total }}</span>
        <label>Total</label>
      </div>
    </div>

    <!-- Loading / Empty -->
    <div *ngIf="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement...</p>
    </div>

    <div *ngIf="!loading && teamRecords.length === 0" class="empty-state">
      <i class="bi bi-calendar2-x"></i>
      <p>Aucune donnée pour cette date.</p>
    </div>

    <!-- Records table -->
    <div *ngIf="!loading && teamRecords.length > 0" class="records-table-wrap">
      <table class="records-table">
        <thead>
          <tr>
            <th>Employé</th>
            <th>Arrivée</th>
            <th>Départ</th>
            <th>Heures</th>
            <th>Retard</th>
            <th>Statut</th>
            <th>Validé</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let rec of teamRecords" [class]="'row-' + rec.status">
            <td class="emp-name">{{ rec.employee_name }}</td>
            <td>{{ rec.check_in_time ? (rec.check_in_time | slice:11:16) : '—' }}</td>
            <td>{{ rec.check_out_time ? (rec.check_out_time | slice:11:16) : '—' }}</td>
            <td>{{ rec.total_hours ? (+rec.total_hours).toFixed(1) + 'h' : '—' }}</td>
            <td [class.text-orange]="rec.late_minutes > 0">
              {{ rec.late_minutes > 0 ? rec.late_minutes + ' min' : '—' }}
            </td>
            <td>
              <span class="status-badge" [class]="'status-' + rec.status">
                {{ statusLabel(rec.status) }}
              </span>
            </td>
            <td>
              <i class="bi" [class.bi-check-circle-fill]="rec.manager_validated" [class.bi-circle]="!rec.manager_validated"
                 [class.text-green]="rec.manager_validated" [class.text-gray]="!rec.manager_validated"></i>
            </td>
            <td class="actions-cell">
              <button *ngIf="rec.record_id && !rec.manager_validated"
                class="btn-sm btn-validate" (click)="openValidate(rec)" title="Valider">
                <i class="bi bi-check-lg"></i>
              </button>
              <button *ngIf="rec.record_id && rec.check_in_time"
                class="btn-sm btn-correct" (click)="openCorrect(rec)" title="Corriger">
                <i class="bi bi-pencil"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── LEAVES TAB ──────────────────────────────────── -->
  <div *ngIf="activeTab === 'leaves'" class="tab-content">
    <div *ngIf="loadingLeaves" class="loading-state">
      <div class="spinner"></div><p>Chargement...</p>
    </div>
    <div *ngIf="!loadingLeaves && pendingLeaves.length === 0" class="empty-state">
      <i class="bi bi-calendar-check"></i>
      <p>Aucune demande de congé en attente.</p>
    </div>
    <div *ngIf="!loadingLeaves && pendingLeaves.length > 0" class="leaves-grid">
      <div class="leave-card" *ngFor="let req of pendingLeaves">
        <div class="leave-header">
          <div class="leave-employee">{{ req.employee_name }}</div>
          <span class="leave-type-badge type-{{ req.type }}">{{ leaveTypeLabel(req.type) }}</span>
        </div>
        <div class="leave-dates">
          <i class="bi bi-calendar-range"></i>
          {{ req.start_date | slice:0:10 }} → {{ req.end_date | slice:0:10 }}
          <span class="days-count">({{ req.days_count }} jour{{ req.days_count > 1 ? 's' : '' }})</span>
        </div>
        <div class="leave-reason" *ngIf="req.reason">
          <i class="bi bi-chat-left-text"></i> {{ req.reason }}
        </div>
        <div class="leave-actions">
          <button class="btn-approve" (click)="respondLeave(req.id, 'approved')">
            <i class="bi bi-check-lg"></i> Approuver
          </button>
          <button class="btn-reject" (click)="openReject(req)">
            <i class="bi bi-x-lg"></i> Refuser
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── STATS TAB ───────────────────────────────────── -->
  <div *ngIf="activeTab === 'stats'" class="tab-content">
    <div class="stats-toolbar">
      <select [(ngModel)]="statsYear" (change)="loadMonthlyStats()" class="select-input">
        <option *ngFor="let y of availableYears" [value]="y">{{ y }}</option>
      </select>
      <select [(ngModel)]="statsMonth" (change)="loadMonthlyStats()" class="select-input">
        <option value="1">Janvier</option>
        <option value="2">Février</option>
        <option value="3">Mars</option>
        <option value="4">Avril</option>
        <option value="5">Mai</option>
        <option value="6">Juin</option>
        <option value="7">Juillet</option>
        <option value="8">Août</option>
        <option value="9">Septembre</option>
        <option value="10">Octobre</option>
        <option value="11">Novembre</option>
        <option value="12">Décembre</option>
      </select>
    </div>
    <div *ngIf="loadingStats" class="loading-state">
      <div class="spinner"></div><p>Chargement...</p>
    </div>
    <div *ngIf="!loadingStats && monthlyStats.length > 0" class="stats-table-wrap">
      <table class="records-table">
        <thead>
          <tr>
            <th>Employé</th>
            <th>Présents</th>
            <th>Absents</th>
            <th>Retards</th>
            <th>Congés</th>
            <th>Heures tot.</th>
            <th>Heures sup.</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of monthlyStats">
            <td class="emp-name">{{ s.employee_name }}</td>
            <td class="text-green">{{ s.present_days }}</td>
            <td class="text-red">{{ s.absent_days }}</td>
            <td class="text-orange">{{ s.late_days }}</td>
            <td class="text-blue">{{ s.leave_days }}</td>
            <td>{{ s.total_hours ? (+s.total_hours).toFixed(1) : '0' }}h</td>
            <td class="text-purple">{{ s.total_overtime_min ? (+s.total_overtime_min / 60).toFixed(1) : '0' }}h</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── MODAL: Valider ─────────────────────────────── -->
  <div class="modal-overlay" *ngIf="showValidateModal" (click)="closeModals()">
    <div class="modal-box" (click)="$event.stopPropagation()">
      <h3 class="modal-title"><i class="bi bi-check-circle"></i> Valider le pointage</h3>
      <p class="modal-subtitle">{{ selectedRecord?.employee_name }}</p>
      <div class="form-group">
        <label>Note (optionnelle)</label>
        <textarea [(ngModel)]="validateNote" class="form-textarea" rows="3" placeholder="Commentaire..."></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" (click)="closeModals()">Annuler</button>
        <button class="btn-confirm" (click)="submitValidate()">
          <i class="bi bi-check-lg"></i> Valider
        </button>
      </div>
    </div>
  </div>

  <!-- ── MODAL: Corriger ────────────────────────────── -->
  <div class="modal-overlay" *ngIf="showCorrectModal" (click)="closeModals()">
    <div class="modal-box" (click)="$event.stopPropagation()">
      <h3 class="modal-title"><i class="bi bi-pencil-square"></i> Corriger le pointage</h3>
      <p class="modal-subtitle">{{ selectedRecord?.employee_name }}</p>
      <div class="form-group">
        <label>Heure d'arrivée</label>
        <input type="time" [(ngModel)]="correctCheckIn" class="form-input" />
      </div>
      <div class="form-group">
        <label>Heure de départ</label>
        <input type="time" [(ngModel)]="correctCheckOut" class="form-input" />
      </div>
      <div class="form-group">
        <label>Raison de la correction</label>
        <textarea [(ngModel)]="correctNote" class="form-textarea" rows="2" placeholder="Raison..."></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" (click)="closeModals()">Annuler</button>
        <button class="btn-confirm" (click)="submitCorrect()">
          <i class="bi bi-save"></i> Enregistrer
        </button>
      </div>
    </div>
  </div>

  <!-- ── MODAL: Refuser congé ───────────────────────── -->
  <div class="modal-overlay" *ngIf="showRejectModal" (click)="closeModals()">
    <div class="modal-box" (click)="$event.stopPropagation()">
      <h3 class="modal-title"><i class="bi bi-x-circle"></i> Refuser la demande</h3>
      <p class="modal-subtitle">{{ selectedLeave?.employee_name }}</p>
      <div class="form-group">
        <label>Motif du refus</label>
        <textarea [(ngModel)]="rejectNote" class="form-textarea" rows="3" placeholder="Motif..."></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" (click)="closeModals()">Annuler</button>
        <button class="btn-danger" (click)="submitReject()">
          <i class="bi bi-x-lg"></i> Refuser
        </button>
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    .attendance-manager {
      font-family: 'Inter', sans-serif;
      color: #e2e8f0;
      min-height: 100%;
    }
    .att-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 24px;
      border-bottom: 1px solid #334155;
      padding-bottom: 0;
    }
    .att-tab {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 10px 18px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: color .2s, border-color .2s;
    }
    .att-tab.active { color: #60a5fa; border-bottom-color: #60a5fa; }
    .att-tab:hover:not(.active) { color: #cbd5e1; }
    .badge-count {
      background: #ef4444;
      color: #fff;
      border-radius: 10px;
      font-size: 11px;
      padding: 1px 6px;
      font-weight: 700;
    }
    .tab-content { padding: 4px 0; }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .date-selector { display: flex; align-items: center; gap: 8px; }
    .date-input {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      padding: 7px 12px;
      font-size: 14px;
    }
    .btn-icon {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background .2s;
    }
    .btn-icon:hover { background: #334155; color: #e2e8f0; }
    .btn-refresh {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 7px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background .2s;
    }
    .btn-refresh:hover { background: #334155; color: #e2e8f0; }
    .btn-refresh:disabled { opacity: .5; cursor: not-allowed; }
    .summary-chips {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .chip span { font-size: 22px; font-weight: 700; }
    .chip label { font-size: 11px; font-weight: 400; color: rgba(255,255,255,.7); margin: 0; }
    .chip-green { background: rgba(16,185,129,.15); color: #34d399; border: 1px solid rgba(16,185,129,.3); }
    .chip-red   { background: rgba(239,68,68,.15);  color: #f87171; border: 1px solid rgba(239,68,68,.3); }
    .chip-orange{ background: rgba(245,158,11,.15); color: #fbbf24; border: 1px solid rgba(245,158,11,.3); }
    .chip-blue  { background: rgba(59,130,246,.15); color: #60a5fa; border: 1px solid rgba(59,130,246,.3); }
    .chip-purple{ background: rgba(139,92,246,.15); color: #a78bfa; border: 1px solid rgba(139,92,246,.3); }
    .loading-state, .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #64748b;
    }
    .empty-state i { font-size: 40px; display: block; margin-bottom: 12px; }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid #334155;
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: spin .8s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .records-table-wrap { overflow-x: auto; }
    .records-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .records-table th {
      text-align: left;
      padding: 10px 14px;
      background: #0f172a;
      color: #64748b;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
      border-bottom: 1px solid #1e293b;
    }
    .records-table td {
      padding: 11px 14px;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
    }
    .records-table tr:hover td { background: rgba(30,41,59,.5); }
    .row-absent td { opacity: .6; }
    .emp-name { font-weight: 600; color: #e2e8f0; }
    .text-green  { color: #34d399; }
    .text-red    { color: #f87171; }
    .text-orange { color: #fbbf24; }
    .text-blue   { color: #60a5fa; }
    .text-purple { color: #a78bfa; }
    .text-gray   { color: #475569; }
    .status-badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-present  { background: rgba(16,185,129,.2);  color: #34d399; }
    .status-late     { background: rgba(245,158,11,.2);  color: #fbbf24; }
    .status-absent   { background: rgba(239,68,68,.2);   color: #f87171; }
    .status-leave    { background: rgba(59,130,246,.2);  color: #60a5fa; }
    .status-half_day { background: rgba(139,92,246,.2);  color: #a78bfa; }
    .status-holiday  { background: rgba(100,116,139,.2); color: #94a3b8; }
    .actions-cell { display: flex; gap: 6px; }
    .btn-sm {
      padding: 5px 9px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      transition: opacity .2s;
    }
    .btn-sm:hover { opacity: .8; }
    .btn-validate { background: rgba(16,185,129,.2); color: #34d399; }
    .btn-correct  { background: rgba(59,130,246,.2);  color: #60a5fa; }
    /* Leaves */
    .leaves-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .leave-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 18px;
    }
    .leave-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .leave-employee { font-weight: 700; font-size: 15px; color: #e2e8f0; }
    .leave-type-badge {
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .type-vacation  { background: rgba(59,130,246,.2); color: #60a5fa; }
    .type-sick      { background: rgba(239,68,68,.2);  color: #f87171; }
    .type-personal  { background: rgba(139,92,246,.2); color: #a78bfa; }
    .type-maternity { background: rgba(236,72,153,.2); color: #f472b6; }
    .type-paternity { background: rgba(16,185,129,.2); color: #34d399; }
    .type-other     { background: rgba(100,116,139,.2);color: #94a3b8; }
    .leave-dates { color: #94a3b8; font-size: 13px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .days-count { color: #60a5fa; font-weight: 600; }
    .leave-reason { color: #64748b; font-size: 12px; margin-bottom: 14px; display: flex; align-items: flex-start; gap: 6px; }
    .leave-actions { display: flex; gap: 10px; }
    .btn-approve, .btn-reject, .btn-danger {
      flex: 1;
      padding: 8px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: opacity .2s;
    }
    .btn-approve { background: rgba(16,185,129,.2); color: #34d399; border: 1px solid rgba(16,185,129,.3); }
    .btn-reject  { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3); }
    .btn-danger  { background: #ef4444; color: #fff; }
    .btn-approve:hover { opacity: .8; }
    .btn-reject:hover  { opacity: .8; }
    .btn-danger:hover  { opacity: .8; }
    /* Stats */
    .stats-toolbar { display: flex; gap: 12px; margin-bottom: 20px; }
    .select-input {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      padding: 7px 12px;
      font-size: 14px;
    }
    .stats-table-wrap { overflow-x: auto; }
    /* Modals */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }
    .modal-box {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 28px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,.5);
    }
    .modal-title {
      font-size: 17px;
      font-weight: 700;
      color: #e2e8f0;
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-subtitle { color: #64748b; font-size: 13px; margin: 0 0 20px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; color: #94a3b8; font-size: 12px; margin-bottom: 6px; font-weight: 500; }
    .form-input, .form-textarea {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      padding: 9px 12px;
      font-size: 14px;
      box-sizing: border-box;
      font-family: inherit;
    }
    .form-textarea { resize: vertical; }
    .form-input:focus, .form-textarea:focus { outline: none; border-color: #60a5fa; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .btn-cancel {
      background: transparent;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 9px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: background .2s;
    }
    .btn-cancel:hover { background: #334155; }
    .btn-confirm {
      background: #3b82f6;
      border: none;
      color: #fff;
      padding: 9px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background .2s;
    }
    .btn-confirm:hover { background: #2563eb; }
    .spin { animation: spin .8s linear infinite; }
  `]
})
export class ManagerAttendanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'team' | 'leaves' | 'stats' = 'team';

  // Team tab
  selectedDate = new Date().toISOString().split('T')[0];
  teamRecords: AttendanceRecord[] = [];
  teamSummary: any = null;
  loading = false;

  // Leaves tab
  pendingLeaves: LeaveRequest[] = [];
  loadingLeaves = false;

  // Stats tab
  monthlyStats: MonthlyStat[] = [];
  loadingStats = false;
  statsYear = new Date().getFullYear();
  statsMonth = new Date().getMonth() + 1;
  availableYears = [new Date().getFullYear(), new Date().getFullYear() - 1];

  // Modal state
  showValidateModal = false;
  showCorrectModal = false;
  showRejectModal = false;
  selectedRecord: AttendanceRecord | null = null;
  selectedLeave: LeaveRequest | null = null;
  validateNote = '';
  correctCheckIn = '';
  correctCheckOut = '';
  correctNote = '';
  rejectNote = '';

  constructor(
    private attendance: AttendanceService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadTeam();
    this.loadPendingLeaves();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTeam(): void {
    this.loading = true;
    this.attendance.getTeamAttendance(this.selectedDate).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success) {
          this.teamRecords = res.data.employees || [];
          this.teamSummary = res.data.summary || null;
        }
        this.loading = false;
      },
      error: () => {
        this.toast.error('Erreur lors du chargement des présences');
        this.loading = false;
      }
    });
  }

  loadPendingLeaves(): void {
    this.loadingLeaves = true;
    this.attendance.getPendingLeaves().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success) this.pendingLeaves = res.data || [];
        this.loadingLeaves = false;
      },
      error: () => {
        this.loadingLeaves = false;
      }
    });
  }

  loadMonthlyStats(): void {
    this.loadingStats = true;
    this.attendance.getMonthlyStats(this.statsYear, this.statsMonth).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success) this.monthlyStats = res.data.stats || [];
        this.loadingStats = false;
      },
      error: () => {
        this.toast.error('Erreur lors du chargement des statistiques');
        this.loadingStats = false;
      }
    });
  }

  changeDate(days: number): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + days);
    this.selectedDate = d.toISOString().split('T')[0];
    this.loadTeam();
  }

  openValidate(rec: AttendanceRecord): void {
    this.selectedRecord = rec;
    this.validateNote = '';
    this.showValidateModal = true;
  }

  submitValidate(): void {
    if (!this.selectedRecord?.record_id) return;
    this.attendance.validateAttendance(this.selectedRecord.record_id, this.validateNote || undefined)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (res.success) {
            this.toast.success('Pointage validé');
            this.closeModals();
            this.loadTeam();
          }
        },
        error: () => { this.toast.error('Erreur lors de la validation'); }
      });
  }

  openCorrect(rec: AttendanceRecord): void {
    this.selectedRecord = rec;
    this.correctCheckIn  = rec.check_in_time  ? rec.check_in_time.slice(11, 16)  : '';
    this.correctCheckOut = rec.check_out_time ? rec.check_out_time.slice(11, 16) : '';
    this.correctNote = '';
    this.showCorrectModal = true;
  }

  submitCorrect(): void {
    if (!this.selectedRecord?.record_id || !this.correctCheckIn) {
      this.toast.warning('L\'heure d\'arrivée est requise');
      return;
    }
    const data = {
      check_in_time:  `${this.selectedDate}T${this.correctCheckIn}:00`,
      check_out_time: this.correctCheckOut ? `${this.selectedDate}T${this.correctCheckOut}:00` : null,
      note: this.correctNote || undefined
    };
    this.attendance.correctAttendance(this.selectedRecord.record_id, data)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (res.success) {
            this.toast.success('Pointage corrigé');
            this.closeModals();
            this.loadTeam();
          }
        },
        error: () => { this.toast.error('Erreur lors de la correction'); }
      });
  }

  respondLeave(id: number, status: 'approved' | 'rejected', note?: string): void {
    this.attendance.respondLeave(id, status, note).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success(status === 'approved' ? 'Congé approuvé' : 'Congé refusé');
          this.pendingLeaves = this.pendingLeaves.filter(l => l.id !== id);
          this.closeModals();
        }
      },
      error: () => { this.toast.error('Erreur lors de la réponse au congé'); }
    });
  }

  openReject(req: LeaveRequest): void {
    this.selectedLeave = req;
    this.rejectNote = '';
    this.showRejectModal = true;
  }

  submitReject(): void {
    if (!this.selectedLeave) return;
    this.respondLeave(this.selectedLeave.id, 'rejected', this.rejectNote || undefined);
  }

  closeModals(): void {
    this.showValidateModal = false;
    this.showCorrectModal = false;
    this.showRejectModal = false;
    this.selectedRecord = null;
    this.selectedLeave = null;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      present: 'Présent', late: 'En retard', absent: 'Absent',
      leave: 'Congé', half_day: 'Demi-journée', holiday: 'Férié'
    };
    return labels[status] || status;
  }

  leaveTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      vacation: 'Vacances', sick: 'Maladie', personal: 'Personnel',
      maternity: 'Maternité', paternity: 'Paternité', other: 'Autre'
    };
    return labels[type] || type;
  }
}

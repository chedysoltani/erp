import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TimesheetEntry {
  id: number;
  date: string;
  task_title: string;
  project_name: string;
  hours: number;
  description: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

interface DailySummary {
  date: string;
  totalHours: number;
  totalSeconds: number;
  entries: TimesheetEntry[];
}

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  totalSeconds: number;
  dailySummaries: DailySummary[];
}

@Component({
  selector: 'app-employee-timesheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="employee-timesheet">
      <div class="timesheet-header">
        <h3><i class="bi bi-clock-history"></i> Historique des Temps</h3>
        <div class="view-toggle">
          <button
            class="toggle-btn"
            [class.active]="viewMode === 'daily'"
            (click)="setViewMode('daily')">
            Vue Journalière
          </button>
          <button
            class="toggle-btn"
            [class.active]="viewMode === 'weekly'"
            (click)="setViewMode('weekly')">
            Vue Hebdomadaire
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-group">
          <label>Période:</label>
          <select [(ngModel)]="selectedPeriod" (change)="loadTimesheetData()">
            <option value="current_week">Cette semaine</option>
            <option value="last_week">Semaine dernière</option>
            <option value="current_month">Ce mois</option>
            <option value="last_month">Mois dernier</option>
            <option value="last_30_days">30 derniers jours</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Statut:</label>
          <select [(ngModel)]="selectedStatus" (change)="filterEntries()">
            <option value="all">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="submitted">Soumis</option>
            <option value="approved">Approuvé</option>
            <option value="rejected">Rejeté</option>
          </select>
        </div>
      </div>

      <!-- Daily View -->
      <div *ngIf="viewMode === 'daily'" class="daily-view">
        <div class="daily-entries">
          <div *ngFor="let entry of filteredEntries" class="timesheet-entry">
            <div class="entry-header">
              <div class="entry-date">
                <i class="bi bi-calendar-day"></i>
                {{ formatDate(entry.date) }}
              </div>
              <div class="entry-status" [class]="'status-' + entry.status">
                {{ getStatusLabel(entry.status) }}
              </div>
            </div>

            <div class="entry-content">
              <div class="entry-task">
                <strong>{{ entry.task_title }}</strong>
                <span class="project-name">{{ entry.project_name }}</span>
              </div>

              <div class="entry-time">
                <div class="time-range">
                  <i class="bi bi-clock"></i>
                  {{ formatTime(entry.start_time) }} - {{ formatTime(entry.end_time) }}
                </div>
                <div class="duration">
                  <i class="bi bi-stopwatch"></i>
                  {{ formatDuration(entry.duration_seconds) }}
                </div>
              </div>

              <div class="entry-description" *ngIf="entry.description">
                {{ entry.description }}
              </div>
            </div>
          </div>
        </div>

        <!-- Daily Summary -->
        <div class="daily-summary" *ngIf="dailySummaries.length > 0">
          <h4>Résumé Journalier</h4>
          <div class="summary-grid">
            <div *ngFor="let summary of dailySummaries" class="summary-card">
              <div class="summary-date">{{ formatDate(summary.date) }}</div>
              <div class="summary-hours">{{ formatDuration(summary.totalSeconds) }}</div>
              <div class="summary-entries">{{ summary.entries.length }} session(s)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Weekly View -->
      <div *ngIf="viewMode === 'weekly'" class="weekly-view">
        <div class="weekly-entries">
          <div *ngFor="let week of weeklySummaries" class="week-summary">
            <div class="week-header">
              <h4>{{ formatWeekRange(week.weekStart, week.weekEnd) }}</h4>
              <div class="week-total">{{ formatDuration(week.totalSeconds) }}</div>
            </div>

            <div class="week-details">
              <div *ngFor="let day of week.dailySummaries" class="day-summary">
                <div class="day-name">{{ formatDayName(day.date) }}</div>
                <div class="day-date">{{ formatDate(day.date) }}</div>
                <div class="day-hours">{{ formatDuration(day.totalSeconds) }}</div>
                <div class="day-entries">{{ day.entries.length }} session(s)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="statistics-section">
        <h4><i class="bi bi-bar-chart"></i> Statistiques</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon blue">
              <i class="bi bi-clock-history"></i>
            </div>
            <div class="stat-content">
              <h3>{{ formatDuration(totalSeconds) }}</h3>
              <p>Total travaillé</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon green">
              <i class="bi bi-calendar-check"></i>
            </div>
            <div class="stat-content">
              <h3>{{ totalEntries }}</h3>
              <p>Sessions</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon orange">
              <i class="bi bi-graph-up"></i>
            </div>
            <div class="stat-content">
              <h3>{{ averageHoursPerDay.toFixed(1) }}h</h3>
              <p>Moyenne/jour</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon purple">
              <i class="bi bi-trophy"></i>
            </div>
            <div class="stat-content">
              <h3>{{ formatDuration(maxDaySeconds) }}</h3>
              <p>Journée record</p>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data Message -->
      <div class="no-data-message" *ngIf="filteredEntries.length === 0">
        <i class="bi bi-calendar-x"></i>
        <h4>Aucune donnée</h4>
        <p>Vous n'avez pas encore enregistré de temps de travail pour cette période.</p>
      </div>
    </div>
  `,
  styles: [`
    .employee-timesheet {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    }

    .timesheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .timesheet-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .view-toggle {
      display: flex;
      background: #f3f4f6;
      border-radius: 8px;
      padding: 4px;
    }

    .toggle-btn {
      background: transparent;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      color: #6b7280;
    }

    .toggle-btn.active {
      background: white;
      color: #1f2937;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .filters-section {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .filter-group label {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      background: white;
    }

    .daily-entries {
      margin-bottom: 32px;
    }

    .timesheet-entry {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .entry-date {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }

    .entry-status {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-draft {
      background: #e5e7eb;
      color: #374151;
    }

    .status-submitted {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-approved {
      background: #dcfce7;
      color: #166534;
    }

    .status-rejected {
      background: #fef2f2;
      color: #dc2626;
    }

    .entry-content {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: start;
    }

    .entry-task {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .entry-task strong {
      font-size: 16px;
      color: #1f2937;
    }

    .project-name {
      font-size: 12px;
      color: #6b7280;
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      align-self: flex-start;
    }

    .entry-time {
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: right;
    }

    .time-range, .duration {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #374151;
      font-weight: 500;
    }

    .entry-description {
      grid-column: 1 / -1;
      margin-top: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border-left: 3px solid #3b82f6;
      font-size: 14px;
      color: #6b7280;
      font-style: italic;
    }

    .daily-summary h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: #374151;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .summary-card {
      background: #f9fafb;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }

    .summary-date {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .summary-hours {
      font-size: 18px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 4px;
    }

    .summary-entries {
      font-size: 12px;
      color: #6b7280;
    }

    .weekly-view {
      margin-bottom: 32px;
    }

    .week-summary {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .week-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .week-header h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }

    .week-total {
      font-size: 18px;
      font-weight: 700;
      color: #3b82f6;
    }

    .week-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .day-summary {
      background: white;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }

    .day-name {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .day-date {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 8px;
    }

    .day-hours {
      font-size: 16px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 4px;
    }

    .day-entries {
      font-size: 11px;
      color: #6b7280;
    }

    .statistics-section {
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .statistics-section h4 {
      margin: 0 0 20px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .stat-icon.blue {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
    }

    .stat-icon.green {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }

    .stat-icon.orange {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
    }

    .stat-icon.purple {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: white;
    }

    .stat-content h3 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
    }

    .stat-content p {
      margin: 0;
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .no-data-message {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .no-data-message i {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .no-data-message h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #374151;
    }

    .no-data-message p {
      margin: 0;
      font-size: 14px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .timesheet-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .filters-section {
        flex-direction: column;
        gap: 16px;
      }

      .entry-content {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .entry-time {
        text-align: left;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .week-details {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class EmployeeTimesheetComponent implements OnInit {
  viewMode: 'daily' | 'weekly' = 'daily';
  selectedPeriod: string = 'current_week';
  selectedStatus: string = 'all';

  timesheetEntries: TimesheetEntry[] = [];
  filteredEntries: TimesheetEntry[] = [];
  dailySummaries: DailySummary[] = [];
  weeklySummaries: WeeklySummary[] = [];

  constructor() {}

  ngOnInit() {
    this.loadTimesheetData();
  }

  loadTimesheetData() {
    // Simulation des données - à remplacer par un appel API réel
    this.timesheetEntries = [
      {
        id: 1,
        date: '2024-01-08',
        task_title: 'Finaliser le rapport mensuel',
        project_name: 'Rapports Financiers',
        hours: 2.5,
        description: 'Travail sur les données financières du mois',
        status: 'approved',
        start_time: '09:00',
        end_time: '11:30',
        duration_seconds: 9000
      },
      {
        id: 2,
        date: '2024-01-08',
        task_title: 'Réunion client - Présentation',
        project_name: 'Projet Alpha',
        hours: 1.0,
        description: 'Préparation de la présentation client',
        status: 'submitted',
        start_time: '14:00',
        end_time: '15:00',
        duration_seconds: 3600
      },
      {
        id: 3,
        date: '2024-01-09',
        task_title: 'Code review - Module authentification',
        project_name: 'Développement',
        hours: 3.0,
        description: 'Revue du code et corrections',
        status: 'draft',
        start_time: '10:00',
        end_time: '13:00',
        duration_seconds: 10800
      },
      {
        id: 4,
        date: '2024-01-10',
        task_title: 'Mise à jour documentation',
        project_name: 'Documentation',
        hours: 1.5,
        description: 'Mise à jour des guides utilisateur',
        status: 'approved',
        start_time: '09:30',
        end_time: '11:00',
        duration_seconds: 5400
      }
    ];

    this.filterEntries();
    this.calculateSummaries();
  }

  filterEntries() {
    this.filteredEntries = this.timesheetEntries.filter(entry => {
      if (this.selectedStatus !== 'all' && entry.status !== this.selectedStatus) {
        return false;
      }
      return true;
    });
  }

  calculateSummaries() {
    // Calcul des résumés journaliers
    const dailyMap = new Map<string, TimesheetEntry[]>();

    this.timesheetEntries.forEach(entry => {
      if (!dailyMap.has(entry.date)) {
        dailyMap.set(entry.date, []);
      }
      dailyMap.get(entry.date)!.push(entry);
    });

    this.dailySummaries = Array.from(dailyMap.entries()).map(([date, entries]) => ({
      date,
      totalHours: entries.reduce((sum, entry) => sum + entry.hours, 0),
      totalSeconds: entries.reduce((sum, entry) => sum + entry.duration_seconds, 0),
      entries
    }));

    // Calcul des résumés hebdomadaires
    this.calculateWeeklySummaries();
  }

  calculateWeeklySummaries() {
    const weeks = new Map<string, TimesheetEntry[]>();

    this.timesheetEntries.forEach(entry => {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Dimanche comme début de semaine
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, []);
      }
      weeks.get(weekKey)!.push(entry);
    });

    this.weeklySummaries = Array.from(weeks.entries()).map(([weekStart, entries]) => {
      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const dailySummaries = this.dailySummaries.filter(summary => {
        const summaryDate = new Date(summary.date);
        return summaryDate >= startDate && summaryDate <= endDate;
      });

      return {
        weekStart,
        weekEnd: endDate.toISOString().split('T')[0],
        totalHours: entries.reduce((sum, entry) => sum + entry.hours, 0),
        totalSeconds: entries.reduce((sum, entry) => sum + entry.duration_seconds, 0),
        dailySummaries
      };
    });
  }

  setViewMode(mode: 'daily' | 'weekly') {
    this.viewMode = mode;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  formatTime(timeString: string): string {
    return timeString;
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  formatWeekRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${startStr} - ${endStr}`;
  }

  formatDayName(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'submitted': return 'Soumis';
      case 'approved': return 'Approuvé';
      case 'rejected': return 'Rejeté';
      default: return status;
    }
  }

  get totalSeconds(): number {
    return this.timesheetEntries.reduce((sum, entry) => sum + entry.duration_seconds, 0);
  }

  get totalEntries(): number {
    return this.timesheetEntries.length;
  }

  get averageHoursPerDay(): number {
    const uniqueDays = new Set(this.timesheetEntries.map(entry => entry.date)).size;
    return uniqueDays > 0 ? (this.totalSeconds / 3600) / uniqueDays : 0;
  }

  get maxDaySeconds(): number {
    return Math.max(...this.dailySummaries.map(day => day.totalSeconds), 0);
  }
}
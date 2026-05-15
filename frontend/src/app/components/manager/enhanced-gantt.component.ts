import { Component, OnInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../services/analytics.service';
import { TaskEnhancedService } from '../../services/task-enhanced.service';
interface GanttTask {
  id: number;
  title: string;
  status: string;
  progress: number;
  start_date: string;
  end_date: string;
  estimated_hours: number;
  actual_hours: number;
  is_blocked: boolean;
  priority: string;
  project_name: string;
  assignments: any[];
  dependencies: any[];
  assignee_id?: number | null;
  primary_assignee_name?: string | null;
}

interface GanttViewMode {
  value: 'day' | 'week' | 'month';
  label: string;
}

@Component({
  selector: 'app-enhanced-gantt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="enhanced-gantt-container">
      <div class="gantt-header">
        <div class="gantt-title">
          <h2>{{ projectName || 'Diagramme de Gantt' }}</h2>
          <div class="gantt-summary" *ngIf="projectSummary">
            <div class="summary-progress">
              <span class="summary-label">Avancement global du projet</span>
              <strong>{{ projectProgressDisplay }}%</strong>
            </div>
            <div class="summary-bar">
              <div class="summary-bar-fill" [style.width.%]="projectProgressDisplay"></div>
            </div>
          </div>
          <div class="gantt-stats">
            <span class="stat-item">
              <i class="bi bi-list-task"></i>
              {{ tasks.length }} tâche(s)
            </span>
            <span class="stat-item">
              <i class="bi bi-people"></i>
              {{ uniqueEmployees }} employé(s)
            </span>
            <span class="stat-item">
              <i class="bi bi-link-45deg"></i>
              {{ totalDependencies }} dépendance(s)
            </span>
          </div>
        </div>
        <div class="gantt-controls">
          <div class="view-modes">
            <button 
              *ngFor="let mode of viewModes"
              class="view-mode-btn"
              [class.active]="currentView === mode.value"
              (click)="changeView(mode.value)">
              {{ mode.label }}
            </button>
          </div>
          <button class="refresh-btn" (click)="loadGanttData()">
            <i class="bi bi-arrow-clockwise"></i>
            Actualiser
          </button>
        </div>
      </div>

      <div class="gantt-dep-alerts" *ngIf="dependencyAlerts.length > 0">
        <div class="gantt-dep-alert-title">
          <i class="bi bi-exclamation-triangle-fill"></i>
          Prédécesseurs en retard (impact sur les tâches liées)
        </div>
        <ul>
          <li *ngFor="let a of dependencyAlerts">
            <strong>{{ a.predecessor_title }}</strong> (échéance {{ a.predecessor_due | date:'shortDate' }}) bloque encore
            <strong>{{ a.dependent_title }}</strong>
            <span class="dep-type-tag">{{ dependencyTypeShort(a.dependency_type) }}</span>
          </li>
        </ul>
      </div>

      <div class="gantt-timeline" *ngIf="!loading && tasks.length > 0">
        <div class="timeline-header">
          <div class="task-column-header">Tâches</div>
          <div class="timeline-dates">
            <div *ngFor="let date of timelineDates" class="timeline-date">
              <span class="date-label">{{ date.label }}</span>
            </div>
          </div>
        </div>

        <div class="gantt-body">
          <svg
            *ngIf="dependencyLinkPaths.length > 0"
            class="gantt-dep-overlay"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-hidden="true">
            <path
              *ngFor="let link of dependencyLinkPaths"
              [attr.d]="link.d"
              class="gantt-dep-path" />
          </svg>
          <div *ngFor="let task of tasks" class="gantt-row" [class.blocked]="task.is_blocked">
            <div class="task-info">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-dates">
                {{ task.start_date }} → {{ task.end_date }}
                · {{ taskDurationDays(task) }} j.<ng-container *ngIf="task.estimated_hours"> · {{ task.estimated_hours }} h est.</ng-container>
              </div>
              <div class="task-meta">
                <span class="task-status" [ngClass]="'status-' + task.status">{{ task.status }}</span>
                <span class="task-priority" [ngClass]="'priority-' + task.priority">{{ task.priority }}</span>
                <span class="task-progress">{{ task.progress }}%</span>
              </div>
              <div class="task-assignments">
                <div 
                  *ngFor="let assignment of task.assignments" 
                  class="employee-avatar"
                  [title]="assignment.employee_name"
                  [ngClass]="'assignment-' + assignment.status">
                  {{ assignment.employee_initials }}
                </div>
              </div>
              <div class="task-dependencies" *ngIf="task.dependencies && task.dependencies.length > 0"
                   [title]="dependencyTooltip(task)">
                <i class="bi bi-link-45deg"></i>
                <span>{{ task.dependencies.length }} dép.</span>
              </div>
            </div>
            <div class="timeline-bar-container">
              <div 
                class="timeline-bar"
                [style.left.%]="getTaskLeftPosition(task)"
                [style.width.%]="getTaskWidth(task)"
                [ngClass]="'status-' + task.status"
                [class.blocked]="task.is_blocked"
                [draggable]="true"
                (dragstart)="onDragStart($event, task)"
                (dragend)="onDragEnd($event)">
                <div class="bar-progress" [style.width.%]="task.progress"></div>
                <div class="bar-label">{{ task.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gantt-loading" *ngIf="loading">
        <div class="gantt-spinner" role="status"></div>
        <p>Chargement du diagramme…</p>
      </div>

      <div class="gantt-empty" *ngIf="!loading && tasks.length === 0">
        <i class="bi bi-calendar2-x"></i>
        <p>Aucune tâche pour ce projet, ou données indisponibles.</p>
      </div>

      <div class="gantt-legend">
        <div class="legend-item">
          <span class="legend-color status-todo"></span>
          <span>À faire</span>
        </div>
        <div class="legend-item">
          <span class="legend-color status-in_progress"></span>
          <span>En cours</span>
        </div>
        <div class="legend-item">
          <span class="legend-color status-done"></span>
          <span>Terminé</span>
        </div>
        <div class="legend-item">
          <span class="legend-color blocked"></span>
          <span>Bloquée</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .enhanced-gantt-container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .gantt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .gantt-title h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }

    .gantt-summary {
      margin-bottom: 12px;
    }

    .summary-progress {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 13px;
      color: #555;
    }

    .summary-label { font-weight: 500; }

    .summary-bar {
      height: 8px;
      background: #e8eaf0;
      border-radius: 6px;
      overflow: hidden;
    }

    .summary-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #1976d2, #42a5f5);
      border-radius: 6px;
      transition: width 0.35s ease;
    }

    .gantt-empty {
      text-align: center;
      padding: 48px 24px;
      color: #789;
      border: 1px dashed #cfd8dc;
      border-radius: 12px;
      margin-top: 8px;
    }

    .gantt-empty i { font-size: 40px; display: block; margin-bottom: 12px; }

    .gantt-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e3f2fd;
      border-top-color: #1976d2;
      border-radius: 50%;
      animation: gantt-spin 0.8s linear infinite;
    }

    @keyframes gantt-spin {
      to { transform: rotate(360deg); }
    }

    .gantt-stats {
      display: flex;
      gap: 16px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #666;
    }

    .stat-item i {
      font-size: 16px;
    }

    .gantt-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .view-modes {
      display: flex;
      gap: 4px;
      background: #f5f5f5;
      padding: 4px;
      border-radius: 8px;
    }

    .view-mode-btn {
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #666;
      transition: all 0.2s;
    }

    .view-mode-btn:hover {
      background: rgba(0,0,0,0.05);
    }

    .view-mode-btn.active {
      background: white;
      color: #1976d2;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .refresh-btn {
      padding: 8px 16px;
      border: 1px solid #e0e0e0;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .refresh-btn:hover {
      background: #f5f5f5;
    }

    .gantt-timeline {
      overflow-x: auto;
    }

    .timeline-header {
      display: flex;
      background: #f9f9f9;
      padding: 12px;
      border-radius: 8px 8px 0 0;
      border: 1px solid #e0e0e0;
      border-bottom: none;
    }

    .task-column-header {
      width: 300px;
      min-width: 300px;
      font-weight: 600;
      color: #333;
      padding: 8px;
    }

    .timeline-dates {
      display: flex;
      flex: 1;
    }

    .timeline-date {
      flex: 1;
      text-align: center;
      padding: 8px;
      font-size: 12px;
      color: #666;
      border-left: 1px solid #e0e0e0;
    }

    .gantt-body {
      border: 1px solid #e0e0e0;
      border-radius: 0 0 8px 8px;
      position: relative;
    }

    .gantt-dep-overlay {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }

    .gantt-dep-path {
      fill: none;
      stroke: #5c6bc0;
      stroke-width: 2.5;
      opacity: 0.85;
    }

    .gantt-row {
      position: relative;
      z-index: 2;
    }

    .gantt-dep-alerts {
      margin-bottom: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      background: #fff8e1;
      border: 1px solid #ffcc80;
      color: #5d4037;
      font-size: 13px;
    }

    .gantt-dep-alert-title {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .gantt-dep-alerts ul {
      margin: 0;
      padding-left: 18px;
    }

    .gantt-dep-alerts li {
      margin-bottom: 4px;
    }

    .dep-type-tag {
      margin-left: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #1565c0;
    }

    .gantt-row {
      display: flex;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      transition: background 0.2s;
    }

    .gantt-row:hover {
      background: #f9f9f9;
    }

    .gantt-row.blocked {
      background: rgba(255, 152, 0, 0.05);
    }

    .task-info {
      width: 300px;
      min-width: 300px;
      padding-right: 16px;
    }

    .task-title {
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .task-dates {
      font-size: 11px;
      color: #789;
      margin-bottom: 8px;
    }

    .task-meta {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .task-status, .task-priority {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .task-status.todo { background: #e3f2fd; color: #1976d2; }
    .task-status.in_progress { background: #fff3e0; color: #f57c00; }
    .task-status.done { background: #e8f5e9; color: #388e3c; }
    .task-status.cancelled { background: #ffebee; color: #d32f2f; }

    .task-priority.low { background: #e8f5e9; color: #388e3c; }
    .task-priority.medium { background: #fff3e0; color: #f57c00; }
    .task-priority.high { background: #ffebee; color: #d32f2f; }

    .task-progress {
      font-size: 12px;
      color: #666;
    }

    .task-assignments {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .employee-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #1976d2;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .employee-avatar:hover {
      transform: scale(1.1);
    }

    .employee-avatar.assignment-pending { background: #9e9e9e; }
    .employee-avatar.assignment-in_progress { background: #f57c00; }
    .employee-avatar.assignment-completed { background: #388e3c; }

    .task-dependencies {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
    }

    .timeline-bar-container {
      flex: 1;
      position: relative;
      min-height: 40px;
    }

    .timeline-bar {
      position: absolute;
      height: 32px;
      border-radius: 6px;
      cursor: move;
      transition: box-shadow 0.2s;
      overflow: hidden;
    }

    .timeline-bar:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .timeline-bar.status-todo { background: #2196f3; }
    .timeline-bar.status-in_progress { background: #ff9800; }
    .timeline-bar.status-done { background: #4caf50; }
    .timeline-bar.status-cancelled { background: #f44336; }
    .timeline-bar.blocked { background: #ff9800; opacity: 0.6; }

    .bar-progress {
      height: 100%;
      background: rgba(255,255,255,0.3);
      transition: width 0.3s;
    }

    .bar-label {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: white;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100% - 16px);
    }

    .gantt-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #666;
    }

    .gantt-loading p {
      margin-top: 16px;
    }

    .gantt-legend {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #666;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }

    .legend-color.status-todo { background: #2196f3; }
    .legend-color.status-in_progress { background: #ff9800; }
    .legend-color.status-done { background: #4caf50; }
    .legend-color.blocked { background: #ff9800; opacity: 0.6; }
  `]
})
export class EnhancedGanttComponent implements OnInit, OnChanges {
  @Input() projectId!: number;
  @Input() projectName!: string;

  tasks: GanttTask[] = [];
  projectSummary: {
    id: number;
    name: string;
    progress: number;
    start_date?: string;
    end_date?: string;
    deadline?: string;
  } | null = null;
  loading = false;
  currentView: 'day' | 'week' | 'month' = 'week';
  viewModes: GanttViewMode[] = [
    { value: 'day', label: 'Jour' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' }
  ];
  timelineDates: { date: Date; label: string }[] = [];

  dependencyAlerts: any[] = [];
  dependencyLinkPaths: { d: string }[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private taskEnhancedService: TaskEnhancedService
  ) { }

  get projectProgressDisplay(): number {
    const p = this.projectSummary?.progress;
    const n = Number(p);
    if (Number.isNaN(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  ngOnInit() {
    if (this.projectId) {
      this.loadGanttData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] && this.projectId && !changes['projectId'].firstChange) {
      this.loadGanttData();
    }
  }

  loadGanttData() {
    if (!this.projectId) {
      return;
    }
    this.loading = true;
    this.analyticsService.getGanttData(this.projectId).subscribe({
      next: (response: any) => {
        const rows = response.data || [];
        this.projectSummary = response.project || null;
        this.tasks = Array.isArray(rows) ? rows.map((row: any) => this.normalizeGanttTask(row)) : [];
        this.generateTimeline();
        this.taskEnhancedService.getProjectDependencyAlerts(this.projectId).subscribe({
          next: (al: any) => {
            this.dependencyAlerts = Array.isArray(al?.data) ? al.data : [];
          },
          error: () => {
            this.dependencyAlerts = [];
          },
          complete: () => {
            this.loading = false;
          }
        });
      },
      error: (error) => {
        console.error('Erreur chargement Gantt:', error);
        this.tasks = [];
        this.projectSummary = null;
        this.timelineDates = [];
        this.dependencyAlerts = [];
        this.dependencyLinkPaths = [];
        this.loading = false;
      }
    });
  }

  private parseJsonArray(val: unknown): any[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private normalizeGanttTask(row: any): GanttTask {
    const assignments = this.parseJsonArray(row.assignments).filter(
      (a: any) => a && a.employee_id != null
    );
    if (assignments.length === 0 && row.assignee_id && row.primary_assignee_name) {
      assignments.push({
        employee_id: row.assignee_id,
        employee_name: row.primary_assignee_name,
        employee_initials: this.initialsFromName(String(row.primary_assignee_name)),
        status: 'pending'
      });
    }
    const dependencies = this.parseJsonArray(row.dependencies).filter(
      (d: any) => d && d.depends_on_task_id != null
    );

    let start = this.parseDateOnly(row.start_date);
    let end = this.parseDateOnly(row.end_date);
    if (!start) {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    }
    if (!end || end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 86400000);
    }

    return {
      id: row.id,
      title: row.title || 'Sans titre',
      status: row.status || 'todo',
      progress: Math.min(100, Math.max(0, Number(row.progress) || 0)),
      start_date: this.toYmd(start),
      end_date: this.toYmd(end),
      estimated_hours: row.estimated_hours != null ? Number(row.estimated_hours) : 0,
      actual_hours: row.actual_hours != null ? Number(row.actual_hours) : 0,
      is_blocked: !!row.is_blocked,
      priority: row.priority || 'medium',
      project_name: row.project_name || '',
      assignments,
      dependencies,
      assignee_id: row.assignee_id,
      primary_assignee_name: row.primary_assignee_name
    };
  }

  private parseDateOnly(val: unknown): Date | null {
    if (val == null || val === '') return null;
    const d = new Date(val as string);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  dependencyTooltip(task: GanttTask): string {
    if (!task.dependencies?.length) return '';
    return task.dependencies
      .map(
        (d: any) =>
          `${d.depends_on_task_title || '#' + d.depends_on_task_id} (${d.dependency_type || '?'})`
      )
      .join('\n');
  }

  taskDurationDays(task: GanttTask): number {
    const a = new Date(task.start_date).getTime();
    const b = new Date(task.end_date).getTime();
    return Math.max(1, Math.ceil((b - a) / 86400000));
  }

  generateTimeline() {
    if (this.tasks.length === 0) {
      this.timelineDates = [];
      this.dependencyLinkPaths = [];
      return;
    }

    const starts = this.tasks.map((t) => new Date(t.start_date).getTime());
    const ends = this.tasks.map((t) => new Date(t.end_date).getTime());
    const startDate = new Date(Math.min(...starts));
    const endDate = new Date(Math.max(...ends));

    startDate.setDate(startDate.getDate() - 2);
    endDate.setDate(endDate.getDate() + 2);

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const safeDays = Math.max(days, 1);

    this.timelineDates = [];
    for (let i = 0; i < safeDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      this.timelineDates.push({
        date,
        label: this.formatDateLabel(date)
      });
    }

    this.rebuildDependencyLinks();
  }

  formatDateLabel(date: Date): string {
    switch (this.currentView) {
      case 'day':
        return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      case 'week':
        return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      case 'month':
        return date.toLocaleDateString('fr-FR', { month: 'short' });
      default:
        return date.getDate().toString();
    }
  }

  getTaskLeftPosition(task: GanttTask): number {
    if (this.timelineDates.length === 0) return 0;

    const taskStart = new Date(task.start_date);
    const timelineStart = new Date(this.timelineDates[0].date);
    const totalDays = this.timelineDates.length;

    const daysFromStart = Math.floor(
      (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const clamped = Math.max(0, Math.min(totalDays, daysFromStart));
    return (clamped / totalDays) * 100;
  }

  getTaskWidth(task: GanttTask): number {
    if (this.timelineDates.length === 0) return 0;

    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    const totalDays = this.timelineDates.length;

    const rawDays = Math.ceil(
      (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const taskDuration = Math.max(1, rawDays);
    const widthPct = (taskDuration / totalDays) * 100;
    return Math.min(100, Math.max(0.5, widthPct));
  }

  changeView(view: 'day' | 'week' | 'month') {
    this.currentView = view;
    this.generateTimeline();
  }

  dependencyTypeShort(type: string): string {
    const m: Record<string, string> = {
      finish_to_start: 'FS',
      start_to_start: 'SS',
      finish_to_finish: 'FF'
    };
    return m[type] || type;
  }

  private rebuildDependencyLinks() {
    this.dependencyLinkPaths = [];
    if (!this.tasks.length || !this.timelineDates.length) {
      return;
    }
    const n = this.tasks.length;
    const rowH = 1000 / n;
    const W = 700;
    const L = 300;
    const idx = (id: number) => this.tasks.findIndex((t) => t.id === id);
    const left = (t: GanttTask) => L + (W * this.getTaskLeftPosition(t)) / 100;
    const right = (t: GanttTask) => L + (W * (this.getTaskLeftPosition(t) + this.getTaskWidth(t))) / 100;

    for (const succ of this.tasks) {
      for (const dep of succ.dependencies || []) {
        const pid = Number(dep.depends_on_task_id);
        const pred = this.tasks.find((t) => t.id === pid);
        if (!pred) continue;
        const pi = idx(pred.id);
        const si = idx(succ.id);
        if (pi < 0 || si < 0) continue;
        const type = dep.dependency_type || 'finish_to_start';
        const y1 = (pi + 0.45) * rowH;
        const y2 = (si + 0.45) * rowH;
        let x1: number;
        let x2: number;
        if (type === 'start_to_start') {
          x1 = left(pred);
          x2 = left(succ);
        } else if (type === 'finish_to_finish') {
          x1 = right(pred);
          x2 = right(succ);
        } else {
          x1 = right(pred);
          x2 = left(succ);
        }
        const midx = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${midx} ${y1}, ${midx} ${y2}, ${x2} ${y2}`;
        this.dependencyLinkPaths.push({ d });
      }
    }
  }

  onDragStart(event: DragEvent, task: GanttTask) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('taskId', task.id.toString());
    }
  }

  onDragEnd(_event: DragEvent) {
    // Réservé : mise à jour des dates par glisser-déposer
  }

  get uniqueEmployees(): number {
    const employees = new Set<number>();
    this.tasks.forEach((task) => {
      task.assignments?.forEach((assignment: any) => {
        if (assignment.employee_id != null) {
          employees.add(Number(assignment.employee_id));
        }
      });
      if (task.assignee_id != null) {
        employees.add(Number(task.assignee_id));
      }
    });
    return employees.size;
  }

  get totalDependencies(): number {
    return this.tasks.reduce((total, task) => total + (task.dependencies?.length || 0), 0);
  }
}

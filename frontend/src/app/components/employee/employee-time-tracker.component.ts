import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskEnhancedService } from '../../services/task-enhanced.service';

interface TimeSession {
  id: number;
  task_id: number;
  employee_id: number;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  status: 'running' | 'paused' | 'completed';
  description: string;
  employee_name: string;
  task_title?: string;
}

@Component({
  selector: 'app-employee-time-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="employee-time-tracker">
      <div class="tracker-header">
        <h3><i class="bi bi-stopwatch"></i> Pointage de Temps</h3>
        <div class="current-task" *ngIf="currentTask">
          <span class="task-label">Tâche actuelle:</span>
          <span class="task-name">{{ currentTask.title }}</span>
        </div>
      </div>

      <!-- Timer Display -->
      <div class="timer-section" *ngIf="activeSession">
        <div class="timer-display">
          <div class="timer-value">{{ formatTime(elapsedTime) }}</div>
          <div class="timer-status" [ngClass]="'status-' + activeSession.status">
            <i class="bi" [ngClass]="getStatusIcon(activeSession.status)"></i>
            {{ getStatusLabel(activeSession.status) }}
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-section" *ngIf="currentTask">
        <div class="control-buttons">
          <button
            *ngIf="!activeSession"
            class="btn-control btn-start"
            (click)="startSession()">
            <i class="bi bi-play-fill"></i>
            Démarrer
          </button>

          <button
            *ngIf="activeSession && activeSession.status === 'running'"
            class="btn-control btn-pause"
            (click)="pauseSession()">
            <i class="bi bi-pause-fill"></i>
            Pause
          </button>

          <button
            *ngIf="activeSession && activeSession.status === 'paused'"
            class="btn-control btn-resume"
            (click)="resumeSession()">
            <i class="bi bi-play-fill"></i>
            Reprendre
          </button>

          <button
            *ngIf="activeSession"
            class="btn-control btn-stop"
            (click)="completeSession()">
            <i class="bi bi-stop-fill"></i>
            Terminer
          </button>
        </div>

        <!-- Session Description -->
        <div class="session-description" *ngIf="activeSession">
          <label>Description de la session:</label>
          <textarea
            [(ngModel)]="sessionDescription"
            placeholder="Sur quoi travaillez-vous actuellement ? (facultatif)"
            rows="3"
            class="description-input">
          </textarea>
        </div>
      </div>

      <!-- No Task Selected -->
      <div class="no-task-message" *ngIf="!currentTask">
        <i class="bi bi-info-circle"></i>
        <p>Sélectionnez une tâche pour commencer le pointage</p>
      </div>

      <!-- Recent Sessions -->
      <div class="sessions-section" *ngIf="sessions.length > 0">
        <h4><i class="bi bi-clock-history"></i> Sessions Récentes</h4>
        <div class="sessions-list">
          <div *ngFor="let session of sessions.slice(0, 5)" class="session-item">
            <div class="session-info">
              <div class="session-task">{{ session.task_title || 'Tâche #' + session.task_id }}</div>
              <div class="session-time">{{ formatTime(session.duration_seconds) }}</div>
              <div class="session-date">{{ formatDate(session.start_time) }}</div>
            </div>
            <div class="session-status" [ngClass]="'status-' + session.status">
              {{ getStatusLabel(session.status) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Daily Summary -->
      <div class="daily-summary" *ngIf="todaySessions.length > 0">
        <h4><i class="bi bi-calendar-day"></i> Aujourd'hui</h4>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-value">{{ formatTime(todayTotalSeconds) }}</span>
            <span class="stat-label">Total travaillé</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ todaySessions.length }}</span>
            <span class="stat-label">Sessions</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .employee-time-tracker {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    }

    .tracker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .tracker-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .current-task {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      padding: 8px 12px;
      background: #f3f4f6;
      border-radius: 8px;
    }

    .task-label {
      color: #6b7280;
      font-weight: 500;
    }

    .task-name {
      color: #1f2937;
      font-weight: 600;
    }

    .timer-section {
      margin-bottom: 24px;
    }

    .timer-display {
      text-align: center;
      padding: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      color: white;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
    }

    .timer-value {
      font-size: 48px;
      font-weight: 800;
      font-family: 'Courier New', monospace;
      margin-bottom: 12px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .timer-status {
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .timer-status.status-running {
      color: #10b981;
    }

    .timer-status.status-paused {
      color: #f59e0b;
    }

    .timer-status.status-completed {
      color: #6b7280;
    }

    .controls-section {
      margin-bottom: 24px;
    }

    .control-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .btn-control {
      padding: 14px 20px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-start {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    }

    .btn-start:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
    }

    .btn-pause {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
    }

    .btn-pause:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    }

    .btn-resume {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }

    .btn-resume:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }

    .btn-stop {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
    }

    .btn-stop:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }

    .session-description {
      background: #f9fafb;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .session-description label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }

    .description-input {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      resize: vertical;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .description-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .no-task-message {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
      background: #f9fafb;
      border-radius: 12px;
      border: 2px dashed #d1d5db;
    }

    .no-task-message i {
      font-size: 32px;
      display: block;
      margin-bottom: 12px;
      opacity: 0.6;
    }

    .sessions-section, .daily-summary {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .sessions-section h4, .daily-summary h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sessions-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .session-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
      transition: background 0.2s;
    }

    .session-item:hover {
      background: #f3f4f6;
    }

    .session-info {
      flex: 1;
    }

    .session-task {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .session-time {
      font-size: 16px;
      font-weight: 700;
      color: #374151;
      font-family: 'Courier New', monospace;
      margin-bottom: 2px;
    }

    .session-date {
      font-size: 12px;
      color: #6b7280;
    }

    .session-status {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .session-status.status-completed {
      background: #dcfce7;
      color: #166534;
    }

    .session-status.status-paused {
      background: #fef3c7;
      color: #92400e;
    }

    .session-status.status-running {
      background: #dbeafe;
      color: #1e40af;
    }

    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
    }

    .stat-item {
      text-align: center;
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 800;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .control-buttons {
        grid-template-columns: 1fr;
      }

      .tracker-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .timer-value {
        font-size: 36px;
      }
    }
  `]
})
export class EmployeeTimeTrackerComponent implements OnInit, OnDestroy {
  @Input() taskId!: number;
  @Input() employeeId?: number;
  @Input() currentTask: any;

  activeSession: TimeSession | null = null;
  sessions: TimeSession[] = [];
  elapsedTime: number = 0;
  sessionDescription: string = '';
  private timerInterval: any = null;

  constructor(private taskEnhancedService: TaskEnhancedService) {}

  ngOnInit() {
    if (this.taskId) {
      this.loadSessions();
      this.checkActiveSession();
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  loadSessions() {
    this.taskEnhancedService.getTaskTimeSessions(this.taskId).subscribe({
      next: (response) => {
        this.sessions = response.data || [];
        this.updateTodayStats();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des sessions:', error);
      }
    });
  }

  checkActiveSession() {
    const runningSession = this.sessions.find(s => s.status === 'running');
    if (runningSession) {
      this.activeSession = runningSession;
      this.startTimer();
    }
  }

  startSession() {
    if (this.employeeId == null) {
      alert('Impossible de démarrer le pointage : employé non identifié.');
      return;
    }

    const employeeId = this.employeeId;
    const description = this.sessionDescription.trim() || 'Pointage en cours';

    this.taskEnhancedService.startTimeSession(this.taskId, employeeId, description).subscribe({
      next: (response) => {
        this.activeSession = {
          id: response.data.sessionId,
          task_id: this.taskId,
          employee_id: employeeId,
          start_time: new Date().toISOString(),
          end_time: null,
          duration_seconds: 0,
          status: 'running',
          description,
          employee_name: '',
          task_title: this.currentTask?.title
        };
        this.startTimer();
        this.sessionDescription = '';
      },
      error: (error) => {
        console.error('Erreur lors du démarrage de la session:', error);
        alert('Erreur lors du démarrage du pointage. Veuillez réessayer.');
      }
    });
  }

  pauseSession() {
    if (this.activeSession) {
      this.taskEnhancedService.pauseTimeSession(this.taskId, this.activeSession.id).subscribe({
        next: (response) => {
          this.activeSession!.status = 'paused';
          this.activeSession!.duration_seconds = response.data.duration;
          this.stopTimer();
          this.loadSessions();
        },
        error: (error) => {
          console.error('Erreur lors de la pause:', error);
          alert('Erreur lors de la mise en pause. Veuillez réessayer.');
        }
      });
    }
  }

  resumeSession() {
    if (this.activeSession) {
      this.taskEnhancedService.resumeTimeSession(this.taskId, this.activeSession.id).subscribe({
        next: (response) => {
          this.activeSession!.status = 'running';
          this.startTimer();
        },
        error: (error) => {
          console.error('Erreur lors de la reprise:', error);
          alert('Erreur lors de la reprise. Veuillez réessayer.');
        }
      });
    }
  }

  completeSession() {
    if (this.activeSession) {
      this.taskEnhancedService.completeTimeSession(this.taskId, this.activeSession.id).subscribe({
        next: (response) => {
          this.activeSession = null;
          this.stopTimer();
          this.elapsedTime = 0;
          this.loadSessions();
        },
        error: (error) => {
          console.error('Erreur lors de la fin de session:', error);
          alert('Erreur lors de la fin du pointage. Veuillez réessayer.');
        }
      });
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.activeSession && this.activeSession.status === 'running') {
        this.elapsedTime++;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return 'bi-play-circle-fill';
      case 'paused': return 'bi-pause-circle-fill';
      case 'completed': return 'bi-check-circle-fill';
      default: return 'bi-circle';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'running': return 'En cours';
      case 'paused': return 'En pause';
      case 'completed': return 'Terminée';
      default: return status;
    }
  }

  get todaySessions(): TimeSession[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.sessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      return sessionDate >= today && sessionDate < tomorrow;
    });
  }

  get todayTotalSeconds(): number {
    return this.todaySessions.reduce((total, session) => total + session.duration_seconds, 0);
  }

  private updateTodayStats() {
    // Les getters todaySessions et todayTotalSeconds se mettent à jour automatiquement
  }
}
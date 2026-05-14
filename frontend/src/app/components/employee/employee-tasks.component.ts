import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeTimeTrackerComponent } from './employee-time-tracker.component';

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed';
  due_date: string;
  progress: number;
  project_name?: string;
  assigned_date?: string;
}

@Component({
  selector: 'app-employee-tasks',
  standalone: true,
  imports: [CommonModule, EmployeeTimeTrackerComponent],
  template: `
    <div class="employee-tasks">
      <div class="tasks-header">
        <h3><i class="bi bi-list-task"></i> Mes Tâches</h3>
        <div class="tasks-stats">
          <span class="stat">{{ tasks.length }} tâches</span>
          <span class="stat">{{ inProgressTasks.length }} en cours</span>
        </div>
      </div>

      <!-- Task Selection -->
      <div class="task-selection" *ngIf="tasks.length > 0">
        <h4>Sélectionnez une tâche pour le pointage</h4>
        <div class="task-grid">
          <div
            *ngFor="let task of tasks"
            class="task-card"
            [class.selected]="selectedTask?.id === task.id"
            [class]="getTaskPriorityClass(task.priority)"
            (click)="selectTask(task)">

            <div class="task-header">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-priority" [class]="'priority-' + task.priority">
                {{ getPriorityLabel(task.priority) }}
              </div>
            </div>

            <div class="task-description" *ngIf="task.description">
              {{ task.description }}
            </div>

            <div class="task-meta">
              <div class="task-status" [class]="'status-' + task.status">
                <i class="bi" [ngClass]="getStatusIcon(task.status)"></i>
                {{ getStatusLabel(task.status) }}
              </div>
              <div class="task-due-date" *ngIf="task.due_date">
                <i class="bi bi-calendar"></i>
                {{ formatDate(task.due_date) }}
              </div>
            </div>

            <div class="task-progress" *ngIf="task.progress !== undefined">
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="task.progress"></div>
              </div>
              <span class="progress-text">{{ task.progress }}%</span>
            </div>

            <div class="task-project" *ngIf="task.project_name">
              <i class="bi bi-folder"></i>
              {{ task.project_name }}
            </div>
          </div>
        </div>
      </div>

      <!-- Time Tracker for Selected Task -->
      <div class="time-tracker-section" *ngIf="selectedTask">
        <app-employee-time-tracker
          [taskId]="selectedTask.id"
          [employeeId]="currentEmployeeId"
          [currentTask]="selectedTask">
        </app-employee-time-tracker>
      </div>

      <!-- No Tasks Message -->
      <div class="no-tasks-message" *ngIf="tasks.length === 0">
        <i class="bi bi-inbox"></i>
        <h4>Aucune tâche assignée</h4>
        <p>Vous n'avez actuellement aucune tâche assignée.</p>
      </div>
    </div>
  `,
  styles: [`
    .employee-tasks {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    }

    .tasks-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .tasks-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tasks-stats {
      display: flex;
      gap: 16px;
    }

    .stat {
      font-size: 14px;
      color: #6b7280;
      background: #f3f4f6;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: 500;
    }

    .task-selection h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: #374151;
    }

    .task-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .task-card {
      background: #f9fafb;
      border: 2px solid transparent;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .task-card.selected {
      border-color: #3b82f6;
      background: #eff6ff;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .task-card.high {
      border-left: 4px solid #ef4444;
    }

    .task-card.medium {
      border-left: 4px solid #f59e0b;
    }

    .task-card.low {
      border-left: 4px solid #10b981;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .task-title {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      flex: 1;
      margin-right: 12px;
    }

    .task-priority {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .priority-high {
      background: #fef2f2;
      color: #dc2626;
    }

    .priority-medium {
      background: #fef3c7;
      color: #d97706;
    }

    .priority-low {
      background: #dcfce7;
      color: #166534;
    }

    .task-description {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .task-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .task-status {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-todo {
      background: #e5e7eb;
      color: #374151;
    }

    .status-in_progress {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-completed {
      background: #dcfce7;
      color: #166534;
    }

    .task-due-date {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .task-progress {
      margin-bottom: 16px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #1d4ed8);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      color: #6b7280;
      font-weight: 600;
    }

    .task-project {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .time-tracker-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .no-tasks-message {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .no-tasks-message i {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .no-tasks-message h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #374151;
    }

    .no-tasks-message p {
      margin: 0;
      font-size: 14px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .task-grid {
        grid-template-columns: 1fr;
      }

      .task-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .task-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .tasks-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
    }
  `]
})
export class EmployeeTasksComponent implements OnInit {
  @Input() employeeId?: number;
  @Output() taskSelected = new EventEmitter<Task>();

  tasks: Task[] = [];
  selectedTask: Task | null = null;
  currentEmployeeId?: number;

  constructor(private employeeService: EmployeeService) {}

  ngOnInit() {
    this.currentEmployeeId = this.employeeId ?? this.getCurrentEmployeeIdFromStorage() ?? undefined;
    this.loadEmployeeTasks();
  }

  private getCurrentEmployeeIdFromStorage(): number | null {
    const employeeData = localStorage.getItem('currentEmployee');
    if (!employeeData) {
      return null;
    }
    try {
      const employee = JSON.parse(employeeData);
      return employee?.id ?? null;
    } catch {
      return null;
    }
  }

  loadEmployeeTasks() {
    if (!this.currentEmployeeId) {
      console.warn('Aucun employé connecté, impossible de charger les tâches.');
      this.tasks = [];
      return;
    }

    this.employeeService.getEmployeeTasks(this.currentEmployeeId).subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          this.tasks = response.data;
        } else {
          console.warn('Réponse inattendue de l\'API des tâches employé:', response);
          this.tasks = [];
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des tâches employé:', error);
        this.tasks = [];
      }
    });
  }

  selectTask(task: Task) {
    this.selectedTask = task;
    this.taskSelected.emit(task);
  }

  get inProgressTasks(): Task[] {
    return this.tasks.filter(task => task.status === 'in_progress');
  }

  getTaskPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'high': return 'Élevée';
      case 'medium': return 'Moyenne';
      case 'low': return 'Faible';
      default: return priority;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'todo': return 'bi-circle';
      case 'in_progress': return 'bi-play-circle-fill';
      case 'completed': return 'bi-check-circle-fill';
      default: return 'bi-circle';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'todo': return 'À faire';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminée';
      default: return status;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }
}
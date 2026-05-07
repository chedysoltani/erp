import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerAuthService } from '../../services/manager-auth.service';

interface GanttProject {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  color: string;
}

interface GanttTask {
  id: string;
  projectId: number;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  assignee: string;
}

@Component({
  selector: 'app-gantt-page',
  template: `
    <div class="gantt-page">
      <div class="page-header">
        <button class="back-btn" (click)="goBack()">
          <i class="bi bi-arrow-left"></i>
          Retour au Dashboard
        </button>
        <h1>Diagramme de Gantt</h1>
        <div class="header-actions">
          <button class="btn-primary">
            <i class="bi bi-plus-circle"></i>
            Nouveau Projet
          </button>
          <button class="btn-secondary">
            <i class="bi bi-download"></i>
            Exporter
          </button>
        </div>
      </div>

      <div class="gantt-controls">
        <div class="view-modes">
          <button class="view-btn active" (click)="changeView('month')">Mois</button>
          <button class="view-btn" (click)="changeView('week')">Semaine</button>
          <button class="view-btn" (click)="changeView('day')">Jour</button>
        </div>
        <div class="filters">
          <select class="filter-select">
            <option>Tous les projets</option>
            <option>Actifs</option>
            <option>Terminés</option>
          </select>
          <select class="filter-select">
            <option>Toutes les tâches</option>
            <option>En cours</option>
            <option>Terminées</option>
          </select>
        </div>
      </div>

      <div class="gantt-container">
        <div class="gantt-header">
          <div class="project-column">Projets</div>
          <div class="timeline-header">
            <div class="timeline-dates">
              <div *ngFor="let month of getTimelineMonths()" class="month-header">
                <div class="month-name">{{ month.name }}</div>
                <div class="month-days">
                  <div *ngFor="let day of month.days" class="day-header">
                    {{ day }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="gantt-body">
          <div *ngFor="let project of projects" class="project-row">
            <div class="project-info">
              <div class="project-name">{{ project.name }}</div>
              <div class="project-progress">
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="project.progress" [style.background]="project.color"></div>
                </div>
                <span class="progress-text">{{ project.progress }}%</span>
              </div>
              <div class="project-dates">
                <span class="date">{{ project.startDate }}</span>
                <i class="bi bi-arrow-right"></i>
                <span class="date">{{ project.endDate }}</span>
              </div>
            </div>
            
            <div class="project-timeline">
              <div class="timeline-bar">
                <div class="project-duration" 
                     [ngStyle]="getProjectStyle(project)"
                     [style.background]="project.color"
                     [style.opacity]="0.3">
                </div>
              </div>
              
              <div class="tasks-layer">
                <div *ngFor="let task of getProjectTasks(project.id)" 
                     class="task-bar"
                     [ngStyle]="getTaskStyle(task)"
                     [title]="task.name + ' - ' + task.assignee + ' (' + task.progress + '%)'">
                  <div class="task-info">
                    <span class="task-name">{{ task.name }}</span>
                    <span class="task-assignee">{{ task.assignee }}</span>
                  </div>
                  <div class="task-progress">{{ task.progress }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gantt-legend">
        <div class="legend-item">
          <div class="legend-color done"></div>
          <span>Terminé</span>
        </div>
        <div class="legend-item">
          <div class="legend-color progress"></div>
          <span>En cours</span>
        </div>
        <div class="legend-item">
          <div class="legend-color todo"></div>
          <span>À faire</span>
        </div>
        <div class="legend-item">
          <div class="legend-color blocked"></div>
          <span>Bloqué</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .gantt-page {
      padding: 20px;
      background: #f8fafc;
      min-height: 100vh;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #f3f4f6;
      border: none;
      border-radius: 8px;
      color: #374151;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: #e5e7eb;
    }

    .page-header h1 {
      margin: 0;
      color: #1f2937;
      font-size: 24px;
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn-primary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #7C74FF;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .btn-primary:hover {
      background: #6b63e6;
    }

    .btn-secondary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .gantt-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      background: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .view-modes {
      display: flex;
      gap: 8px;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 8px;
    }

    .view-btn {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: #64748b;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .view-btn:hover {
      background: #e2e8f0;
      color: #475569;
    }

    .view-btn.active {
      background: #7C74FF;
      color: white;
    }

    .filters {
      display: flex;
      gap: 12px;
    }

    .filter-select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      color: #374151;
      font-size: 14px;
    }

    .gantt-container {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .gantt-header {
      display: flex;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .project-column {
      width: 300px;
      padding: 16px 20px;
      font-weight: 600;
      color: #374151;
      background: #f8fafc;
      border-right: 2px solid #e2e8f0;
    }

    .timeline-header {
      flex: 1;
      overflow-x: auto;
    }

    .timeline-dates {
      display: flex;
      min-width: 100%;
      padding: 16px;
    }

    .month-header {
      min-width: 200px;
      text-align: center;
    }

    .month-name {
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .month-days {
      display: flex;
      gap: 2px;
    }

    .day-header {
      min-width: 24px;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      padding: 2px;
    }

    .gantt-body {
      max-height: 600px;
      overflow-y: auto;
    }

    .project-row {
      display: flex;
      border-bottom: 1px solid #e5e7eb;
      min-height: 120px;
      transition: background 0.2s ease;
    }

    .project-row:hover {
      background: #f9fafb;
    }

    .project-info {
      width: 300px;
      padding: 16px 20px;
      border-right: 1px solid #e5e7eb;
      background: #fafbfc;
    }

    .project-name {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
      font-size: 15px;
    }

    .project-progress {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .progress-bar {
      flex: 1;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
      min-width: 35px;
    }

    .project-dates {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #6b7280;
    }

.date {
      font-weight: 500;
    }

    .project-timeline {
      flex: 1;
      position: relative;
      min-height: 120px;
      background: linear-gradient(to right, #fafbfc 1px, transparent 1px);
      background-size: 20px 100%;
    }

    .timeline-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      padding: 0 20px;
    }

    .project-duration {
      height: 16px;
      border-radius: 4px;
      min-width: 40px;
    }

    .tasks-layer {
      position: absolute;
      top: 40px;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 20px;
    }

    .task-bar {
      position: absolute;
      height: 28px;
      border-radius: 6px;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: white;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 60px;
      z-index: 2;
    }

    .task-bar:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 3;
    }

    .task-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .task-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .task-assignee {
      font-size: 10px;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .task-progress {
      font-size: 10px;
      opacity: 0.9;
      margin-left: 4px;
    }

    .gantt-legend {
      display: flex;
      gap: 24px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      margin-top: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #374151;
      font-weight: 500;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }

    .legend-color.done { background: #10b981; }
    .legend-color.progress { background: #f59e0b; }
    .legend-color.todo { background: #6b7280; }
    .legend-color.blocked { background: #ef4444; }
  `]
})
export class GanttPageComponent implements OnInit {
  projects: GanttProject[] = [];
  tasks: GanttTask[] = [];
  currentView: 'month' | 'week' | 'day' = 'month';

  constructor(
    private router: Router,
    private managerAuthService: ManagerAuthService
  ) {}

  ngOnInit() {
    this.loadRealData();
  }

  loadRealData() {
    // Charger les vrais projets depuis la base de données
    this.managerAuthService.getManagerProjects().subscribe({
      next: (response: any) => {
        const projects = response.data || response;
        console.log('Projets chargés pour Gantt:', projects);
        
        // Transformer les projets pour le Gantt
        this.projects = projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          startDate: project.startDate || this.getDefaultStartDate(),
          endDate: project.endDate || this.getDefaultEndDate(),
          progress: project.progress || 0,
          status: project.status || 'active',
          color: this.getProjectColor(project.priority || 'medium')
        }));

        // Charger les tâches associées
        this.loadProjectTasks();
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des projets:', error);
        // Utiliser les données de démonstration en cas d'erreur
        this.generateFallbackData();
      }
    });
  }

  loadProjectTasks() {
    // Charger les tâches pour chaque projet en utilisant les routes existantes
    this.tasks = [];
    
    // Charger les tâches par statut pour avoir toutes les tâches
    const statuses = ['todo', 'in_progress', 'done'];
    
    statuses.forEach(status => {
      this.managerAuthService.getTasksByStatus(status).subscribe({
        next: (response: any) => {
          const tasks = response.data || response;
          console.log(`Tâches ${status} chargées:`, tasks);
          
          // Transformer les tâches pour le Gantt
          const ganttTasks = tasks.map((task: any) => {
            const project = this.projects.find(p => p.id === task.project_id);
            if (!project) {
              console.error(`Projet non trouvé pour la tâche ${task.title}`);
              return null;
            }
            
            const startDate = task.due_date || this.getDefaultStartDate();
            const endDate = this.calculateEndDate(startDate, task.estimated_hours || 8);
            
            console.log(`Tâche: ${task.title}`, {
              startDate,
              endDate,
              projectId: project.id,
              projectStartDate: project.startDate,
              projectEndDate: project.endDate,
              originalProgress: task.progress,
              status: task.status,
              calculatedProgress: task.status === 'done' ? 100 : (task.progress || 0),
              allFields: task,
              prototypeKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(task)),
              allKeys: Object.keys(task)
            });
            
            return {
              id: `${project.id}-${task.id}`,
              projectId: project.id,
              name: task.title,
              startDate: startDate,
              endDate: endDate,
              progress: task.status === 'done' ? 100 : (task.progress || 0),
              status: task.status || 'todo',
              assignee: this.getAssigneeName(task)
            };
          }).filter(Boolean);
          
          this.tasks.push(...ganttTasks);
        },
        error: (error: any) => {
          console.error(`Erreur lors du chargement des tâches ${status}:`, error);
        }
      });
    });
  }

  generateFallbackData() {
    // Données de démonstration si la base de données n'est pas accessible
    this.projects = [
      {
        id: 1,
        name: 'Développement ERP',
        startDate: '2026-05-01',
        endDate: '2026-06-30',
        progress: 65,
        status: 'active',
        color: '#7C74FF'
      },
      {
        id: 2,
        name: 'Site E-commerce',
        startDate: '2026-05-15',
        endDate: '2026-07-15',
        progress: 40,
        status: 'active',
        color: '#10B981'
      },
      {
        id: 3,
        name: 'Application Mobile',
        startDate: '2026-06-01',
        endDate: '2026-08-30',
        progress: 20,
        status: 'active',
        color: '#F59E0B'
      },
      {
        id: 4,
        name: 'Migration Cloud',
        startDate: '2026-04-15',
        endDate: '2026-05-30',
        progress: 85,
        status: 'active',
        color: '#EF4444'
      }
    ];

    this.tasks = [
      { id: '1-1', projectId: 1, name: 'Analyse des besoins', startDate: '2026-05-01', endDate: '2026-05-15', progress: 100, status: 'done', assignee: 'Jean Dupont' },
      { id: '1-2', projectId: 1, name: 'Développement Backend', startDate: '2026-05-10', endDate: '2026-06-10', progress: 70, status: 'progress', assignee: 'Marie Martin' },
      { id: '1-3', projectId: 1, name: 'Tests & Validation', startDate: '2026-06-05', endDate: '2026-06-30', progress: 30, status: 'todo', assignee: 'Pierre Bernard' },
      { id: '2-1', projectId: 2, name: 'Maquettage', startDate: '2026-05-15', endDate: '2026-05-30', progress: 100, status: 'done', assignee: 'Sophie Lemaire' },
      { id: '2-2', projectId: 2, name: 'Développement Frontend', startDate: '2026-05-25', endDate: '2026-07-01', progress: 45, status: 'progress', assignee: 'Thomas Robert' },
      { id: '3-1', projectId: 3, name: 'Cahier des charges', startDate: '2026-06-01', endDate: '2026-06-15', progress: 80, status: 'progress', assignee: 'Claire Durand' },
      { id: '3-2', projectId: 3, name: 'Développement iOS', startDate: '2026-06-10', endDate: '2026-08-15', progress: 10, status: 'todo', assignee: 'Nicolas Petit' },
      { id: '4-1', projectId: 4, name: 'Audit Infrastructure', startDate: '2026-04-15', endDate: '2026-05-01', progress: 100, status: 'done', assignee: 'Lucas Moreau' },
      { id: '4-2', projectId: 4, name: 'Migration Données', startDate: '2026-05-01', endDate: '2026-05-30', progress: 75, status: 'progress', assignee: 'Emma Lefebvre' }
    ];
  }

  getProjectTasks(projectId: number): GanttTask[] {
    return this.tasks.filter(task => task.projectId === projectId);
  }

  getProjectStyle(project: GanttProject) {
    const allProjects = this.projects;
    if (allProjects.length === 0) return {};

    const earliestStart = new Date(Math.min(...allProjects.map(p => new Date(p.startDate).getTime())));
    const latestEnd = new Date(Math.max(...allProjects.map(p => new Date(p.endDate).getTime())));
    const totalDuration = latestEnd.getTime() - earliestStart.getTime();

    const projectStart = new Date(project.startDate).getTime() - earliestStart.getTime();
    const projectDuration = new Date(project.endDate).getTime() - new Date(project.startDate).getTime();

    return {
      position: 'absolute',
      left: `${(projectStart / totalDuration) * 100}%`,
      width: `${(projectDuration / totalDuration) * 100}%`,
      height: '16px',
      'z-index': 1
    };
  }

  getTaskStyle(task: GanttTask) {
    const project = this.projects.find(p => p.id === task.projectId);
    if (!project) {
      console.error(`Projet non trouvé pour la tâche ${task.name}`);
      return { display: 'none' };
    }

    const projectStart = new Date(project.startDate).getTime();
    const projectEnd = new Date(project.endDate).getTime();
    const taskStart = new Date(task.startDate).getTime();
    const taskEnd = new Date(task.endDate).getTime();

    // Vérifier si les dates sont valides
    if (isNaN(projectStart) || isNaN(projectEnd) || isNaN(taskStart) || isNaN(taskEnd)) {
      console.error(`Dates invalides pour la tâche ${task.name}`, {
        projectStart,
        projectEnd,
        taskStart,
        taskEnd
      });
      return { display: 'none' };
    }

    const projectDuration = projectEnd - projectStart;
    const taskStartOffset = taskStart - projectStart;
    const taskDuration = taskEnd - taskStart;

    // Si la tâche est complètement en dehors du projet, ne pas l'afficher
    if (taskEnd < projectStart || taskStart > projectEnd) {
      console.warn(`Tâche ${task.name} en dehors des limites du projet`);
      return { display: 'none' };
    }

    let left = (taskStartOffset / projectDuration) * 100;
    let width = (taskDuration / projectDuration) * 100;

    // Ajuster les valeurs si elles sont hors limites
    if (left < 0) {
      width += left;
      left = 0;
    }
    if (left + width > 100) {
      width = 100 - left;
    }

    let backgroundColor = '#6b7280'; // todo (gris)
    if (task.status === 'done') backgroundColor = '#10b981'; // vert
    else if (task.status === 'progress') backgroundColor = '#f59e0b'; // orange
    else if (task.status === 'blocked') backgroundColor = '#ef4444'; // rouge

    // Positionnement vertical plus structuré pour éviter les chevauchements
    const projectTasks = this.getTaskPosition(task.projectId, task.id);
    const top = 45 + (projectTasks * 35); // Commence à 45px, espacement de 35px entre tâches

    return {
      position: 'absolute',
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(1, width)}%`,
      'background-color': backgroundColor,
      top: `${top}px`,
      'z-index': 2,
      'min-width': '60px'
    };
  }

  // Nouvelle méthode pour calculer la position verticale des tâches
  getTaskPosition(projectId: number, taskId: string): number {
    const projectTasks = this.tasks.filter(t => t.projectId === projectId);
    const taskIndex = projectTasks.findIndex(t => t.id === taskId);
    return taskIndex;
  }

  // Méthode pour trouver le nom de l'employé assigné
  getAssigneeName(task: any): string {
    const possibleFields = [
      'employee_name', 'assignee_name', 'assigned_to', 'employee', 
      'assignee', 'user_name', 'name', 'firstName', 'lastName',
      'fullname', 'full_name', 'employeeId', 'userId'
    ];
    
    // Chercher dans les champs directs
    for (const field of possibleFields) {
      if (task[field] && typeof task[field] === 'string') {
        return task[field];
      }
    }
    
    // Chercher dans les champs imbriqués
    if (task.employee && task.employee.name) return task.employee.name;
    if (task.assignee && task.assignee.name) return task.assignee.name;
    if (task.user && task.user.name) return task.user.name;
    
    // Si on a un assignee_id, chercher le nom correspondant
    if (task.assignee_id) {
      console.log(`Recherche de l'employé avec ID: ${task.assignee_id}`);
      // Pour l'instant, afficher l'ID en attendant d'implémenter la recherche
      return `Employé #${task.assignee_id}`;
    }
    
    // Chercher dans le prototype
    const proto = Object.getPrototypeOf(task);
    for (const field of possibleFields) {
      if (proto[field] && typeof proto[field] === 'string') {
        return proto[field];
      }
    }
    
    return 'Non assigné';
  }

  getTimelineMonths() {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 4; i++) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      
      months.push({
        name: monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        days: Array.from({ length: Math.min(daysInMonth, 30) }, (_, i) => i + 1)
      });
    }
    
    return months;
  }

  changeView(view: 'month' | 'week' | 'day') {
    this.currentView = view;
    console.log('Vue changée vers:', view);
  }

  goBack() {
    this.router.navigate(['/manager/dashboard']);
  }

  // Méthodes utilitaires
  getDefaultStartDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getDefaultEndDate(): string {
    const today = new Date();
    const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 jours
    return endDate.toISOString().split('T')[0];
  }

  getProjectColor(priority: string): string {
    const colors = {
      'high': '#EF4444',
      'medium': '#F59E0B',
      'low': '#10B981'
    };
    return colors[priority as keyof typeof colors] || '#6B7280';
  }

  calculateEndDate(startDate: string, estimatedHours: number): string {
    if (!startDate) return this.getDefaultEndDate();
    
    const start = new Date(startDate);
    const daysToAdd = Math.ceil(estimatedHours / 8); // 8 heures par jour
    const end = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    return end.toISOString().split('T')[0];
  }
}

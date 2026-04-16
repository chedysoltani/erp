import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerAuthService, Employee } from '../../services/manager-auth.service';

export type SectionId = 'dashboard' | 'taches' | 'timesheet' | 'reunions' | 'documents';

interface DisplayTask {
  id: number;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  progress: number;
  status: string;
  assignee: string;
  tags: string[];
}

interface DisplayMeeting {
  id: number;
  title: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  participants: string[];
  location?: string;
  description?: string;
}

interface DisplayTimesheet {
  id: number;
  date: string;
  project: string;
  hours: number;
  description: string;
  status: string;
}

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})
export class EmployeeDashboardComponent implements OnInit {
  activeSection: SectionId = 'dashboard';
  currentEmployee: Employee | null = null;
  
  // Dashboard stats
  employeeStats = {
    tasksCompleted: 0,
    tasksInProgress: 0,
    hoursWorked: 0,
    upcomingMeetings: 0,
    pendingTasks: 0
  };

  // Données pour le dashboard
  myTasks: DisplayTask[] = [];
  myMeetings: DisplayMeeting[] = [];
  myTimesheets: DisplayTimesheet[] = [];
  recentActivities: any[] = [];

  // Données mockées pour les tâches
  baseTasks = [
    {
      id: 1,
      title: 'Finaliser le rapport mensuel',
      description: 'Préparer et soumettre le rapport d\'activité du mois',
      priority: 'high',
      dueDate: '03 Avril',
      progress: 75,
      status: 'in_progress',
      assignee: 'Moi',
      tags: ['rapport', 'mensuel']
    },
    {
      id: 2,
      title: 'Réunion client - Présentation',
      description: 'Présenter les avancées du projet au client',
      priority: 'high',
      dueDate: '05 Avril',
      progress: 50,
      status: 'todo',
      assignee: 'Moi',
      tags: ['client', 'présentation']
    },
    {
      id: 3,
      title: 'Code review - Module authentification',
      description: 'Revoir le code du module d\'authentification',
      priority: 'medium',
      dueDate: '04 Avril',
      progress: 90,
      status: 'in_progress',
      assignee: 'Moi',
      tags: ['code', 'review']
    },
    {
      id: 4,
      title: 'Mise à jour documentation technique',
      description: 'Mettre à jour la documentation API',
      priority: 'low',
      dueDate: '08 Avril',
      progress: 30,
      status: 'todo',
      assignee: 'Moi',
      tags: ['documentation', 'api']
    }
  ];

  // Données mockées pour les réunions
  baseMeetings = [
    {
      id: 1,
      title: 'Daily Stand-up',
      type: 'team',
      date: '01 Avril',
      time: '09:00',
      duration: '15 min',
      participants: ['Jean Dupont', 'Marie Martin', 'Pierre Durand'],
      location: 'Salle A',
      description: 'Point quotidien sur l\'avancement des tâches'
    },
    {
      id: 2,
      title: 'Réunion projet ERP',
      type: 'project',
      date: '02 Avril',
      time: '14:00',
      duration: '1h',
      participants: ['Jean Dupont', 'Sophie Lefebvre', 'Thomas Bernard'],
      location: 'Salle B',
      description: 'Discussion sur les avancées du projet ERP'
    },
    {
      id: 3,
      title: 'Review de code',
      type: 'technical',
      date: '03 Avril',
      time: '10:30',
      duration: '30 min',
      participants: ['Marie Martin', 'Paul Lefevre'],
      location: 'Visio',
      description: 'Review du code du module authentification'
    }
  ];

  // Données mockées pour les timesheets
  baseTimesheets = [
    {
      id: 1,
      date: '31 Mars',
      project: 'Développement ERP',
      hours: 8,
      description: 'Développement module utilisateur',
      status: 'validated'
    },
    {
      id: 2,
      date: '30 Mars',
      project: 'Site E-commerce',
      hours: 7.5,
      description: 'Intégration panier d\'achat',
      status: 'validated'
    },
    {
      id: 3,
      date: '29 Mars',
      project: 'Application Mobile',
      hours: 8,
      description: 'Développement interface iOS',
      status: 'pending'
    }
  ];

  constructor(
    private router: Router,
    private managerAuthService: ManagerAuthService
  ) {}

  ngOnInit() {
    this.checkEmployeeAuth();
    this.loadEmployeeData();
    this.calculateStats();
  }

  checkEmployeeAuth() {
    // Vérifier si l'employé est connecté
    const employeeData = localStorage.getItem('currentEmployee');
    if (employeeData) {
      this.currentEmployee = JSON.parse(employeeData);
    } else {
      // Rediriger vers la page de login employé
      this.router.navigate(['/employee-login']);
    }
  }

  loadEmployeeData() {
    // Charger les données de l'employé
    this.myTasks = [...this.baseTasks];
    this.myMeetings = [...this.baseMeetings];
    this.myTimesheets = [...this.baseTimesheets];
    
    // Charger les activités récentes
    this.loadRecentActivities();
  }

  loadRecentActivities() {
    // Données mockées pour les activités récentes
    this.recentActivities = [
      {
        id: 1,
        type: 'task',
        title: 'Tâche "Finaliser le rapport mensuel" mise à jour',
        time: 'Il y a 2 heures',
        icon: 'bi-check-circle',
        color: 'success'
      },
      {
        id: 2,
        type: 'meeting',
        title: 'Réunion "Daily Stand-up" confirmée',
        time: 'Il y a 4 heures',
        icon: 'bi-calendar-check',
        color: 'info'
      },
      {
        id: 3,
        type: 'timesheet',
        title: 'Timesheet du 31 Mars validé',
        time: 'Hier',
        icon: 'bi-clock-history',
        color: 'warning'
      },
      {
        id: 4,
        type: 'task',
        title: 'Nouvelle tâche assignée: "Code review"',
        time: 'Il y a 2 jours',
        icon: 'bi-plus-circle',
        color: 'primary'
      }
    ];
  }

  calculateStats() {
    // Calculer les statistiques
    this.employeeStats.tasksCompleted = this.myTasks.filter(t => t.status === 'done').length;
    this.employeeStats.tasksInProgress = this.myTasks.filter(t => t.status === 'in_progress').length;
    this.employeeStats.pendingTasks = this.myTasks.filter(t => t.status === 'todo').length;
    this.employeeStats.upcomingMeetings = this.myMeetings.length;
    this.employeeStats.hoursWorked = this.myTimesheets
      .filter(t => t.status === 'validated')
      .reduce((sum, t) => sum + t.hours, 0);
  }

  changeSection(sectionId: SectionId) {
    this.activeSection = sectionId;
  }

  // Méthodes pour les tâches
  updateTaskProgress(taskId: number, progress: number) {
    const task = this.myTasks.find(t => t.id === taskId);
    if (task) {
      task.progress = progress;
      if (progress === 100) {
        task.status = 'done';
      } else if (progress > 0 && task.status === 'todo') {
        task.status = 'in_progress';
      }
      this.calculateStats();
    }
  }

  increaseTaskProgress(taskId: number) {
    const task = this.myTasks.find(t => t.id === taskId);
    if (task) {
      const newProgress = Math.min(100, task.progress + 10);
      this.updateTaskProgress(taskId, newProgress);
    }
  }

  completeTask(taskId: number) {
    this.updateTaskProgress(taskId, 100);
  }

  // Méthodes pour les réunions
  joinMeeting(meetingId: number) {
    const meeting = this.myMeetings.find(m => m.id === meetingId);
    if (meeting) {
      alert(`Rejoindre la réunion: ${meeting.title}`);
      // TODO: Implémenter la logique pour rejoindre la réunion
    }
  }

  // Méthodes pour les timesheets
  submitTimesheet(timesheetId: number) {
    const timesheet = this.myTimesheets.find(t => t.id === timesheetId);
    if (timesheet) {
      timesheet.status = 'submitted';
      alert('Timesheet soumis pour validation');
    }
  }

  // Méthodes utilitaires
  getPriorityColor(priority: string): string {
    const colors = {
      'high': '#EF4444',
      'medium': '#F59E0B',
      'low': '#10B981'
    };
    return colors[priority as keyof typeof colors] || '#6B7280';
  }

  getStatusColor(status: string): string {
    const colors = {
      'done': '#10B981',
      'in_progress': '#3B82F6',
      'todo': '#6B7280',
      'validated': '#10B981',
      'pending': '#F59E0B',
      'submitted': '#3B82F6'
    };
    return colors[status as keyof typeof colors] || '#6B7280';
  }

  getTaskStatusLabel(status: string): string {
    const labels = {
      'done': 'Terminé',
      'in_progress': 'En cours',
      'todo': 'À faire'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getTimesheetStatusLabel(status: string): string {
    const labels = {
      'validated': 'Validé',
      'pending': 'En attente',
      'submitted': 'Soumis'
    };
    return labels[status as keyof typeof labels] || status;
  }

  logout() {
    localStorage.removeItem('currentEmployee');
    this.router.navigate(['/employee-login']);
  }
}

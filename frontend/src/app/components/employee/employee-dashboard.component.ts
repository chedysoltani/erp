import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManagerAuthService, Employee } from '../../services/manager-auth.service';
import { EmployeeService } from '../../services/employee.service';
import { DocumentsService } from '../../services/documents.service';
import { Document } from '../../models/document.model';
import { EmployeeTasksComponent } from './employee-tasks.component';
import { EmployeeTimesheetComponent } from './employee-timesheet.component';
import { SkillsProfileComponent } from './skills-profile.component';

export type SectionId = 'dashboard' | 'taches' | 'timesheet' | 'reunions' | 'documents' | 'competences';

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
  styleUrls: ['./employee-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, EmployeeTasksComponent, EmployeeTimesheetComponent, SkillsProfileComponent]
})
export class EmployeeDashboardComponent implements OnInit {
  activeSection: SectionId = 'dashboard';
  currentEmployee: Employee | null = null;
  loading = false;
  documents: Document[] = [];
  
  // Dashboard stats
  employeeStats = {
    tasksCompleted: 0,
    tasksInProgress: 0,
    hoursWorked: 0,
    upcomingMeetings: 0,
    pendingTasks: 0
  };

  /** Nombre de notifications de tâche non lues (assignations, etc.) */
  taskNotificationCount = 0;

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
    private managerAuthService: ManagerAuthService,
    private employeeService: EmployeeService,
    private documentsService: DocumentsService
  ) {}

  ngOnInit() {
    this.checkEmployeeAuth();
    this.loadEmployeeData();
    this.loadMeetingsFromDatabase();
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
    if (!this.currentEmployee) return;
    
    // Charger les données réelles depuis le backend
    this.loadRealEmployeeData();
    this.loadDocuments();
  }


  loadRealEmployeeData() {
    const employeeId = this.currentEmployee?.id;
    if (!employeeId) return;

    // Charger le dashboard complet
    this.employeeService.getEmployeeDashboard(employeeId).subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.data;
          
          // Mettre à jour les statistiques
          this.employeeStats.tasksCompleted = data.stats.done;
          this.employeeStats.tasksInProgress = data.stats.in_progress;
          this.employeeStats.pendingTasks = data.stats.todo;
          this.employeeStats.upcomingMeetings = data.upcomingMeetings.length;
          
          // Mettre à jour les données
          this.myTasks = this.formatTasks(data.recentTasks);
          this.myMeetings = this.formatMeetings(data.upcomingMeetings);
          
          console.log('Données employé chargées:', response);
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des données employé:', error);
        // En cas d'erreur, utiliser les données mockées
        this.loadMockData();
      }
    });

    // Charger les timesheets séparément
    this.loadTimesheets();

    this.employeeService.getTaskNotifications(employeeId).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.taskNotificationCount = Number(res.unreadCount) || 0;
        }
      },
      error: () => {
        this.taskNotificationCount = 0;
      }
    });
  }

  loadMockData() {
    // Charger les données mockées en fallback
    this.myTasks = [...this.baseTasks];
    this.myMeetings = [...this.baseMeetings];
    this.myTimesheets = [...this.baseTimesheets];
    this.calculateStats();
  }

  formatTasks(tasks: any[]): DisplayTask[] {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.due_date ? new Date(task.due_date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }) : '',
      progress: task.progress || 0,
      status: task.status,
      assignee: 'Moi',
      tags: task.tags ? JSON.parse(task.tags) : []
    }));
  }

  formatMeetings(meetings: any[]): DisplayMeeting[] {
    return meetings.map(meeting => {
      const dateTime = new Date(meeting.date_time);
      return {
        id: meeting.id,
        title: meeting.title,
        type: meeting.type,
        date: dateTime.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        time: dateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        duration: meeting.duration,
        participants: ['Équipe'], // TODO: Implement participants when available
        location: meeting.location,
        description: meeting.description
      };
    });
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
      
      // Déterminer le nouveau statut
      let newStatus = task.status;
      if (progress === 100) {
        newStatus = 'done';
      } else if (progress > 0 && task.status === 'todo') {
        newStatus = 'in_progress';
      }
      
      // Mettre à jour sur le backend
      if (this.currentEmployee) {
        this.employeeService.updateTaskStatus(this.currentEmployee.id, taskId, newStatus).subscribe({
          next: (response) => {
            if (response.success) {
              task.status = newStatus;
              this.calculateStats();
              console.log('Statut de tâche mis à jour:', response);
            }
          },
          error: (error) => {
            console.error('Erreur lors de la mise à jour du statut:', error);
            // En cas d'erreur, mettre à jour localement quand même
            task.status = newStatus;
            this.calculateStats();
          }
        });
      } else {
        // Fallback local si pas d'employé connecté
        task.status = newStatus;
        this.calculateStats();
      }
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

  loadMeetingsFromDatabase() {
    console.log('Début du chargement des réunions assignées depuis la base...');
    
    if (!this.currentEmployee) {
      console.error('Aucun employé connecté pour charger les réunions');
      return;
    }

    this.managerAuthService.getEmployeeMeetings(this.currentEmployee.id).subscribe({
      next: (response: any) => {
        const meetings = response.data || response;
        console.log('Réunions assignées chargées depuis la base:', meetings);
        
        // Transformer les réunions pour l'affichage
        this.myMeetings = meetings.map((meeting: any) => ({
          id: meeting.id,
          title: meeting.title,
          type: meeting.type,
          date: new Date(meeting.date_time).toLocaleDateString('fr-FR'),
          time: new Date(meeting.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          duration: meeting.duration,
          participants: [], // Sera rempli plus tard si nécessaire
          location: meeting.location,
          description: meeting.description,
          status: meeting.meeting_status || 'pending',
          color: meeting.type === 'team' ? '#10B981' : meeting.type === 'client' ? '#3B82F6' : meeting.type === 'technical' ? '#F59E0B' : '#8B5CF6'
        }));
        
        console.log('Réunions transformées pour affichage:', this.myMeetings);
        
        // Mettre à jour les statistiques
        this.calculateStats();
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des réunions assignées:', error);
        // En cas d'erreur, utiliser les données mockées
        console.log('Fallback: utilisation des données mockées pour les réunions');
        this.myMeetings = [...this.baseMeetings];
        this.calculateStats();
      }
    });
  }

  // Méthodes pour les réunions
  joinMeeting(meetingId: number) {
    const meeting = this.myMeetings.find(m => m.id === meetingId);
    if (meeting) {
      alert(`Rejoindre la réunion: ${meeting.title}`);
      // TODO: Implémenter la logique pour rejoindre la réunion
    }
  }

  updateMeetingStatus(meetingId: number, status: string) {
    if (!this.currentEmployee) return;
    
    this.managerAuthService.updateMeetingAttendance(meetingId, this.currentEmployee.id, status).subscribe({
      next: (response: any) => {
        console.log('Statut de réunion mis à jour:', response);
        alert('Statut de participation mis à jour avec succès');
        // Recharger les réunions
        this.loadMeetingsFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        alert('Erreur lors de la mise à jour du statut');
      }
    });
  }

  // Méthodes pour les timesheets
  loadTimesheets() {
    if (!this.currentEmployee) return;
    
    this.employeeService.getEmployeeTimesheets(this.currentEmployee.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.myTimesheets = response.data;
          console.log('Timesheets chargés:', this.myTimesheets);
          this.calculateStats();
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des timesheets:', error);
        // En cas d'erreur, utiliser les données mockées
        this.myTimesheets = [...this.baseTimesheets];
      }
    });
  }

  submitTimesheet(timesheetId: number) {
    if (!this.currentEmployee) return;
    
    this.employeeService.submitTimesheet(this.currentEmployee.id, timesheetId).subscribe({
      next: (response) => {
        if (response.success) {
          const timesheet = this.myTimesheets.find(t => t.id === timesheetId);
          if (timesheet) {
            timesheet.status = 'submitted';
            alert('Timesheet soumis pour validation');
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors de la soumission du timesheet:', error);
        alert('Erreur lors de la soumission du timesheet');
      }
    });
  }

  // Variables pour le modal de création de timesheet
  showCreateTimesheetModal = false;
  newTimesheet = {
    date: '',
    project_id: null,
    hours: 0,
    description: ''
  };

  // Liste des projets disponibles
  availableProjects: any[] = [];

  openCreateTimesheetModal() {
    this.showCreateTimesheetModal = true;
    this.resetTimesheetForm();
    this.loadAvailableProjects();
  }

  loadAvailableProjects() {
    if (!this.currentEmployee) return;
    
    this.employeeService.getEmployeeProjects(this.currentEmployee.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.availableProjects = response.data;
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des projets:', error);
        // Projets par défaut si erreur
        this.availableProjects = [
          { id: 1, name: 'Développement ERP' },
          { id: 2, name: 'Site E-commerce' },
          { id: 3, name: 'Application Mobile' }
        ];
      }
    });
  }

  closeCreateTimesheetModal() {
    this.showCreateTimesheetModal = false;
    this.resetTimesheetForm();
  }

  resetTimesheetForm() {
    this.newTimesheet = {
      date: '',
      project_id: null,
      hours: 0,
      description: ''
    };
  }

  createTimesheet() {
    if (!this.currentEmployee) return;
    
    if (!this.newTimesheet.date || !this.newTimesheet.hours) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const timesheetData = {
      date: new Date(this.newTimesheet.date).toISOString().split('T')[0],
      project_id: this.newTimesheet.project_id,
      hours: this.newTimesheet.hours,
      description: this.newTimesheet.description,
      status: 'pending'
    };

    this.employeeService.createTimesheet(this.currentEmployee.id, timesheetData).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Timesheet créé avec succès');
          this.closeCreateTimesheetModal();
          this.loadTimesheets(); // Recharger la liste
        }
      },
      error: (error) => {
        console.error('Erreur lors de la création du timesheet:', error);
        alert('Erreur lors de la création du timesheet');
      }
    });
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

  stopPropagation(event: Event) {
    event.stopPropagation();
  }

  loadDocuments() {
    this.loading = true;
    if (!this.currentEmployee) {
      this.loading = false;
      return;
    }
    this.documentsService.getMyDocuments(this.currentEmployee.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.documents = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des documents:', error);
        this.loading = false;
      }
    });
  }

  downloadDocument(doc: Document) {
    this.documentsService.downloadDocument(doc.file_path);
  }

  getFileIcon(type: string): string {
    if (type.includes('pdf')) return 'bi-file-earmark-pdf text-danger';
    if (type.includes('word') || type.includes('doc')) return 'bi-file-earmark-word text-primary';
    if (type.includes('image')) return 'bi-file-earmark-image text-success';
    return 'bi-file-earmark-text';
  }
}

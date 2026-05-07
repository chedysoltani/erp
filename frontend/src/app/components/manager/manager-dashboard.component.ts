import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerAuthService, Manager, Project, Meeting } from '../../services/manager-auth.service';

export type SectionId =
  | 'dashboard' | 'projets' | 'taches' | 'gantt'
  | 'utilisateurs' | 'reunions' | 'recommandations' | 'simulateur' | 'documents';

interface DisplayProject {
  id: number;
  name: string;
  description: string;
  progress: number;
  team: number;
  deadline: string;
  status: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  priority?: string;
}

interface CalendarDay {
  number: number;
  isToday: boolean;
  hasMeeting: boolean;
  meetings: { color: string; title: string; time: string }[];
}

interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  assignee: string;
  assigneeInitials: string;
  avatarColor: string;
  dueDate: string;
  progress: number;
  status: string;
  tags: string[];
  submittedAt?: string;
  completedDate?: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css', './calendar-improvements.css', './tasks-improvements.css', './gantt-preview.css']
})
export class ManagerDashboardComponent implements OnInit {
  activeSection: SectionId = 'dashboard';
  isScrolled = false;
  showCreateProjectModal = false;
  showViewProjectModal = false;
  showEditProjectModal = false;
  showCreateUserModal = false;
  showEditUserModal = false;
  selectedProject: any = null;
  projectToEdit: any = {
    name: '',
    description: '',
    team: '',
    priority: 'medium',
    startDate: '',
    endDate: '',
    budget: 0
  };

  // Propriétés pour les réunions
  showCreateMeetingModal = false;
  showViewMeetingModal = false;
  showEditMeetingModal = false;
  showDayMeetingsModal = false;
  selectedMeeting: any = null;
  selectedDay: CalendarDay | null = null;
  selectedDayMeetings: any[] = [];
  meetingToEdit: any = {
    title: '',
    date: '',
    duration: '1h',
    location: 'Salle A',
    type: 'team',
    agenda: [],
    participants: [],
    selectedEmployees: [],
    notes: ''
  };
  newMeeting: any = {
    title: '',
    date: '',
    duration: '1h',
    location: 'Salle A',
    type: 'team',
    agenda: [],
    participants: [],
    selectedEmployees: [],
    notes: ''
  };

  // Propriétés pour la navigation du calendrier
  currentCalendarDate = new Date();
  calendarMonth = '';
  calendarYear = 0;

  currentManager: Manager | null = null;
  loading = false;

  ngOnInit() {
    this.currentManager = this.managerAuthService.currentManagerValue;
    
    // Vérifier si le manager est connecté
    if (!this.currentManager) {
      this.router.navigate(['/manager-login']);
      return;
    }

    // S'abonner aux changements de manager
    this.managerAuthService.currentManager.subscribe(manager => {
      this.currentManager = manager;
      if (!manager) {
        this.router.navigate(['/manager-login']);
      }
    });

    // Charger les projets depuis la base de données
    this.loadProjectsFromDatabase();
    
    // Charger les tâches depuis la base de données
    this.loadTasksFromDatabase();
    
    // Charger les utilisateurs depuis la base de données
    this.loadUsersFromDatabase();
    
    // Charger les réunions depuis la base de données
    this.loadMeetingsFromDatabase();
    
    // Les données seront chargées depuis la base de données via les méthodes appelées ci-dessus
  }

  loadProjectsFromDatabase() {
    console.log('Début du chargement des projets depuis la base...');
    console.log('Manager connecté:', this.currentManager);
    
    if (!this.currentManager) {
      console.error('Aucun manager connecté pour charger les projets');
      return;
    }

    this.managerAuthService.getManagerProjects().subscribe({
      next: (response: any) => {
        console.log('Réponse complète du backend:', response);
        const projects = response.data || response; // Gérer les deux formats possibles
        console.log('Projets chargés depuis la base:', projects);
        console.log('Nombre de projets:', projects.length);
        
        // Transformer les projets pour l'affichage
        this.recentProjects = projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: project.description || '',
          progress: project.progress,
          team: this.getTeamSize(project.team),
          deadline: project.deadline,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          budget: project.budget,
          priority: project.priority
        }));
        
        // Mettre à jour les statistiques
        this.globalStats.activeProjects = this.recentProjects.length;
        
        console.log('Projets transformés pour affichage:', this.recentProjects);
        console.log('Statistiques mises à jour:', this.globalStats.activeProjects);
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des projets:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        console.error('Error body:', error.error);
        
        // En cas d'erreur, garder les données locales
        console.log('Fallback: utilisation des données locales');
        console.log('Projets locaux actuels:', this.recentProjects.length);
      }
    });
  }

  loadTasksFromDatabase() {
    console.log('Début du chargement des tâches depuis la base...');
    
    if (!this.currentManager) {
      console.error('Aucun manager connecté pour charger les tâches');
      return;
    }

    // Initialiser le tableau des tâches
    this.tasks = [];

    // Charger les tâches par statut pour le Kanban
    this.loadTasksByStatus('todo');
    this.loadTasksByStatus('in_progress');
    this.loadTasksByStatus('done');
    
    // Appeler calculateStats après un délai pour laisser le temps aux chargements asynchrones
    setTimeout(() => {
      console.log('Recalcul des statistiques après chargement des tâches...');
      this.calculateStats();
    }, 1000);
  }

  loadUsersFromDatabase() {
    console.log('Début du chargement des utilisateurs depuis la base...');
    
    if (!this.currentManager) {
      console.error('Aucun manager connecté pour charger les utilisateurs');
      return;
    }

    this.managerAuthService.getAllUsers().subscribe({
      next: (response: any) => {
        const users = response.data || response;
        console.log('Utilisateurs chargés depuis la base:', users);
        
        // Transformer les utilisateurs pour l'affichage
        this.allUsers = users.map((user: any) => ({
          id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          role: user.role,
          telephone: user.telephone,
          avatarColor: this.getAvatarColor(user.id),
          status: user.status || 'active',
          date_creation: user.date_creation || user.created_at,
          last_login: user.last_login,
          name: `${user.prenom} ${user.nom}`,
          initials: `${user.prenom[0]}${user.nom[0]}`,
          phone: user.telephone,
          createdAt: user.date_creation || user.created_at,
          active: (user.status || 'active') === 'active',
          completedTasks: Math.floor(Math.random() * 10),
          ongoingTasks: Math.floor(Math.random() * 5)
        }));
        
        // Mettre à jour les compteurs
        this.managersCount = this.allUsers.filter(u => u.role === 'manager').length;
        this.employeesCount = this.allUsers.filter(u => u.role === 'employee').length;
        this.adminsCount = this.allUsers.filter(u => u.role === 'admin').length;
        
        console.log('Utilisateurs transformés pour affichage:', this.allUsers);
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        // En cas d'erreur, utiliser les données locales
        console.log('Fallback: utilisation des données locales');
      }
    });
  }

  loadMeetingsFromDatabase() {
    console.log('Début du chargement des réunions depuis la base...');
    
    if (!this.currentManager) {
      console.error('Aucun manager connecté pour charger les réunions');
      return;
    }

    this.managerAuthService.getMeetings().subscribe({
      next: (response: any) => {
        const meetings = response.data || response;
        console.log('Réunions chargées depuis la base:', meetings);
        
        // Transformer les réunions pour l'affichage
        this.meetings = meetings.map((meeting: any) => ({
          id: meeting.id,
          title: meeting.title,
          date: meeting.date_time,
          duration: meeting.duration,
          location: meeting.location,
          participants: meeting.participants,
          type: meeting.type,
          agenda: meeting.agenda || [],
          status: meeting.status,
          notes: meeting.notes || '',
          color: meeting.type === 'team' ? '#10B981' : meeting.type === 'client' ? '#3B82F6' : meeting.type === 'technical' ? '#F59E0B' : '#8B5CF6'
        }));
        
        // Mettre à jour les réunions à venir
        this.upcomingMeetings = this.meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled');
        
        console.log('Réunions transformées pour affichage:', this.meetings);
        console.log('Réunions à venir:', this.upcomingMeetings);
        
        // Synchroniser le calendrier après le chargement
        this.syncCalendarWithMeetings();
        console.log('Calendrier synchronisé après chargement des réunions');
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des réunions:', error);
        console.log('Fallback: utilisation des données locales');
        // Conserver les données mockées en cas d'erreur
      }
    });
  }

  getProjectStatusLabel(status: string): string {
    const labels = {
      'active': 'Actif',
      'completed': 'Terminé',
      'paused': 'En pause',
      'cancelled': 'Annulé'
    };
    return labels[status as keyof typeof labels] || status;
  }

  loadTasksByStatus(status: string) {
    this.managerAuthService.getTasksByStatus(status).subscribe({
      next: (response: any) => {
        const tasks = response.data || response;
        console.log(`Tâches ${status} chargées:`, tasks);
        
        if (tasks.length === 0) {
          console.log(`Aucune tâche ${status} trouvée dans la base de données`);
          // Laisser le tableau vide - pas de données mockées
          console.log(`Tableau ${status} laissé vide`);
          return;
        }
        
        // Transformer les tâches pour l'affichage
        const transformedTasks = tasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          assignee: 'Non assigné',
          assigneeInitials: 'NA',
          avatarColor: this.getAvatarColor(task.id),
          dueDate: task.due_date || new Date().toISOString().split('T')[0],
          progress: task.progress || 0,
          tags: task.tags ? JSON.parse(task.tags) : [],
          submittedAt: task.created_at || new Date().toISOString()
        }));
        
        // Mettre à jour le tableau de tâches principal
        if (!this.tasks) {
          this.tasks = [];
        }
        
        // Ajouter les nouvelles tâches ou mettre à jour les existantes
        transformedTasks.forEach((newTask: Task) => {
          const existingIndex = this.tasks.findIndex(t => t.id === newTask.id);
          if (existingIndex >= 0) {
            this.tasks[existingIndex] = newTask;
          } else {
            this.tasks.push(newTask);
          }
        });
        
        // Mettre à jour les tableaux spécifiques
        switch(status) {
          case 'todo':
            this.todoTasks = transformedTasks;
            break;
          case 'in_progress':
            this.inProgressTasks = transformedTasks;
            break;
          case 'done':
            this.doneTasks = transformedTasks;
            break;
        }
        
        console.log(`Tâches ${status} transformées:`, transformedTasks);
        console.log('Total des tâches après chargement:', this.tasks.length);
      },
      error: (error: any) => {
        console.error(`Erreur lors du chargement des tâches ${status}:`, error);
        // En cas d'erreur, laisser le tableau vide pour ne pas utiliser de données mockées
        console.log(`Aucune tâche ${status} chargée - tableau laissé vide`);
      }
    });
  }
  // La méthode loadMockTasksForStatus a été supprimée pour n'utiliser que des données réelles

  getAvatarColor(userId: number): string {
    const colors = ['purple', 'teal', 'amber', 'rose', 'blue', 'green'];
    return colors[userId % colors.length];
  }

  // Formulaire de création de projet
  newProject = {
    name: '',
    description: '',
    team: '',
    priority: 'medium',
    startDate: '',
    endDate: '',
    budget: 0
  };

  // Données pour le dashboard - initialisées dynamiquement
  globalStats = {
    totalEmployees: 0,
    activeProjects: 0,
    completedTasks: 0,
    pendingApprovals: 0
  };

  recentProjects: DisplayProject[] = [];

  // Les tâches seront chargées depuis la base de données
  baseTasks: Task[] = [];

  // Les tableaux de tâches seront initialisés dynamiquement
  tasks: Task[] = [];
  todoTasks: Task[] = [];
  inProgressTasks: Task[] = [];
  doneTasks: Task[] = [];
  pendingTasks: Task[] = [];

  // Les utilisateurs seront chargés depuis la base de données
  users: any[] = [];
  allUsers: any[] = [];
  managersCount = 0;
  employeesCount = 0;
  adminsCount = 0;

  // Les réunions seront chargées depuis la base de données
  meetings: any[] = [];
  upcomingMeetings: any[] = [];

  // Les documents seront chargés depuis la base de données
  documents: any[] = [];

  constructor(
    private managerAuthService: ManagerAuthService,
    private router: Router
  ) {}

  timesheets = [
    {
      id: 1,
      user: 'Jean Dupont',
      date: '2024-03-23',
      entryTime: '09:00',
      exitTime: '18:00',
      totalHours: 8,
      tasks: [
        { task: 'Développement dashboard', duration: 4 },
        { task: 'Réunion équipe', duration: 1 },
        { task: 'Review code', duration: 1 },
        { task: 'Documentation', duration: 2 }
      ],
      status: 'validated',
      project: 'Dashboard Manager'
    },
    {
      id: 2,
      user: 'Marie Martin',
      date: '2024-03-23',
      entryTime: '08:30',
      exitTime: '17:30',
      totalHours: 9,
      tasks: [
        { task: 'Formation Angular', duration: 3 },
        { task: 'API REST', duration: 3 },
        { task: 'Tests unitaires', duration: 2 },
        { task: 'Déploiement', duration: 1 }
      ],
      status: 'validated',
      project: 'Formation Angular Avancé'
    },
    {
      id: 3,
      user: 'Pierre Bernard',
      date: '2024-03-23',
      entryTime: '09:00',
      exitTime: '19:00',
      totalHours: 10,
      tasks: [
        { task: 'Migration Cloud', duration: 6 },
        { task: 'Tests', duration: 2 },
        { task: 'Documentation', duration: 2 }
      ],
      status: 'validated',
      project: 'Migration Cloud Infrastructure'
    }
  ];

  navItems = [
    { id: 'dashboard',    label: 'Dashboard',    icon: 'bi-speedometer2',   group: 'principal', badge: null },
    { id: 'projets',      label: 'Projets',      icon: 'bi-kanban',         group: 'principal', badge: null },
    { id: 'taches',       label: 'Tâches',       icon: 'bi-check2-square',  group: 'principal', badge: '12' },
    { id: 'gantt',        label: 'Gantt',        icon: 'bi-calendar3-range',group: 'principal', badge: null },
    { id: 'utilisateurs', label: 'Utilisateurs', icon: 'bi-people',         group: 'equipe',    badge: null },
    { id: 'reunions',     label: 'Réunions',     icon: 'bi-camera-video',   group: 'equipe',    badge: '3'  },
    { id: 'recommandations', label: 'Recommandations IA', icon: 'bi-cpu', group: 'equipe', badge: null },
    { id: 'simulateur',    label: 'Simulateur Projets', icon: 'bi-diagram-3', group: 'equipe', badge: null },
    { id: 'documents',  label: 'Documents',  icon: 'bi-folder2-open',   group: 'ressources',badge: null },
  ];

  topbarTitles: Record<SectionId, { title: string; sub: string }> = {
    dashboard:    { title: 'Dashboard',      sub: 'Vue d\'ensemble' },
    projets:      { title: 'Projets',        sub: 'Gestion des projets' },
    taches:       { title: 'Tâches',         sub: 'Kanban — To Do / In Progress / Done' },
    gantt:        { title: 'Gantt',          sub: 'Planification des projets' },
    utilisateurs: { title: 'Utilisateurs',   sub: 'Gestion des rôles & permissions' },
    reunions:     { title: 'Réunions',       sub: 'Planification & notes' },
    recommandations: { title: 'Recommandations IA', sub: 'IA d\'affectation de tâches' },
    simulateur:    { title: 'Simulateur Projets', sub: 'Simulation de projets avec IA' },
    documents:  { title: 'Documents',      sub: 'Gestion des fichiers' },
  };

  get currentTitle() { return this.topbarTitles[this.activeSection]; }
  get principalItems() { return this.navItems.filter(n => n.group === 'principal'); }
  get equipeItems()    { return this.navItems.filter(n => n.group === 'equipe'); }
  get ressourcesItems(){ return this.navItems.filter(n => n.group === 'ressources'); }

  navigate(id: string) { this.activeSection = id as SectionId; }

  @HostListener('window:scroll', [])
  onScroll() { this.isScrolled = window.scrollY > 40; }

  // Helper method for event propagation
  stopPropagation(event: Event) {
    event.stopPropagation();
  }

  goToGantt() {
    // Naviguer vers la page Gantt
    window.location.href = '/gantt';
  }

  getAverageProgress(): number {
    if (this.recentProjects.length === 0) return 0;
    
    const totalProgress = this.recentProjects.reduce((sum, project) => sum + (project.progress || 0), 0);
    return Math.round(totalProgress / this.recentProjects.length);
  }

  // Méthodes pour le dashboard
  getStatusColor(status: string): string {
    const colors = {
      'active': '#10B981',
      'completed': '#3B82F6',
      'pending': '#F59E0B'
    };
    return colors[status as keyof typeof colors] || '#6B7280';
  }

  getPriorityColor(priority: string): string {
    const colors = {
      'low': '#10B981',
      'medium': '#F59E0B',
      'high': '#EF4444'
    };
    return colors[priority as keyof typeof colors] || '#6B7280';
  }

  getTeamSize(teamName: string): number {
    switch(teamName) {
      case 'Équipe A': return 8;
      case 'Équipe B': return 12;
      case 'Équipe C': return 6;
      default: return 5;
    }
  }

  getStatusLabel(status: string): string {
    const labels = {
      'active': 'Actif',
      'completed': 'Terminé',
      'paused': 'En pause',
      'cancelled': 'Annulé'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getPriorityLabel(priority: string): string {
    const labels = {
      'low': 'Basse',
      'medium': 'Moyenne',
      'high': 'Haute'
    };
    return labels[priority as keyof typeof labels] || priority;
  }

  getRoleIcon(role: string): string {
    const icons = {
      'manager': 'bi-person-badge',
      'admin': 'bi-shield-check',
      'employee': 'bi-person'
    };
    return icons[role as keyof typeof icons] || 'bi-person';
  }

  getDocumentIcon(type: string): string {
    const icons = {
      'pdf': 'bi-file-pdf',
      'docx': 'bi-file-word',
      'xlsx': 'bi-file-excel',
      'pptx': 'bi-file-ppt',
      'markdown': 'bi-file-code',
      'txt': 'bi-file-text'
    };
    return icons[type as keyof typeof icons] || 'bi-file';
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 80) return '#10B981';
    if (efficiency >= 60) return '#F59E0B';
    return '#EF4444';
  }

  approveTask(taskId: number) {
    console.log('Approuver tâche:', taskId);
    
    this.managerAuthService.approveTask(taskId).subscribe({
      next: (response: any) => {
        console.log('Tâche approuvée:', response);
        alert('Tâche approuvée avec succès');
        // Recharger les tâches
        this.loadTasksFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de l\'approbation de la tâche:', error);
        alert('Erreur lors de l\'approbation de la tâche');
      }
    });
  }

  rejectTask(taskId: number) {
    console.log('Rejeter tâche:', taskId);
    
    this.managerAuthService.rejectTask(taskId).subscribe({
      next: (response: any) => {
        console.log('Tâche rejetée:', response);
        alert('Tâche rejetée avec succès');
        // Recharger les tâches
        this.loadTasksFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors du rejet de la tâche:', error);
        alert('Erreur lors du rejet de la tâche');
      }
    });
  }

  // Méthodes pour le drag and drop
  draggedTask: any = null;
  draggedOverColumn: string = '';

  onDragStart(task: any, event: DragEvent) {
    this.draggedTask = task;
    event.dataTransfer!.effectAllowed = 'move';
    console.log('Drag started for task:', task.title);
  }

  onDragEnd(event: DragEvent) {
    this.draggedTask = null;
    this.draggedOverColumn = '';
    console.log('Drag ended');
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDragEnter(event: DragEvent) {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent) {
    // Gérer le visuel si nécessaire
  }

  onDrop(event: DragEvent, targetStatus: string) {
    event.preventDefault();
    
    if (!this.draggedTask) {
      return;
    }

    console.log('Dropping task:', this.draggedTask.title, 'to column:', targetStatus);

    // Si on déplace vers la même colonne, ne rien faire
    if (this.draggedTask.status === targetStatus) {
      return;
    }

    // Mettre à jour le statut de la tâche
    this.updateTaskStatus(this.draggedTask.id, targetStatus);
  }

  // Formulaire d'édition de tâche
  taskToEdit: any = {};
  showEditTaskModal = false;

  editTask(task: any) {
    console.log('Modification de la tâche:', task);
    this.taskToEdit = { ...task };
    this.showEditTaskModal = true;
  }

  closeEditTaskModal() {
    this.showEditTaskModal = false;
    this.taskToEdit = {};
  }

  submitTaskEdit() {
    if (!this.taskToEdit.title) {
      alert('Le titre de la tâche est obligatoire');
      return;
    }

    // Convertir la date au format YYYY-MM-DD pour MySQL
    let formattedDueDate = this.taskToEdit.due_date;
    if (formattedDueDate && formattedDueDate.includes('/')) {
      const dateParts = formattedDueDate.split('/');
      if (dateParts.length === 3) {
        formattedDueDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      }
    }

    const taskData = {
      title: this.taskToEdit.title,
      description: this.taskToEdit.description || null,
      priority: this.taskToEdit.priority || 'medium',
      assignee_id: this.taskToEdit.assignee_id || null,
      project_id: this.taskToEdit.project_id || null,
      due_date: formattedDueDate || null,
      estimated_hours: this.taskToEdit.estimated_hours || null,
      tags: this.taskToEdit.tags && this.taskToEdit.tags.length > 0 ? JSON.stringify(this.taskToEdit.tags) : null
    };

    console.log('Mise à jour de la tâche:', taskData);
    
    this.managerAuthService.updateTask(this.taskToEdit.id, taskData).subscribe({
      next: (response: any) => {
        console.log('Tâche mise à jour:', response);
        alert('Tâche mise à jour avec succès');
        this.closeEditTaskModal();
        // Recharger les tâches
        this.loadTasksFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour de la tâche:', error);
        alert('Erreur lors de la mise à jour de la tâche');
      }
    });
  }

  // Méthodes pour la gestion des tâches
  createTask(taskData: any) {
    console.log('Création de la tâche:', taskData);
    
    this.managerAuthService.createTask(taskData).subscribe({
      next: (response: any) => {
        console.log('Tâche créée:', response);
        alert('Tâche créée avec succès');
        // Recharger les tâches
        this.loadTasksFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de la création de la tâche:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        
        // Gérer les erreurs spécifiques
        if (error.status === 400) {
          alert('Erreur: Données invalides. Vérifiez les champs obligatoires.');
        } else if (error.status === 401) {
          alert('Erreur: Vous n\'êtes pas autorisé à créer cette tâche.');
        } else if (error.status === 500) {
          alert('Erreur: Problème serveur. Veuillez réessayer plus tard.');
        } else {
          alert('Erreur lors de la création de la tâche: ' + (error.message || 'Erreur inconnue'));
        }
      }
    });
  }

  updateTaskStatus(taskId: number, newStatus: string) {
    console.log('Mise à jour du statut de la tâche:', taskId, newStatus);
    console.log('Tâche complète:', this.draggedTask);
    
    // Vérifier si la tâche a les propriétés nécessaires
    if (!this.draggedTask || !this.draggedTask.id) {
      console.error('Tâche invalide ou ID manquant:', this.draggedTask);
      alert('Erreur: Tâche invalide');
      return;
    }
    
    this.managerAuthService.updateTaskStatus(this.draggedTask.id, newStatus).subscribe({
      next: (response: any) => {
        console.log('Statut de la tâche mis à jour:', response);
        // Recharger les tâches
        this.loadTasksFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        
        // Gérer les erreurs spécifiques
        if (error.status === 400) {
          alert('Erreur: Données invalides pour la mise à jour du statut.');
        } else if (error.status === 401) {
          alert('Erreur: Vous n\'êtes pas autorisé à modifier cette tâche.');
        } else if (error.status === 404) {
          alert('Erreur: Tâche non trouvée.');
        } else if (error.status === 500) {
          alert('Erreur: Problème serveur. Veuillez réessayer plus tard.');
        } else {
          alert('Erreur lors de la mise à jour du statut: ' + (error.message || 'Erreur inconnue'));
        }
      }
    });
  }

  deleteTask(taskId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      console.log('Suppression de la tâche:', taskId);
      
      this.managerAuthService.deleteTask(taskId).subscribe({
        next: (response: any) => {
          console.log('Tâche supprimée:', response);
          alert('Tâche supprimée avec succès');
          // Recharger les tâches
          this.loadTasksFromDatabase();
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression de la tâche:', error);
          alert('Erreur lors de la suppression de la tâche');
        }
      });
    }
  }

  // Formulaire de création de tâche
  newTask = {
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: null,
    project_id: null,
    due_date: '',
    estimated_hours: 0,
    tags: []
  };

  // Formulaire de création d'utilisateur
  newUser = {
    nom: '',
    prenom: '',
    email: '',
    password: '',
    role: '',
    telephone: ''
  };

  // Formulaire d'édition d'utilisateur
  userToEdit: any = {};

  showCreateTaskModal = false;

  openCreateTaskModal() {
    this.showCreateTaskModal = true;
  }

  closeCreateTaskModal() {
    this.showCreateTaskModal = false;
    this.resetTaskForm();
  }

  // Méthodes pour le modal de création d'utilisateur
  openCreateUserModal() {
    this.showCreateUserModal = true;
  }

  closeCreateUserModal() {
    this.showCreateUserModal = false;
    this.resetUserForm();
  }

  resetUserForm() {
    this.newUser = {
      nom: '',
      prenom: '',
      email: '',
      password: '',
      role: '',
      telephone: ''
    };
  }

  submitUser() {
    if (!this.newUser.nom || !this.newUser.prenom || !this.newUser.email || !this.newUser.password || !this.newUser.role) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    console.log('Création de l\'utilisateur:', this.newUser);
    
    this.managerAuthService.createUser(this.newUser).subscribe({
      next: (response: any) => {
        console.log('Utilisateur créé:', response);
        alert('Utilisateur créé avec succès');
        this.closeCreateUserModal();
        // Recharger la liste des utilisateurs
        this.loadUsersFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        
        // Gérer les erreurs spécifiques
        if (error.status === 400) {
          alert('Erreur: Données invalides. Vérifiez les champs obligatoires.');
        } else if (error.status === 401) {
          alert('Erreur: Vous n\'êtes pas autorisé à créer des utilisateurs.');
        } else if (error.status === 409) {
          alert('Erreur: Cet email est déjà utilisé.');
        } else if (error.status === 500) {
          alert('Erreur: Problème serveur. Veuillez réessayer plus tard.');
        } else {
          alert('Erreur lors de la création de l\'utilisateur: ' + (error.message || 'Erreur inconnue'));
        }
      }
    });
  }

  // Méthodes pour l'édition d'utilisateur
  editUser(user: any) {
    console.log('Modification de l\'utilisateur:', user);
    this.userToEdit = { ...user };
    this.showEditUserModal = true;
  }

  closeEditUserModal() {
    this.showEditUserModal = false;
    this.userToEdit = {};
  }

  submitUserEdit() {
    if (!this.userToEdit.nom || !this.userToEdit.prenom || !this.userToEdit.email || !this.userToEdit.role) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    console.log('Mise à jour de l\'utilisateur:', this.userToEdit);
    
    this.managerAuthService.updateUser(this.userToEdit.id, this.userToEdit).subscribe({
      next: (response: any) => {
        console.log('Utilisateur mis à jour:', response);
        alert('Utilisateur mis à jour avec succès');
        this.closeEditUserModal();
        // Recharger la liste des utilisateurs
        this.loadUsersFromDatabase();
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        
        // Gérer les erreurs spécifiques
        if (error.status === 400) {
          alert('Erreur: Données invalides. Vérifiez les champs obligatoires.');
        } else if (error.status === 401) {
          alert('Erreur: Vous n\'êtes pas autorisé à modifier cet utilisateur.');
        } else if (error.status === 404) {
          alert('Erreur: Utilisateur non trouvé.');
        } else if (error.status === 409) {
          alert('Erreur: Cet email est déjà utilisé.');
        } else if (error.status === 500) {
          alert('Erreur: Problème serveur. Veuillez réessayer plus tard.');
        } else {
          alert('Erreur lors de la mise à jour de l\'utilisateur: ' + (error.message || 'Erreur inconnue'));
        }
      }
    });
  }

  // Méthode pour la suppression d'utilisateur
  deleteUser(userId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
      console.log('Suppression de l\'utilisateur:', userId);
      
      this.managerAuthService.deleteUser(userId).subscribe({
        next: (response: any) => {
          console.log('Utilisateur supprimé:', response);
          alert('Utilisateur supprimé avec succès');
          // Recharger la liste des utilisateurs
          this.loadUsersFromDatabase();
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression de l\'utilisateur:', error);
          console.error('Status:', error.status);
          console.error('Message:', error.message);
          
          // Gérer les erreurs spécifiques
          if (error.status === 401) {
            alert('Erreur: Vous n\'êtes pas autorisé à supprimer cet utilisateur.');
          } else if (error.status === 404) {
            alert('Erreur: Utilisateur non trouvé.');
          } else if (error.status === 500) {
            alert('Erreur: Problème serveur. Veuillez réessayer plus tard.');
          } else {
            alert('Erreur lors de la suppression de l\'utilisateur: ' + (error.message || 'Erreur inconnue'));
          }
        }
      });
    }
  }

  resetTaskForm() {
    this.newTask = {
      title: '',
      description: '',
      priority: 'medium',
      assignee_id: null,
      project_id: null,
      due_date: '',
      estimated_hours: 0,
      tags: []
    };
  }

  submitTask() {
    if (!this.newTask.title) {
      alert('Le titre de la tâche est obligatoire');
      return;
    }

    const taskData = {
      ...this.newTask,
      creator_id: this.currentManager?.id, // Ajouter le creator_id
      assignee_id: this.newTask.assignee_id || null,
      project_id: this.newTask.project_id || null,
      due_date: this.newTask.due_date || null,
      estimated_hours: this.newTask.estimated_hours || null,
      tags: this.newTask.tags.length > 0 ? JSON.stringify(this.newTask.tags) : null
    };

    console.log('Données de la tâche à créer:', taskData);
    this.createTask(taskData);
    this.closeCreateTaskModal();
  }

  // Propriétés pour les statistiques
  totalHours = 0;
  avgHoursPerDay = 0;
  workedDays = 0;
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  calendarDays: CalendarDay[] = [];
  
  // Propriétés pour la performance d'équipe
  teamPerformance: any[] = [];

  // Méthodes pour calculer les statistiques
  calculateStats() {
    console.log('=== CALCUL DES STATISTIQUES RÉELLES ===');
    
    // Statistiques des utilisateurs
    this.globalStats.totalEmployees = this.allUsers.length;
    console.log('Total employés:', this.globalStats.totalEmployees);
    
    // Statistiques des projets
    this.globalStats.activeProjects = this.recentProjects.filter(p => p.status === 'active').length;
    console.log('Projets actifs:', this.globalStats.activeProjects);
    
    // Statistiques des tâches
    const completedTasks = this.tasks.filter(t => t.status === 'done').length;
    const totalTasks = this.tasks.length;
    this.globalStats.completedTasks = completedTasks;
    console.log('Tâches complétées:', completedTasks, '/', totalTasks);
    
    // Définir les tâches en attente (todo et in_progress)
    this.pendingTasks = this.tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
    this.todoTasks = this.tasks.filter(t => t.status === 'todo');
    this.inProgressTasks = this.tasks.filter(t => t.status === 'in_progress');
    
    // Conserver les doneTasks existants (structure différente)
    // this.doneTasks reste inchangé
    
    console.log('Tâches en attente:', this.pendingTasks.length);
    console.log('Tâches à faire:', this.todoTasks.length);
    console.log('Tâches en cours:', this.inProgressTasks.length);
    console.log('Tâches terminées (doneTasks):', this.doneTasks.length);
    
    // Statistiques des réunions à venir
    const upcomingMeetingsCount = this.meetings.filter(m => 
      m.status === 'upcoming' || m.status === 'scheduled'
    ).length;
    this.globalStats.pendingApprovals = upcomingMeetingsCount;
    console.log('Réunions à venir:', upcomingMeetingsCount);
    
    // Statistiques supplémentaires
    this.managersCount = this.allUsers.filter(u => u.role === 'manager').length;
    this.employeesCount = this.allUsers.filter(u => u.role === 'employee').length;
    this.adminsCount = this.allUsers.filter(u => u.role === 'admin').length;
    
    // Calculer la performance de l'équipe avec des données réelles
    this.teamPerformance = this.allUsers.map(user => {
      const userTasks = this.tasks.filter(task => task.assignee === `${user.prenom} ${user.nom}`);
      const completedTasks = userTasks.filter(task => task.status === 'done').length;
      const ongoingTasks = userTasks.filter(task => task.status === 'in_progress').length;
      const totalTasks = userTasks.length;
      
      // Calculer l'efficacité basée sur les tâches complétées
      const efficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      return {
        id: user.id,
        name: `${user.prenom} ${user.nom}`,
        completedTasks: completedTasks,
        ongoingTasks: ongoingTasks,
        efficiency: efficiency,
        avatarColor: user.avatarColor
      };
    });
    
    console.log('Répartition par rôle:', {
      managers: this.managersCount,
      employees: this.employeesCount,
      admins: this.adminsCount
    });
    
    console.log('Performance de l\'équipe:', this.teamPerformance);
    
    // Synchroniser le calendrier avec les réunions réelles
    this.syncCalendarWithMeetings();
    
    console.log('Statistiques finales:', this.globalStats);
    console.log('=== FIN CALCUL STATISTIQUES ===');
  }

  // Synchroniser le calendrier avec les réunions
  syncCalendarWithMeetings() {
    console.log('=== SYNCHRONISATION CALENDRIER ===');
    console.log('Réunions disponibles:', this.meetings);
    
    const currentYear = this.currentCalendarDate.getFullYear();
    const currentMonth = this.currentCalendarDate.getMonth();
    
    console.log('Mois/année affichés:', currentMonth, currentYear);
    
    // Mettre à jour le titre du calendrier
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    this.calendarMonth = monthNames[currentMonth];
    this.calendarYear = currentYear;
    
    // Obtenir le nombre de jours dans le mois courant
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    console.log('Nombre de jours dans le mois:', daysInMonth);
    
    // Initialiser le calendrier avec les jours du mois
    this.calendarDays = Array.from({length: daysInMonth }, (_, i) => {
      const dayNumber = i + 1;
      const dayDate = new Date(currentYear, currentMonth, dayNumber);
      
      return {
        number: dayNumber,
        isToday: this.isToday(dayDate),
        hasMeeting: false,
        meetings: []
      };
    });
    
    console.log('Jours du calendrier initialisés:', this.calendarDays.length);
    
    // Ajouter les réunions au calendrier
    this.meetings.forEach(meeting => {
      console.log('Traitement de la réunion:', meeting.title, meeting.date);
      
      const meetingDate = new Date(meeting.date);
      console.log('Date de la réunion:', meetingDate, 'Mois:', meetingDate.getMonth(), 'Année:', meetingDate.getFullYear());
      
      // Vérifier si la réunion est dans le mois affiché
      if (meetingDate.getMonth() === currentMonth && 
          meetingDate.getFullYear() === currentYear) {
        
        const dayNumber = meetingDate.getDate();
        const calendarDay = this.calendarDays.find(day => day.number === dayNumber);
        
        console.log('Jour trouvé pour le', dayNumber, ':', calendarDay ? 'OUI' : 'NON');
        
        if (calendarDay) {
          calendarDay.hasMeeting = true;
          calendarDay.meetings.push({
            color: meeting.color || this.getMeetingTypeColor(meeting.type),
            title: meeting.title,
            time: meetingDate.toLocaleTimeString('fr-FR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          });
          console.log('Réunion ajoutée au calendrier:', meeting.title, 'le jour', dayNumber);
        }
      } else {
        console.log('Réunion hors du mois affiché');
      }
    });
    
    // Trier les réunions par heure pour chaque jour
    this.calendarDays.forEach(day => {
      day.meetings.sort((a, b) => {
        const timeA = parseInt(a.time.replace(':', ''));
        const timeB = parseInt(b.time.replace(':', ''));
        return timeA - timeB;
      });
    });
    
    console.log('Jours avec réunions:', this.calendarDays.filter(day => day.hasMeeting).length);
    console.log('=== FIN SYNCHRONISATION ===');
  }

  // Vérifier si une date est aujourd'hui
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  // Navigation dans le calendrier
  previousMonth() {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() - 1,
      1
    );
    this.syncCalendarWithMeetings();
  }

  nextMonth() {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() + 1,
      1
    );
    this.syncCalendarWithMeetings();
  }

  // Revenir au mois actuel
  goToCurrentMonth() {
    this.currentCalendarDate = new Date();
    this.syncCalendarWithMeetings();
  }

  // Obtenir le texte du tooltip pour un jour avec réunions
  getDayMeetingsTooltip(day: CalendarDay): string {
    if (!day.meetings || day.meetings.length === 0) {
      return '';
    }
    
    const meetingList = day.meetings
      .map(meeting => `• ${meeting.time} - ${meeting.title}`)
      .join('\n');
    
    return `${day.meetings.length} réunion(s) ce jour:\n${meetingList}`;
  }

  // Afficher les réunions du jour
  showDayMeetingsModalFunc(day: CalendarDay) {
    this.selectedDay = day;
    this.selectedDayMeetings = day.meetings.map(meeting => {
      // Trouver la réunion complète correspondante
      const fullMeeting = this.meetings.find(m => 
        m.title === meeting.title && 
        new Date(m.date).getDate() === day.number
      );
      return fullMeeting || meeting;
    });
    this.showDayMeetingsModal = true;
  }

  // Fermer le modal des réunions du jour
  closeDayMeetingsModal() {
    this.showDayMeetingsModal = false;
    this.selectedDay = null;
    this.selectedDayMeetings = [];
  }

  // Ouvrir le modal de création pour un jour spécifique
  openCreateMeetingModalForDay() {
    if (this.selectedDay) {
      // Pré-remplir la date avec le jour sélectionné
      const dayDate = new Date(
        this.currentCalendarDate.getFullYear(),
        this.currentCalendarDate.getMonth(),
        this.selectedDay.number,
        9, // 9h par défaut
        0
      );
      
      this.newMeeting.date = dayDate.toISOString().slice(0, 16); // Format YYYY-MM-DDTHH:MM
    }
    this.closeDayMeetingsModal();
    this.openCreateMeetingModal();
  }

  // Voir une réunion depuis le modal du jour
  viewMeetingFromDay(meeting: any) {
    this.closeDayMeetingsModal();
    this.viewMeeting(meeting);
  }

  // Modifier une réunion depuis le modal du jour
  editMeetingFromDay(meeting: any) {
    this.closeDayMeetingsModal();
    this.editMeeting(meeting);
  }

  // Gestion de la sélection des tâches
  selectedTaskIds: number[] = [];

  toggleTaskSelection(taskId: number) {
    const index = this.selectedTaskIds.indexOf(taskId);
    if (index > -1) {
      this.selectedTaskIds.splice(index, 1);
    } else {
      this.selectedTaskIds.push(taskId);
    }
    console.log('Tâches sélectionnées:', this.selectedTaskIds);
  }

  // Voir les détails d'une tâche
  viewTaskDetails(task: Task) {
    console.log('Voir les détails de la tâche:', task);
    // TODO: Ouvrir un modal avec les détails de la tâche
    alert(`Détails de la tâche: ${task.title}\nDescription: ${task.description}\nPriorité: ${task.priority}\nAssigné à: ${task.assignee}`);
  }

  // Approuver plusieurs tâches sélectionnées
  approveSelectedTasks() {
    if (this.selectedTaskIds.length === 0) {
      alert('Veuillez sélectionner au moins une tâche');
      return;
    }
    
    if (confirm(`Approuver ${this.selectedTaskIds.length} tâche(s) sélectionnée(s)?`)) {
      this.selectedTaskIds.forEach(taskId => {
        this.approveTask(taskId);
      });
      this.selectedTaskIds = [];
    }
  }

  // Rejeter plusieurs tâches sélectionnées
  rejectSelectedTasks() {
    if (this.selectedTaskIds.length === 0) {
      alert('Veuillez sélectionner au moins une tâche');
      return;
    }
    
    if (confirm(`Rejeter ${this.selectedTaskIds.length} tâche(s) sélectionnée(s)?`)) {
      this.selectedTaskIds.forEach(taskId => {
        this.rejectTask(taskId);
      });
      this.selectedTaskIds = [];
    }
  }

  // Méthodes pour la création de projet
  openCreateProjectModal() {
    this.showCreateProjectModal = true;
  }

  closeCreateProjectModal() {
    this.showCreateProjectModal = false;
    this.resetProjectForm();
  }

  resetProjectForm() {
    this.newProject = {
      name: '',
      description: '',
      team: '',
      priority: 'medium',
      startDate: '',
      endDate: '',
      budget: 0
    };
  }

  testClick() {
    alert('Test click fonctionne !');
  }

  createProject() {
    alert('Bouton cliqué !');
    console.log('createProject appelé');
    console.log('newProject:', this.newProject);
    console.log('loading:', this.loading);
    
    if (!this.newProject.name || !this.newProject.team) {
      alert('Champs obligatoires manquants: name=' + this.newProject.name + ', team=' + this.newProject.team);
      return;
    }

    alert('Validation OK, tentative de création...');
    this.loading = true;

    // Appeler le backend pour créer le projet
    this.managerAuthService.createProject({
      name: this.newProject.name,
      description: this.newProject.description,
      team: this.newProject.team,
      priority: this.newProject.priority,
      startDate: this.newProject.startDate,
      endDate: this.newProject.endDate,
      budget: this.newProject.budget
    }).subscribe({
      next: (createdProject: any) => {
        console.log('Projet créé dans la base:', createdProject);
        
        // Ajouter le projet à la liste locale (pour l'affichage immédiat)
        const displayProject = {
          id: createdProject.data.id ? createdProject.data.id : this.recentProjects.length + 1,
          name: createdProject.data.name,
          description: createdProject.data.description || '',
          progress: createdProject.data.progress || 0,
          team: this.getTeamSize(createdProject.data.team),
          priority: createdProject.data.priority,
          startDate: createdProject.data.startDate || null,
          endDate: createdProject.data.endDate || null,
          budget: createdProject.data.budget,
          deadline: createdProject.data.deadline || null,
          status: createdProject.data.status
        };
        this.recentProjects.unshift(displayProject);

        // Mettre à jour les statistiques
        this.globalStats.activeProjects++;

        // Fermer le modal et réinitialiser le formulaire
        this.closeCreateProjectModal();
        this.loading = false;
        
        alert('Projet créé avec succès dans la base de données !');
      },
      error: (error: any) => {
        console.error('Erreur lors de la création du projet:', error);
        this.loading = false;
        
        // En cas d'erreur backend, fallback sur la création locale
        console.log('Fallback: création locale du projet');
        this.createProjectLocally();
      }
    });
  }

  // Méthode de fallback pour création locale
  createProjectLocally() {
    const newProject = {
      id: this.recentProjects.length + 1,
      name: this.newProject.name,
      description: this.newProject.description,
      progress: 0,
      team: this.getTeamSize(this.newProject.team),
      priority: this.newProject.priority,
      startDate: this.newProject.startDate,
      endDate: this.newProject.endDate,
      budget: this.newProject.budget,
      deadline: this.newProject.endDate || 'À définir',
      status: 'active'
    };

    this.recentProjects.unshift(newProject);
    this.globalStats.activeProjects++;
    this.closeCreateProjectModal();
    
    console.log('Projet créé localement:', newProject);
  }

  // Déconnexion
  logout() {
    this.managerAuthService.logout();
    this.router.navigate(['/manager-login']);
  }

  // Actions sur les projets
  viewProject(project: any) {
    console.log('Voir le projet:', project);
    this.selectedProject = project;
    this.showViewProjectModal = true;
  }

  editProject(project: any) {
    console.log('Modifier le projet:', project);
    this.selectedProject = project;
    this.projectToEdit = {
      name: project.name,
      description: project.description,
      team: project.team,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget
    };
    this.showEditProjectModal = true;
  }

  updateProject() {
    console.log('Mise à jour du projet:', this.projectToEdit);
    
    if (!this.projectToEdit.name || !this.projectToEdit.team) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    this.loading = true;

    // Convertir undefined en null pour MySQL
    const projectData = {
      name: this.projectToEdit.name,
      description: this.projectToEdit.description || null,
      team: this.projectToEdit.team,
      priority: this.projectToEdit.priority || 'medium',
      startDate: this.projectToEdit.startDate || null,
      endDate: this.projectToEdit.endDate || null,
      budget: this.projectToEdit.budget || null,
      deadline: this.projectToEdit.endDate || null,
      status: 'active',
      progress: 0
    };

    // Appeler le backend pour mettre à jour le projet
    this.managerAuthService.updateProject(this.selectedProject.id, projectData).subscribe({
      next: (updatedProject: any) => {
        console.log('Projet mis à jour dans la base:', updatedProject);
        
        // Mettre à jour le projet dans la liste locale
        const index = this.recentProjects.findIndex(p => p.id === this.selectedProject.id);
        if (index !== -1) {
          this.recentProjects[index] = {
            id: updatedProject.id,
            name: updatedProject.name,
            description: updatedProject.description || '',
            progress: updatedProject.progress,
            team: this.getTeamSize(updatedProject.team),
            deadline: updatedProject.deadline,
            status: updatedProject.status,
            startDate: updatedProject.startDate,
            endDate: updatedProject.endDate,
            budget: updatedProject.budget,
            priority: updatedProject.priority
          };
        }
        
        this.loading = false;
        this.closeEditProjectModal();
        
        alert('Projet mis à jour avec succès !');
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour du projet:', error);
        this.loading = false;
        alert('Erreur lors de la mise à jour du projet');
      }
    });
  }

  deleteProject(project: any) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le projet "${project.name}" ?`)) {
      console.log('Supprimer le projet:', project);
      // TODO: Implémenter la suppression
      alert(`Suppression du projet: ${project.name}\n\nFonctionnalité à implémenter`);
    }
  }

  // Méthodes pour les modaux
  closeViewProjectModal() {
    this.showViewProjectModal = false;
    this.selectedProject = null;
  }

  closeEditProjectModal() {
    this.showEditProjectModal = false;
    this.selectedProject = null;
    this.projectToEdit = {
      name: '',
      description: '',
      team: '',
      priority: 'medium',
      startDate: '',
      endDate: '',
      budget: 0
    };
  }

  // Méthodes pour la gestion des réunions
  openCreateMeetingModal() {
    this.showCreateMeetingModal = true;
  }

  closeCreateMeetingModal() {
    this.showCreateMeetingModal = false;
    this.resetMeetingForm();
  }

  openViewMeetingModal() {
    this.showViewMeetingModal = true;
  }

  closeViewMeetingModal() {
    this.showViewMeetingModal = false;
    this.selectedMeeting = null;
  }

  openEditMeetingModal() {
    this.showEditMeetingModal = true;
  }

  closeEditMeetingModal() {
    this.showEditMeetingModal = false;
    this.resetMeetingForm();
  }

  createMeeting() {
    if (!this.newMeeting.title || !this.newMeeting.date) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    this.loading = true;
    
    const meetingData = {
      title: this.newMeeting.title,
      description: this.newMeeting.title, // Utiliser le titre comme description par défaut
      date_time: new Date(this.newMeeting.date).toISOString(),
      duration: this.newMeeting.duration,
      location: this.newMeeting.location,
      type: this.newMeeting.type,
      status: 'upcoming' as const,
      participants: this.newMeeting.participants || 1,
      agenda: this.newMeeting.agenda || [],
      notes: this.newMeeting.notes || '',
      selectedEmployees: this.newMeeting.selectedEmployees || []
    };

    // Créer la réunion via l'API
    this.managerAuthService.createMeeting(meetingData).subscribe({
      next: (response: any) => {
        console.log('Réunion créée avec succès:', response);
        
        // Ajouter la réunion à la liste locale
        const newMeeting = {
          id: response.data?.id || response.id,
          ...meetingData,
          date: meetingData.date_time,
          color: meetingData.type === 'team' ? '#10B981' : meetingData.type === 'client' ? '#3B82F6' : meetingData.type === 'technical' ? '#F59E0B' : '#8B5CF6',
          status: 'upcoming'
        };
        
        this.meetings.push(newMeeting);
        this.upcomingMeetings = this.meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled');
        
        this.loading = false;
        this.closeCreateMeetingModal();
        
        alert('Réunion créée avec succès !');
      },
      error: (error: any) => {
        console.error('Erreur lors de la création de la réunion:', error);
        this.loading = false;
        alert('Erreur lors de la création de la réunion');
      }
    });
  }

  viewMeeting(meeting: any) {
    this.selectedMeeting = meeting;
    this.openViewMeetingModal();
  }

  editMeeting(meeting: any) {
    this.meetingToEdit = { ...meeting };
    this.openEditMeetingModal();
  }

  updateMeeting() {
    if (!this.meetingToEdit.title || !this.meetingToEdit.date) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    this.loading = true;
    
    const meetingData = {
      title: this.meetingToEdit.title,
      description: this.meetingToEdit.title,
      date_time: new Date(this.meetingToEdit.date).toISOString(),
      duration: this.meetingToEdit.duration,
      location: this.meetingToEdit.location,
      type: this.meetingToEdit.type,
      participants: this.meetingToEdit.participants || 1,
      agenda: this.meetingToEdit.agenda || [],
      notes: this.meetingToEdit.notes || ''
    };

    // Mettre à jour la réunion via l'API
    this.managerAuthService.updateMeeting(this.meetingToEdit.id, meetingData).subscribe({
      next: (response: any) => {
        console.log('Réunion mise à jour avec succès:', response);
        
        // Mettre à jour la réunion dans la liste locale
        const index = this.meetings.findIndex(m => m.id === this.meetingToEdit.id);
        if (index !== -1) {
          this.meetings[index] = {
            ...this.meetings[index],
            ...meetingData,
            date: meetingData.date_time,
            color: meetingData.type === 'team' ? '#10B981' : meetingData.type === 'client' ? '#3B82F6' : meetingData.type === 'technical' ? '#F59E0B' : '#8B5CF6'
          };
        }
        
        // Mettre à jour les réunions à venir
        this.upcomingMeetings = this.meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled');
        
        this.loading = false;
        this.closeEditMeetingModal();
        
        alert('Réunion mise à jour avec succès !');
      },
      error: (error: any) => {
        console.error('Erreur lors de la mise à jour de la réunion:', error);
        this.loading = false;
        alert('Erreur lors de la mise à jour de la réunion');
      }
    });
  }

  deleteMeeting(meetingId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette réunion ?')) {
      // Supprimer la réunion via l'API
      this.managerAuthService.deleteMeeting(meetingId).subscribe({
        next: (response: any) => {
          console.log('Réunion supprimée avec succès:', response);
          
          // Supprimer la réunion de la liste locale
          this.meetings = this.meetings.filter(m => m.id !== meetingId);
          this.upcomingMeetings = this.meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled');
          
          alert('Réunion supprimée avec succès !');
        },
        error: (error: any) => {
          console.error('Erreur lors de la suppression de la réunion:', error);
          alert('Erreur lors de la suppression de la réunion');
        }
      });
    }
  }

  getMeetingParticipants(meeting: any): any[] {
    // Générer des participants fictifs pour l'affichage
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    return Array.from({length: meeting.participants || 3}, (_, i) => ({
      name: `Participant ${i + 1}`,
      initials: `P${i + 1}`,
      color: colors[i % colors.length]
    }));
  }

  resetMeetingForm() {
    this.newMeeting = {
      title: '',
      date: '',
      duration: '1h',
      location: 'Salle A',
      type: 'team',
      agenda: [],
      participants: [],
      selectedEmployees: [],
      notes: ''
    };
  }

  getMeetingTypeLabel(type: string): string {
    const labels = {
      'team': 'Équipe',
      'client': 'Client',
      'technical': 'Technique',
      'review': 'Revue'
    };
    return labels[type as keyof typeof labels] || type;
  }

  getMeetingTypeColor(type: string): string {
    const colors = {
      'team': '#10B981',
      'client': '#3B82F6',
      'technical': '#F59E0B',
      'review': '#8B5CF6'
    };
    return colors[type as keyof typeof colors] || '#6B7280';
  }

  // Méthode pour mettre à jour la sélection des employés
  updateSelectedEmployees(employeeId: number, event: any) {
    const isChecked = event.target?.checked || false;
    if (!this.newMeeting.selectedEmployees) {
      this.newMeeting.selectedEmployees = [];
    }
    
    if (isChecked) {
      // Ajouter l'employé s'il n'est pas déjà sélectionné
      if (!this.newMeeting.selectedEmployees.includes(employeeId)) {
        this.newMeeting.selectedEmployees.push(employeeId);
      }
    } else {
      // Retirer l'employé
      const index = this.newMeeting.selectedEmployees.indexOf(employeeId);
      if (index > -1) {
        this.newMeeting.selectedEmployees.splice(index, 1);
      }
    }
    
    console.log('Employés sélectionnés après modification:', this.newMeeting.selectedEmployees);
  }
}

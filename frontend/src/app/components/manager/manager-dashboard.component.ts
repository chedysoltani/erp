import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ManagerAuthService, Manager, Project, Meeting } from '../../services/manager-auth.service';
import { DocumentsService } from '../../services/documents.service';
import { AnalyticsService } from '../../services/analytics.service';
import { TaskEnhancedService } from '../../services/task-enhanced.service';
import { IARecommendationService } from '../../services/ia-recommendation.service';
import { ToastService } from '../../services/toast.service';
import { Document } from '../../models/document.model';

export type SectionId =
  | 'dashboard' | 'projets' | 'taches' | 'gantt' | 'analytics'
  | 'utilisateurs' | 'reunions' | 'recommandations' | 'simulateur' | 'documents' | 'planning' | 'presence';

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
  project_id?: number | null;
  assignee_id?: number | null;
  assignments?: {
    employee_id: number;
    status: string;
    employee_name?: string;
    employee_initials?: string;
  }[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css', './calendar-improvements.css', './tasks-improvements.css', './gantt-preview.css']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeSection: SectionId = 'dashboard';
  isScrolled = false;
  showCreateProjectModal = false;
  showViewProjectModal = false;
  showEditProjectModal = false;
  showCreateUserModal = false;
  showEditUserModal = false;
  selectedProject: any = null;
  projectToEdit: any = {
    name: '', description: '', team: '', priority: 'medium',
    startDate: '', endDate: '', budget: 0
  };

  showCreateMeetingModal = false;
  showViewMeetingModal = false;
  showEditMeetingModal = false;
  showDayMeetingsModal = false;
  selectedMeeting: any = null;
  selectedDay: CalendarDay | null = null;
  selectedDayMeetings: any[] = [];
  meetingToEdit: any = {
    title: '', date: '', duration: '1h', location: 'Salle A',
    type: 'team', agenda: [], participants: [], selectedEmployees: [], notes: ''
  };
  newMeeting: any = {
    title: '', date: '', duration: '1h', location: 'Salle A',
    type: 'team', agenda: [], participants: [], selectedEmployees: [], notes: ''
  };

  showAddDocumentModal = false;
  selectedFile: File | null = null;
  newDocData = { title: '', description: '', employeeId: null as number | null };
  searchTerm = '';

  savedPlannings: any[] = [];
  currentCalendarDate = new Date();
  calendarMonth = '';
  calendarYear = 0;

  currentManager: Manager | null = null;
  loading = false;

  globalStats = {
    totalEmployees: 0,
    activeProjects: 0,
    completedTasks: 0,
    pendingApprovals: 0
  };

  recentProjects: DisplayProject[] = [];
  tasks: Task[] = [];
  todoTasks: Task[] = [];
  inProgressTasks: Task[] = [];
  doneTasks: Task[] = [];
  pendingTasks: Task[] = [];

  users: any[] = [];
  allUsers: any[] = [];
  managersCount = 0;
  employeesCount = 0;
  adminsCount = 0;

  meetings: any[] = [];
  upcomingMeetings: any[] = [];
  documents: Document[] = [];
  analyticsData: any = null;
  selectedProjectForAnalytics: number | null = null;

  totalHours = 0;
  avgHoursPerDay = 0;
  workedDays = 0;
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  calendarDays: CalendarDay[] = [];
  teamPerformance: any[] = [];

  newProject = {
    name: '', description: '', team: '', priority: 'medium',
    startDate: '', endDate: '', budget: 0
  };

  newTask = {
    title: '', description: '', priority: 'medium',
    assignee_id: null as number | null,
    assignee_ids: [] as number[],
    project_id: null,
    due_date: '', estimated_hours: 0, tags: [] as string[]
  };

  newUser = { nom: '', prenom: '', email: '', password: '', role: '', telephone: '' };
  userToEdit: any = {};

  showCreateTaskModal = false;
  taskToEdit: any = {};
  showEditTaskModal = false;
  editAddEmployeeId: number | null = null;
  taskEditDependencies: any[] = [];
  projectTaskDependencies: { task_id: number; depends_on_task_id: number }[] = [];
  editDependsOnTaskId: number | null = null;
  editDependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' = 'finish_to_start';
  readonly dependencyTypeChoices = [
    { value: 'finish_to_start' as const, label: 'Fin → Début (FS)' },
    { value: 'start_to_start' as const, label: 'Début → Début (SS)' },
    { value: 'finish_to_finish' as const, label: 'Fin → Fin (FF)' }
  ];

  draggedTask: any = null;
  draggedOverColumn = '';
  selectedTaskIds: number[] = [];

  navItems = [
    { id: 'dashboard',       label: 'Dashboard',          icon: 'bi-speedometer2',    group: 'principal',   badgeCount: 0 },
    { id: 'projets',         label: 'Projets',            icon: 'bi-kanban',           group: 'principal',   badgeCount: 0 },
    { id: 'taches',          label: 'Tâches',             icon: 'bi-check2-square',    group: 'principal',   badgeCount: 0 },
    { id: 'gantt',           label: 'Gantt',              icon: 'bi-calendar3-range',  group: 'principal',   badgeCount: 0 },
    { id: 'utilisateurs',    label: 'Utilisateurs',       icon: 'bi-people',           group: 'equipe',      badgeCount: 0 },
    { id: 'reunions',        label: 'Réunions',           icon: 'bi-camera-video',     group: 'equipe',      badgeCount: 0 },
    { id: 'recommandations', label: 'Recommandations IA', icon: 'bi-cpu',              group: 'equipe',      badgeCount: 0 },
    { id: 'simulateur',      label: 'Simulateur Projets', icon: 'bi-diagram-3',        group: 'equipe',      badgeCount: 0 },
    { id: 'planning',        label: 'Planning',           icon: 'bi-calendar-event',   group: 'equipe',      badgeCount: 0 },
    { id: 'analytics',       label: 'Analytics',          icon: 'bi-graph-up',         group: 'principal',   badgeCount: 0 },
    { id: 'documents',       label: 'Documents',          icon: 'bi-folder2-open',     group: 'ressources',  badgeCount: 0 },
    { id: 'presence',        label: 'Présence',            icon: 'bi-fingerprint',       group: 'equipe',      badgeCount: 0 },
  ];

  topbarTitles: Record<SectionId, { title: string; sub: string }> = {
    dashboard:       { title: 'Dashboard',            sub: 'Vue d\'ensemble' },
    projets:         { title: 'Projets',              sub: 'Gestion des projets' },
    taches:          { title: 'Tâches',               sub: 'Kanban — To Do / In Progress / Done' },
    gantt:           { title: 'Gantt',                sub: 'Planification des projets' },
    analytics:       { title: 'Analytics',            sub: 'KPIs et statistiques' },
    utilisateurs:    { title: 'Utilisateurs',         sub: 'Gestion des rôles & permissions' },
    reunions:        { title: 'Réunions',             sub: 'Planification & notes' },
    recommandations: { title: 'Recommandations IA',   sub: 'IA d\'affectation de tâches' },
    simulateur:      { title: 'Simulateur Projets',   sub: 'Simulation de projets avec IA' },
    planning:        { title: 'Plannings Sauvegardés',sub: 'Historique des simulations IA' },
    documents:       { title: 'Documents',            sub: 'Gestion des fichiers' },
    presence:        { title: 'Présence & Congés',    sub: 'Pointage équipe, retards, validation' },
  };

  get currentTitle() { return this.topbarTitles[this.activeSection]; }
  get principalItems() { return this.navItems.filter(n => n.group === 'principal'); }
  get equipeItems()    { return this.navItems.filter(n => n.group === 'equipe'); }
  get ressourcesItems(){ return this.navItems.filter(n => n.group === 'ressources'); }

  constructor(
    private managerAuthService: ManagerAuthService,
    public documentsService: DocumentsService,
    private router: Router,
    private analyticsService: AnalyticsService,
    private taskEnhancedService: TaskEnhancedService,
    private iaService: IARecommendationService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.currentManager = this.managerAuthService.currentManagerValue;

    if (!this.currentManager) {
      this.router.navigate(['/manager-login']);
      return;
    }

    this.managerAuthService.currentManager
      .pipe(takeUntil(this.destroy$))
      .subscribe(manager => {
        this.currentManager = manager;
        if (!manager) this.router.navigate(['/manager-login']);
      });

    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAllData(): void {
    forkJoin({
      projects: this.managerAuthService.getManagerProjects(),
      users: this.managerAuthService.getAllUsers(),
      meetings: this.managerAuthService.getMeetings(),
      todoTasks: this.managerAuthService.getTasksByStatus('todo'),
      inProgressTasks: this.managerAuthService.getTasksByStatus('in_progress'),
      doneTasks: this.managerAuthService.getTasksByStatus('done')
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ projects, users, meetings, todoTasks, inProgressTasks, doneTasks }) => {
        this.processProjects(projects);
        this.processUsers(users);
        this.processMeetings(meetings);
        this.processAllTasks(todoTasks, inProgressTasks, doneTasks);
        this.calculateStats();
        this.syncCalendarWithMeetings();
      },
      error: (err) => {
        if (err.status !== 401) {
          this.toast.error('Erreur lors du chargement des données.');
        }
      }
    });

    this.loadDocuments();
    this.loadPlannings();
  }

  private processProjects(response: any): void {
    const projects = response.data || response;
    this.recentProjects = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      progress: p.progress,
      team: p.team,
      deadline: p.deadline,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      budget: p.budget,
      priority: p.priority
    }));
  }

  private processUsers(response: any): void {
    const users = response.data || response;
    this.allUsers = users.map((user: any) => ({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      telephone: user.telephone,
      avatarColor: this.getAvatarColor(user.id),
      status: user.actif !== false ? 'active' : 'inactive',
      date_creation: user.date_creation || user.created_at,
      name: `${user.prenom} ${user.nom}`,
      initials: `${(user.prenom || '')[0]}${(user.nom || '')[0]}`.toUpperCase(),
      phone: user.telephone,
      createdAt: user.date_creation || user.created_at,
      active: user.actif !== false
    }));
    this.managersCount = this.allUsers.filter(u => u.role === 'manager').length;
    this.employeesCount = this.allUsers.filter(u => u.role === 'employee').length;
    this.adminsCount = this.allUsers.filter(u => u.role === 'admin').length;
  }

  private processMeetings(response: any): void {
    const meetings = response.data || response;
    this.meetings = meetings.map((m: any) => ({
      id: m.id,
      title: m.title,
      date: m.date_time,
      duration: m.duration,
      location: m.location,
      participants: m.participants,
      type: m.type,
      agenda: m.agenda || [],
      status: m.status,
      notes: m.notes || '',
      color: this.getMeetingTypeColor(m.type)
    }));
    this.upcomingMeetings = this.meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled');
  }

  private processAllTasks(todoRes: any, inProgressRes: any, doneRes: any): void {
    const mapTasks = (res: any) => {
      const tasks = res.data || res;
      return tasks.map((task: any) => this.transformTask(task));
    };

    this.todoTasks = mapTasks(todoRes);
    this.inProgressTasks = mapTasks(inProgressRes);
    this.doneTasks = mapTasks(doneRes);
    this.tasks = [...this.todoTasks, ...this.inProgressTasks, ...this.doneTasks];
  }

  private transformTask(task: any): Task {
    const assignments = this.parseTaskAssignments(task);
    let assigneeName = 'Non assigné';
    let assigneeInitials = 'NA';
    if (assignments.length > 0) {
      assigneeName = assignments.map((a: any) => a.employee_name || `Employé #${a.employee_id}`).join(', ');
      assigneeInitials = assignments.length === 1
        ? (assignments[0].employee_initials || '?').toString().substring(0, 3)
        : `${assignments.length}`;
    } else if (task.assignee_id) {
      const user = this.allUsers.find((u: any) => u.id === task.assignee_id);
      if (user) {
        assigneeName = `${user.prenom} ${user.nom}`;
        assigneeInitials = `${(user.prenom || '')[0]}${(user.nom || '')[0]}`.toUpperCase();
      }
    }

    let parsedTags: string[] = [];
    try {
      if (task.tags) parsedTags = typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags;
    } catch {}

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      project_id: task.project_id ?? null,
      assignee: assigneeName,
      assignee_id: task.assignee_id,
      assignments,
      assigneeInitials,
      avatarColor: this.getAvatarColor(task.id),
      dueDate: task.due_date || new Date().toISOString().split('T')[0],
      progress: task.progress || 0,
      tags: parsedTags,
      submittedAt: task.created_at || new Date().toISOString()
    };
  }

  loadProjectsFromDatabase(): void {
    if (!this.currentManager) return;
    this.managerAuthService.getManagerProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => this.processProjects(response),
        error: () => this.toast.error('Erreur lors du chargement des projets.')
      });
  }

  loadTasksFromDatabase(): void {
    if (!this.currentManager) return;
    forkJoin({
      todo: this.managerAuthService.getTasksByStatus('todo'),
      inProgress: this.managerAuthService.getTasksByStatus('in_progress'),
      done: this.managerAuthService.getTasksByStatus('done')
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ todo, inProgress, done }) => {
        this.processAllTasks(todo, inProgress, done);
        this.calculateStats();
        this.updateNavBadges();
      },
      error: () => this.toast.error('Erreur lors du chargement des tâches.')
    });
  }

  loadUsersFromDatabase(): void {
    if (!this.currentManager) return;
    this.managerAuthService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => this.processUsers(response),
        error: () => this.toast.error('Erreur lors du chargement des utilisateurs.')
      });
  }

  loadMeetingsFromDatabase(): void {
    if (!this.currentManager) return;
    this.managerAuthService.getMeetings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.processMeetings(response);
          this.syncCalendarWithMeetings();
        },
        error: () => this.toast.error('Erreur lors du chargement des réunions.')
      });
  }

  loadAnalytics(projectId?: number): void {
    if (!this.currentManager) return;
    const obs$ = projectId
      ? this.analyticsService.getProjectAnalytics(projectId)
      : this.analyticsService.getManagerAnalytics(this.currentManager.id);

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => { this.analyticsData = response.data; },
      error: () => this.toast.error('Erreur lors du chargement des analytics.')
    });
  }

  private updateNavBadges(): void {
    const todoCount = this.todoTasks.length;
    const meetingCount = this.upcomingMeetings.length;
    const pendingApprovals = this.tasks.filter(t => t.status === 'done').length;

    this.navItems = this.navItems.map(item => {
      if (item.id === 'taches') return { ...item, badgeCount: todoCount };
      if (item.id === 'reunions') return { ...item, badgeCount: meetingCount };
      if (item.id === 'dashboard') return { ...item, badgeCount: pendingApprovals };
      return item;
    });
  }

  navigate(id: string): void {
    this.activeSection = id as SectionId;
    if (id === 'analytics') this.loadAnalytics();
  }

  getGanttProjectName(): string {
    const project = this.recentProjects.find(p => p.id === this.selectedProjectForAnalytics);
    return project?.name ?? 'Project';
  }

  getAvatarColor(userId: number): string {
    const colors = ['purple', 'teal', 'amber', 'rose', 'blue', 'green'];
    return colors[userId % colors.length];
  }

  getAverageProgress(): number {
    if (this.recentProjects.length === 0) return 0;
    const total = this.recentProjects.reduce((sum, p) => sum + (p.progress || 0), 0);
    return Math.round(total / this.recentProjects.length);
  }

  calculateStats(): void {
    this.globalStats.totalEmployees = this.allUsers.length;
    this.globalStats.activeProjects = this.recentProjects.filter(p => p.status === 'active').length;
    this.globalStats.completedTasks = this.doneTasks.length;
    this.globalStats.pendingApprovals = this.tasks.filter(t => t.status === 'done').length;

    this.pendingTasks = this.tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');

    this.teamPerformance = this.allUsers.map(user => {
      const userTasks = this.tasks.filter(task =>
        task.assignments?.some((a: any) => a.employee_id === user.id) ||
        task.assignee_id === user.id
      );
      const completedCount = userTasks.filter(t => t.status === 'done').length;
      const ongoingCount = userTasks.filter(t => t.status === 'in_progress').length;
      const efficiency = userTasks.length > 0 ? Math.round((completedCount / userTasks.length) * 100) : 0;
      return {
        id: user.id,
        name: `${user.prenom} ${user.nom}`,
        completedTasks: completedCount,
        ongoingTasks: ongoingCount,
        efficiency,
        avatarColor: user.avatarColor
      };
    });

    this.updateNavBadges();
  }

  syncCalendarWithMeetings(): void {
    const currentYear = this.currentCalendarDate.getFullYear();
    const currentMonth = this.currentCalendarDate.getMonth();
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    this.calendarMonth = monthNames[currentMonth];
    this.calendarYear = currentYear;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    this.calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
      const dayDate = new Date(currentYear, currentMonth, i + 1);
      return { number: i + 1, isToday: this.isToday(dayDate), hasMeeting: false, meetings: [] };
    });

    this.meetings.forEach(meeting => {
      const meetingDate = new Date(meeting.date);
      if (meetingDate.getMonth() === currentMonth && meetingDate.getFullYear() === currentYear) {
        const calDay = this.calendarDays.find(d => d.number === meetingDate.getDate());
        if (calDay) {
          calDay.hasMeeting = true;
          calDay.meetings.push({
            color: meeting.color || this.getMeetingTypeColor(meeting.type),
            title: meeting.title,
            time: meetingDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
    });

    this.calendarDays.forEach(d => {
      d.meetings.sort((a, b) => a.time.localeCompare(b.time));
    });
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  previousMonth(): void {
    this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() - 1, 1);
    this.syncCalendarWithMeetings();
  }

  nextMonth(): void {
    this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 1);
    this.syncCalendarWithMeetings();
  }

  goToCurrentMonth(): void {
    this.currentCalendarDate = new Date();
    this.syncCalendarWithMeetings();
  }

  getDayMeetingsTooltip(day: CalendarDay): string {
    if (!day.meetings?.length) return '';
    return `${day.meetings.length} réunion(s):\n` + day.meetings.map(m => `• ${m.time} - ${m.title}`).join('\n');
  }

  showDayMeetingsModalFunc(day: CalendarDay): void {
    this.selectedDay = day;
    this.selectedDayMeetings = day.meetings.map(m =>
      this.meetings.find(fm => fm.title === m.title && new Date(fm.date).getDate() === day.number) || m
    );
    this.showDayMeetingsModal = true;
  }

  closeDayMeetingsModal(): void {
    this.showDayMeetingsModal = false;
    this.selectedDay = null;
    this.selectedDayMeetings = [];
  }

  openCreateMeetingModalForDay(): void {
    if (this.selectedDay) {
      const dayDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), this.selectedDay.number, 9, 0);
      this.newMeeting.date = dayDate.toISOString().slice(0, 16);
    }
    this.closeDayMeetingsModal();
    this.openCreateMeetingModal();
  }

  viewMeetingFromDay(meeting: any): void { this.closeDayMeetingsModal(); this.viewMeeting(meeting); }
  editMeetingFromDay(meeting: any): void { this.closeDayMeetingsModal(); this.editMeeting(meeting); }

  // ─── PROJETS ──────────────────────────────────────────────────────────────

  isCreateProjectDisabled(): boolean {
    return this.loading || !this.newProject.name || !this.newProject.team;
  }

  openCreateProjectModal(): void { this.showCreateProjectModal = true; }
  closeCreateProjectModal(): void { this.showCreateProjectModal = false; this.resetProjectForm(); }
  closeViewProjectModal(): void { this.showViewProjectModal = false; this.selectedProject = null; }

  closeEditProjectModal(): void {
    this.showEditProjectModal = false;
    this.selectedProject = null;
    this.projectToEdit = { name: '', description: '', team: '', priority: 'medium', startDate: '', endDate: '', budget: 0 };
  }

  resetProjectForm(): void {
    this.newProject = { name: '', description: '', team: '', priority: 'medium', startDate: '', endDate: '', budget: 0 };
  }

  viewProject(project: any): void { this.selectedProject = project; this.showViewProjectModal = true; }

  editProject(project: any): void {
    this.selectedProject = project;
    this.projectToEdit = {
      name: project.name, description: project.description, team: project.team,
      priority: project.priority, startDate: project.startDate,
      endDate: project.endDate, budget: project.budget
    };
    this.showEditProjectModal = true;
  }

  createProject(): void {
    if (!this.newProject.name || !this.newProject.team) {
      this.toast.warning('Champs obligatoires manquants : nom et équipe sont requis.');
      return;
    }
    this.loading = true;
    this.managerAuthService.createProject({
      name: this.newProject.name,
      description: this.newProject.description,
      team: this.newProject.team,
      priority: this.newProject.priority,
      startDate: this.newProject.startDate,
      endDate: this.newProject.endDate,
      budget: this.newProject.budget
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.loading = false;
        this.closeCreateProjectModal();
        this.toast.success('Projet créé avec succès.');
        this.loadProjectsFromDatabase();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Erreur lors de la création du projet.');
      }
    });
  }

  updateProject(): void {
    if (!this.projectToEdit.name || !this.projectToEdit.team) {
      this.toast.warning('Veuillez remplir les champs obligatoires.');
      return;
    }
    this.loading = true;
    this.managerAuthService.updateProject(this.selectedProject.id, {
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
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.loading = false;
        this.closeEditProjectModal();
        this.toast.success('Projet mis à jour avec succès.');
        this.loadProjectsFromDatabase();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Erreur lors de la mise à jour du projet.');
      }
    });
  }

  deleteProject(project: any): void {
    if (!confirm(`Supprimer le projet "${project.name}" ? Toutes les tâches associées seront supprimées.`)) return;
    this.managerAuthService.deleteProject(project.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Projet supprimé avec succès.');
          this.loadProjectsFromDatabase();
          this.loadTasksFromDatabase();
          if (this.selectedProjectForAnalytics === project.id) this.selectedProjectForAnalytics = null;
        },
        error: () => this.toast.error('Erreur lors de la suppression du projet.')
      });
  }

  // ─── TÂCHES ───────────────────────────────────────────────────────────────

  openCreateTaskModal(): void { this.showCreateTaskModal = true; }
  closeCreateTaskModal(): void { this.showCreateTaskModal = false; this.resetTaskForm(); }

  resetTaskForm(): void {
    this.newTask = { title: '', description: '', priority: 'medium', assignee_id: null, assignee_ids: [], project_id: null, due_date: '', estimated_hours: 0, tags: [] };
  }

  isAddDocumentDisabled(): boolean {
    return this.loading || !this.newDocData.title || !this.selectedFile || !this.newDocData.employeeId;
  }

  toggleNewTaskAssignee(employeeId: number): void {
    if (!this.newTask.assignee_ids) this.newTask.assignee_ids = [];
    const idx = this.newTask.assignee_ids.indexOf(employeeId);
    if (idx >= 0) this.newTask.assignee_ids.splice(idx, 1);
    else this.newTask.assignee_ids.push(employeeId);
  }

  isNewTaskAssigneeSelected(employeeId: number): boolean {
    return !!(this.newTask.assignee_ids?.includes(employeeId));
  }

  submitTask(): void {
    if (!this.newTask.title) {
      this.toast.warning('Le titre de la tâche est obligatoire.');
      return;
    }
    const taskData = {
      ...this.newTask,
      creator_id: this.currentManager?.id,
      assignee_ids: this.newTask.assignee_ids?.length ? [...this.newTask.assignee_ids] : (this.newTask.assignee_id ? [this.newTask.assignee_id] : []),
      assignee_id: this.newTask.assignee_ids?.length ? this.newTask.assignee_ids[0] : (this.newTask.assignee_id || null),
      project_id: this.newTask.project_id || null,
      due_date: this.newTask.due_date || null,
      estimated_hours: this.newTask.estimated_hours || null,
      tags: this.newTask.tags.length > 0 ? JSON.stringify(this.newTask.tags) : null
    };
    this.managerAuthService.createTask(taskData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Tâche créée avec succès.');
          this.closeCreateTaskModal();
          this.loadTasksFromDatabase();
        },
        error: (err) => {
          if (err.status !== 401 && err.status !== 403) {
            this.toast.error('Erreur lors de la création de la tâche.');
          }
        }
      });
  }

  editTask(task: any): void {
    this.taskToEdit = { ...task };
    if (!this.taskToEdit.assignments) this.taskToEdit.assignments = [];
    if (this.taskToEdit.assignments.length === 0 && this.taskToEdit.assignee_id) {
      const u = this.allUsers.find((x: any) => x.id === this.taskToEdit.assignee_id);
      if (u) {
        this.taskToEdit.assignments = [{
          employee_id: u.id,
          status: 'pending',
          employee_name: `${u.prenom} ${u.nom}`,
          employee_initials: `${(u.prenom || '')[0] || ''}${(u.nom || '')[0] || ''}`.toUpperCase()
        }];
      }
    }
    this.editAddEmployeeId = null;
    this.editDependsOnTaskId = null;
    this.editDependencyType = 'finish_to_start';
    this.taskEditDependencies = [];
    this.projectTaskDependencies = [];
    this.showEditTaskModal = true;
    this.refreshTaskEditDependencies();
    this.refreshProjectTaskDependencies();
  }

  closeEditTaskModal(): void {
    this.showEditTaskModal = false;
    this.taskToEdit = {};
    this.editAddEmployeeId = null;
    this.taskEditDependencies = [];
    this.editDependsOnTaskId = null;
  }

  refreshTaskEditDependencies(): void {
    const id = this.taskToEdit?.id;
    if (!id) return;
    this.taskEnhancedService.getTaskDependencies(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => { this.taskEditDependencies = Array.isArray(res?.data) ? res.data : []; },
        error: () => { this.taskEditDependencies = []; }
      });
  }

  refreshProjectTaskDependencies(): void {
    const pid = this.taskToEdit?.project_id;
    if (pid == null) { this.projectTaskDependencies = []; return; }
    this.taskEnhancedService.getProjectTaskDependencies(pid)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => { this.projectTaskDependencies = Array.isArray(res?.data) ? res.data : []; },
        error: () => { this.projectTaskDependencies = []; }
      });
  }

  getPredecessorCandidatesForEdit(): Task[] {
    const pid = this.taskToEdit?.project_id;
    const selfId = this.taskToEdit?.id;
    if (pid == null || !this.tasks?.length) return [];

    const blocked = new Set((this.taskEditDependencies || []).map((d: any) => Number(d.depends_on_task_id)));
    const forbidden = new Set<number>();
    const adjacency = new Map<number, number[]>();

    for (const dep of this.projectTaskDependencies) {
      const source = Number(dep.depends_on_task_id);
      const target = Number(dep.task_id);
      if (!adjacency.has(source)) adjacency.set(source, []);
      adjacency.get(source)!.push(target);
    }

    const queue = [Number(selfId)];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) || []) {
        if (!forbidden.has(next) && next !== Number(selfId)) {
          forbidden.add(next);
          queue.push(next);
        }
      }
    }

    return this.tasks.filter(t =>
      t.id !== selfId &&
      t.project_id != null &&
      Number(t.project_id) === Number(pid) &&
      !blocked.has(t.id) &&
      !forbidden.has(t.id)
    );
  }

  addDependencyFromEditModal(): void {
    const pred = this.editDependsOnTaskId;
    const tid = this.taskToEdit?.id;
    if (!pred || !tid) { this.toast.warning('Choisissez une tâche prédécesseur.'); return; }
    if (Number(pred) === Number(tid)) { this.toast.warning('Une tâche ne peut pas dépendre d\'elle-même.'); return; }
    this.taskEnhancedService.addTaskDependency(tid, pred, this.editDependencyType, 0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editDependsOnTaskId = null;
          this.refreshTaskEditDependencies();
          this.loadTasksFromDatabase();
        },
        error: (err: any) => {
          const msg = err?.error?.message || (err?.status === 409 ? 'Cette dépendance existe déjà.' : 'Impossible d\'ajouter la dépendance.');
          this.toast.error(msg);
        }
      });
  }

  removeDependencyFromEditModal(dependsOnTaskId: number): void {
    const tid = this.taskToEdit?.id;
    if (!tid) return;
    this.taskEnhancedService.removeTaskDependency(tid, dependsOnTaskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.refreshTaskEditDependencies(); this.loadTasksFromDatabase(); },
        error: () => this.toast.error('Impossible de supprimer la dépendance.')
      });
  }

  dependencyTypeLabel(type: string): string {
    return ({ finish_to_start: 'FS', start_to_start: 'SS', finish_to_finish: 'FF' } as any)[type] || type;
  }

  removeAssignmentRow(employeeId: number): void {
    if (!this.taskToEdit.assignments) return;
    this.taskToEdit.assignments = this.taskToEdit.assignments.filter((a: any) => a.employee_id !== employeeId);
  }

  addEditAssignmentFromSelect(): void {
    const id = this.editAddEmployeeId;
    if (!id || !this.taskToEdit.assignments) return;
    if (this.taskToEdit.assignments.some((a: any) => a.employee_id === id)) {
      this.toast.warning('Cet employé est déjà dans la liste.'); return;
    }
    const u = this.allUsers.find((x: any) => x.id === id);
    if (!u) return;
    this.taskToEdit.assignments = [
      ...this.taskToEdit.assignments,
      {
        employee_id: u.id, status: 'pending',
        employee_name: `${u.prenom} ${u.nom}`,
        employee_initials: `${(u.prenom || '')[0] || ''}${(u.nom || '')[0] || ''}`.toUpperCase()
      }
    ];
    this.editAddEmployeeId = null;
  }

  assignmentStatusLabel(status: string): string {
    return ({ pending: 'En attente', in_progress: 'En cours', completed: 'Terminée' } as any)[status] || status;
  }

  getEmployeeUsers(): any[] { return this.allUsers.filter((u: any) => u.role === 'employee'); }
  getOnlyEmployees(): any[] { return this.getEmployeeUsers(); }

  submitTaskEdit(): void {
    if (!this.taskToEdit.title) { this.toast.warning('Le titre de la tâche est obligatoire.'); return; }

    let formattedDueDate = this.taskToEdit.due_date;
    if (formattedDueDate?.includes('/')) {
      const parts = formattedDueDate.split('/');
      if (parts.length === 3) formattedDueDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const assignmentRows = (this.taskToEdit.assignments || [])
      .map((a: any) => ({
        employee_id: Number(a.employee_id),
        status: ['pending','in_progress','completed'].includes(a.status) ? a.status : 'pending'
      }))
      .filter((a: any) => !Number.isNaN(a.employee_id) && a.employee_id > 0);

    const taskData: any = {
      title: this.taskToEdit.title,
      description: this.taskToEdit.description || null,
      priority: this.taskToEdit.priority || 'medium',
      assignee_id: assignmentRows.length ? assignmentRows[0].employee_id : null,
      project_id: this.taskToEdit.project_id || null,
      due_date: formattedDueDate || null,
      estimated_hours: this.taskToEdit.estimated_hours || null,
      tags: (() => {
        const t = this.taskToEdit.tags;
        if (!t) return null;
        if (typeof t === 'string') return t;
        if (Array.isArray(t) && t.length > 0) return JSON.stringify(t);
        return null;
      })(),
      employee_id: this.currentManager?.id,
      assignments: assignmentRows
    };

    this.managerAuthService.updateTask(this.taskToEdit.id, taskData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Tâche mise à jour avec succès.');
          this.closeEditTaskModal();
          this.loadTasksFromDatabase();
        },
        error: () => this.toast.error('Erreur lors de la mise à jour de la tâche.')
      });
  }

  updateTaskStatus(taskId: number, newStatus: string): void {
    if (!this.draggedTask?.id) { this.toast.error('Tâche invalide.'); return; }
    this.managerAuthService.updateTaskStatus(this.draggedTask.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadTasksFromDatabase(),
        error: (err: any) => {
          const msg = err?.error?.message || 'Erreur lors de la mise à jour du statut.';
          this.toast.error(msg);
        }
      });
  }

  approveTask(taskId: number): void {
    this.managerAuthService.approveTask(taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast.success('Tâche approuvée.'); this.loadTasksFromDatabase(); },
        error: () => this.toast.error('Erreur lors de l\'approbation.')
      });
  }

  rejectTask(taskId: number): void {
    this.managerAuthService.rejectTask(taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast.success('Tâche rejetée.'); this.loadTasksFromDatabase(); },
        error: () => this.toast.error('Erreur lors du rejet.')
      });
  }

  deleteTask(taskId: number): void {
    if (!confirm('Supprimer cette tâche ?')) return;
    this.managerAuthService.deleteTask(taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast.success('Tâche supprimée.'); this.loadTasksFromDatabase(); },
        error: () => this.toast.error('Erreur lors de la suppression de la tâche.')
      });
  }

  viewTaskDetails(task: Task): void {
    this.editTask(task);
  }

  toggleTaskSelection(taskId: number): void {
    const index = this.selectedTaskIds.indexOf(taskId);
    if (index > -1) this.selectedTaskIds.splice(index, 1);
    else this.selectedTaskIds.push(taskId);
  }

  approveSelectedTasks(): void {
    if (!this.selectedTaskIds.length) { this.toast.warning('Veuillez sélectionner au moins une tâche.'); return; }
    if (!confirm(`Approuver ${this.selectedTaskIds.length} tâche(s) sélectionnée(s) ?`)) return;
    this.selectedTaskIds.forEach(id => this.approveTask(id));
    this.selectedTaskIds = [];
  }

  rejectSelectedTasks(): void {
    if (!this.selectedTaskIds.length) { this.toast.warning('Veuillez sélectionner au moins une tâche.'); return; }
    if (!confirm(`Rejeter ${this.selectedTaskIds.length} tâche(s) sélectionnée(s) ?`)) return;
    this.selectedTaskIds.forEach(id => this.rejectTask(id));
    this.selectedTaskIds = [];
  }

  // ─── DRAG AND DROP ────────────────────────────────────────────────────────

  onDragStart(task: any, event: DragEvent): void {
    this.draggedTask = task;
    event.dataTransfer!.effectAllowed = 'move';
  }
  onDragEnd(_event: DragEvent): void { this.draggedTask = null; this.draggedOverColumn = ''; }
  onDragOver(event: DragEvent): void { event.preventDefault(); event.dataTransfer!.dropEffect = 'move'; }
  onDragEnter(event: DragEvent): void { event.preventDefault(); }
  onDragLeave(_event: DragEvent): void {}
  onDrop(event: DragEvent, targetStatus: string): void {
    event.preventDefault();
    if (!this.draggedTask || this.draggedTask.status === targetStatus) return;
    this.updateTaskStatus(this.draggedTask.id, targetStatus);
  }

  // ─── UTILISATEURS ─────────────────────────────────────────────────────────

  openCreateUserModal(): void { this.showCreateUserModal = true; }
  closeCreateUserModal(): void { this.showCreateUserModal = false; this.resetUserForm(); }

  resetUserForm(): void {
    this.newUser = { nom: '', prenom: '', email: '', password: '', role: '', telephone: '' };
  }

  submitUser(): void {
    if (!this.newUser.nom || !this.newUser.prenom || !this.newUser.email || !this.newUser.password || !this.newUser.role) {
      this.toast.warning('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (this.newUser.password.length < 8) {
      this.toast.warning('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    this.managerAuthService.createUser(this.newUser)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Utilisateur créé avec succès.');
          this.closeCreateUserModal();
          this.loadUsersFromDatabase();
        },
        error: (err: any) => {
          if (err.status !== 401 && err.status !== 403) {
            const msg = err?.error?.message || 'Erreur lors de la création de l\'utilisateur.';
            this.toast.error(msg);
          }
        }
      });
  }

  editUser(user: any): void { this.userToEdit = { ...user }; this.showEditUserModal = true; }
  closeEditUserModal(): void { this.showEditUserModal = false; this.userToEdit = {}; }

  submitUserEdit(): void {
    if (!this.userToEdit.nom || !this.userToEdit.prenom || !this.userToEdit.email || !this.userToEdit.role) {
      this.toast.warning('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    this.managerAuthService.updateUser(this.userToEdit.id, this.userToEdit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Utilisateur mis à jour avec succès.');
          this.closeEditUserModal();
          this.loadUsersFromDatabase();
        },
        error: (err: any) => {
          if (err.status !== 401 && err.status !== 403) {
            const msg = err?.error?.message || 'Erreur lors de la mise à jour.';
            this.toast.error(msg);
          }
        }
      });
  }

  deleteUser(userId: number): void {
    if (!confirm('Supprimer cet utilisateur ? Cette action est irréversible.')) return;
    this.managerAuthService.deleteUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast.success('Utilisateur supprimé.'); this.loadUsersFromDatabase(); },
        error: () => this.toast.error('Erreur lors de la suppression de l\'utilisateur.')
      });
  }

  // ─── RÉUNIONS ─────────────────────────────────────────────────────────────

  openCreateMeetingModal(): void { this.showCreateMeetingModal = true; }
  closeCreateMeetingModal(): void { this.showCreateMeetingModal = false; this.resetMeetingForm(); }
  openViewMeetingModal(): void { this.showViewMeetingModal = true; }
  closeViewMeetingModal(): void { this.showViewMeetingModal = false; this.selectedMeeting = null; }
  openEditMeetingModal(): void { this.showEditMeetingModal = true; }
  closeEditMeetingModal(): void { this.showEditMeetingModal = false; this.resetMeetingForm(); }

  createMeeting(): void {
    if (!this.newMeeting.title || !this.newMeeting.date) {
      this.toast.warning('Veuillez remplir les champs obligatoires.');
      return;
    }
    this.loading = true;
    const meetingData = {
      title: this.newMeeting.title,
      description: this.newMeeting.notes || this.newMeeting.title,
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

    this.managerAuthService.createMeeting(meetingData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.closeCreateMeetingModal();
          this.toast.success('Réunion créée avec succès.');
          this.loadMeetingsFromDatabase();
        },
        error: () => { this.loading = false; this.toast.error('Erreur lors de la création de la réunion.'); }
      });
  }

  viewMeeting(meeting: any): void { this.selectedMeeting = meeting; this.openViewMeetingModal(); }

  editMeeting(meeting: any): void { this.meetingToEdit = { ...meeting }; this.openEditMeetingModal(); }

  updateMeeting(): void {
    if (!this.meetingToEdit.title || !this.meetingToEdit.date) {
      this.toast.warning('Veuillez remplir les champs obligatoires.');
      return;
    }
    this.loading = true;
    const meetingData = {
      title: this.meetingToEdit.title,
      description: this.meetingToEdit.notes || this.meetingToEdit.title,
      date_time: new Date(this.meetingToEdit.date).toISOString(),
      duration: this.meetingToEdit.duration,
      location: this.meetingToEdit.location,
      type: this.meetingToEdit.type,
      participants: this.meetingToEdit.participants || 1,
      agenda: this.meetingToEdit.agenda || [],
      notes: this.meetingToEdit.notes || ''
    };

    this.managerAuthService.updateMeeting(this.meetingToEdit.id, meetingData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.closeEditMeetingModal();
          this.toast.success('Réunion mise à jour avec succès.');
          this.loadMeetingsFromDatabase();
        },
        error: () => { this.loading = false; this.toast.error('Erreur lors de la mise à jour de la réunion.'); }
      });
  }

  deleteMeeting(meetingId: number): void {
    if (!confirm('Supprimer cette réunion ?')) return;
    this.managerAuthService.deleteMeeting(meetingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Réunion supprimée.');
          this.meetings = this.meetings.filter(m => m.id !== meetingId);
          this.upcomingMeetings = this.meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled');
          this.syncCalendarWithMeetings();
        },
        error: () => this.toast.error('Erreur lors de la suppression de la réunion.')
      });
  }

  getMeetingParticipants(meeting: any): any[] {
    const employees = this.allUsers.filter(u => u.role === 'employee');
    if (employees.length > 0) {
      return employees.slice(0, Math.min(meeting.participants || 3, employees.length)).map(u => ({
        name: u.name, initials: u.initials, color: this.getAvatarColorHex(u.id)
      }));
    }
    const colors = ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
    return Array.from({ length: meeting.participants || 3 }, (_, i) => ({
      name: `Participant ${i+1}`, initials: `P${i+1}`, color: colors[i % colors.length]
    }));
  }

  private getAvatarColorHex(id: number): string {
    const colors = ['#8B5CF6','#14B8A6','#F59E0B','#F43F5E','#3B82F6','#22C55E'];
    return colors[id % colors.length];
  }

  resetMeetingForm(): void {
    this.newMeeting = { title: '', date: '', duration: '1h', location: 'Salle A', type: 'team', agenda: [], participants: [], selectedEmployees: [], notes: '' };
  }

  updateSelectedEmployees(employeeId: number, event: any): void {
    if (!this.newMeeting.selectedEmployees) this.newMeeting.selectedEmployees = [];
    const isChecked = event.target?.checked || false;
    if (isChecked && !this.newMeeting.selectedEmployees.includes(employeeId)) {
      this.newMeeting.selectedEmployees.push(employeeId);
    } else {
      const i = this.newMeeting.selectedEmployees.indexOf(employeeId);
      if (i > -1) this.newMeeting.selectedEmployees.splice(i, 1);
    }
  }

  // ─── DOCUMENTS ────────────────────────────────────────────────────────────

  loadDocuments(): void {
    this.loading = true;
    this.documentsService.getAllDocuments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => { if (response.success) this.documents = response.data; this.loading = false; },
        error: () => { this.loading = false; this.toast.error('Erreur lors du chargement des documents.'); }
      });
  }

  openAddDocumentModal(): void {
    this.showAddDocumentModal = true;
    this.newDocData = { title: '', description: '', employeeId: null };
    this.selectedFile = null;
    if (this.allUsers.length === 0) this.loadUsersFromDatabase();
  }

  closeAddDocumentModal(): void { this.showAddDocumentModal = false; }

  onFileSelected(event: any): void { this.selectedFile = event.target.files[0]; }

  submitDocument(): void {
    if (!this.newDocData.title || !this.selectedFile || !this.newDocData.employeeId) {
      this.toast.warning('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('title', this.newDocData.title);
    formData.append('description', this.newDocData.description);
    formData.append('employeeId', this.newDocData.employeeId.toString());

    this.loading = true;
    this.documentsService.uploadDocument(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toast.success('Document ajouté avec succès.');
            this.closeAddDocumentModal();
            this.loadDocuments();
          }
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(err.error?.message || 'Erreur lors de l\'ajout du document.');
        }
      });
  }

  deleteDocument(id: number): void {
    if (!confirm('Supprimer ce document ?')) return;
    this.documentsService.deleteDocument(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => { if (response.success) { this.toast.success('Document supprimé.'); this.loadDocuments(); } },
        error: () => this.toast.error('Erreur lors de la suppression du document.')
      });
  }

  getFilteredDocuments(): Document[] {
    if (!this.searchTerm) return this.documents;
    const term = this.searchTerm.toLowerCase();
    return this.documents.filter(doc =>
      doc.title.toLowerCase().includes(term) ||
      doc.employee_name?.toLowerCase().includes(term) ||
      doc.file_name.toLowerCase().includes(term)
    );
  }

  getFileIcon(type: string): string {
    if (type.includes('pdf')) return 'bi-file-earmark-pdf text-danger';
    if (type.includes('word') || type.includes('doc')) return 'bi-file-earmark-word text-primary';
    if (type.includes('image')) return 'bi-file-earmark-image text-success';
    return 'bi-file-earmark-text';
  }

  // ─── PLANNING / IA ────────────────────────────────────────────────────────

  loadPlannings(): void {
    if (!this.currentManager) return;
    this.iaService.getPlannings(this.currentManager.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plannings: any[]) => {
          this.savedPlannings = plannings.map(p => ({
            ...p,
            simulation_data: typeof p.simulation_data === 'string' ? JSON.parse(p.simulation_data) : p.simulation_data
          }));
        },
        error: () => this.toast.error('Erreur lors du chargement des plannings.')
      });
  }

  deletePlanning(id: number): void {
    if (!confirm('Supprimer cette simulation ?')) return;
    this.savedPlannings = this.savedPlannings.filter(p => p.id !== id);
  }

  viewPlanningDetails(_planning: any): void {}

  confirmGeneratedProject(projectData: any, managerId: number): void {
    if (!confirm('Créer officiellement ce projet et ses tâches ?')) return;
    this.loading = true;
    this.iaService.confirmGeneratedProject(projectData, managerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.toast.success('Projet créé avec succès.');
          this.navigate('projets');
          this.loadProjectsFromDatabase();
        },
        error: () => { this.loading = false; this.toast.error('Erreur lors de la création du projet.'); }
      });
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  logout(): void {
    this.managerAuthService.logout();
    this.router.navigate(['/manager-login']);
  }

  goToGantt(): void {
    this.router.navigate(['/gantt']);
  }

  stopPropagation(event: Event): void { event.stopPropagation(); }

  @HostListener('window:scroll', [])
  onScroll(): void { this.isScrolled = window.scrollY > 40; }

  getStatusColor(status: string): string {
    return ({ active: '#10B981', completed: '#3B82F6', pending: '#F59E0B' } as any)[status] || '#6B7280';
  }

  getPriorityColor(priority: string): string {
    return ({ low: '#10B981', medium: '#F59E0B', high: '#EF4444' } as any)[priority] || '#6B7280';
  }

  getStatusLabel(status: string): string {
    return ({ active: 'Actif', completed: 'Terminé', paused: 'En pause', cancelled: 'Annulé' } as any)[status] || status;
  }

  getProjectStatusLabel(status: string): string { return this.getStatusLabel(status); }

  getPriorityLabel(priority: string): string {
    return ({ low: 'Basse', medium: 'Moyenne', high: 'Haute' } as any)[priority] || priority;
  }

  getRoleIcon(role: string): string {
    return ({ manager: 'bi-person-badge', admin: 'bi-shield-check', employee: 'bi-person' } as any)[role] || 'bi-person';
  }

  getDocumentIcon(type: string): string {
    return ({ pdf: 'bi-file-pdf', docx: 'bi-file-word', xlsx: 'bi-file-excel', pptx: 'bi-file-ppt', markdown: 'bi-file-code', txt: 'bi-file-text' } as any)[type] || 'bi-file';
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 80) return '#10B981';
    if (efficiency >= 60) return '#F59E0B';
    return '#EF4444';
  }

  getMeetingTypeLabel(type: string): string {
    return ({ team: 'Équipe', client: 'Client', technical: 'Technique', review: 'Revue' } as any)[type] || type;
  }

  getMeetingTypeColor(type: string): string {
    return ({ team: '#10B981', client: '#3B82F6', technical: '#F59E0B', review: '#8B5CF6' } as any)[type] || '#6B7280';
  }

  getGlobalTotalProjects(): number        { return this.analyticsData?.globalStats?.totalProjects ?? 0; }
  getGlobalCompletedTasks(): number       { return this.analyticsData?.globalStats?.completedTasks ?? 0; }
  getGlobalDelayedTasks(): number         { return this.analyticsData?.globalStats?.delayedTasks ?? 0; }
  getGlobalActualHours(): number          { return this.analyticsData?.globalStats?.totalActualHours ?? 0; }
  getProjectTotalTasks(): number          { return this.analyticsData?.projectStats?.total_tasks ?? 0; }
  getProjectCompletionPercentage(): number{ return this.analyticsData?.kpis?.completionPercentage ?? 0; }
  getProjectEstimatedHours(): number      { return this.analyticsData?.projectStats?.total_estimated_hours ?? 0; }
  getWorkloadDistributionLength(): number { return this.analyticsData?.workloadDistribution?.length ?? 0; }

  private parseTaskAssignments(task: any): any[] {
    let raw = task.assignments;
    if (!raw) return [];
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(raw)) return [];
    return raw.filter((a: any) => a && a.employee_id != null);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, tap, delay, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Manager {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  telephone?: string;
  date_creation?: string;
  token?: string;
}

export interface Employee {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  telephone: string;
  date_creation: string;
  manager_id: number;
  token?: string;
}

export interface Project {
  id?: number;
  name: string;
  description: string;
  team: string;
  priority: string;
  startDate: string;
  endDate: string;
  budget: number;
  progress: number;
  status: string;
  manager_id: number;
  deadline?: string;
}

export interface Meeting {
  id?: number;
  title: string;
  description?: string;
  date_time: string;
  duration: string;
  location: string;
  type: 'team' | 'client' | 'technical' | 'review';
  status: 'upcoming' | 'scheduled' | 'completed' | 'cancelled';
  participants: number;
  creator_id: number;
  agenda?: string[];
  notes?: string;
  meeting_link?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ManagerAuthService {
  private currentManagerSubject: BehaviorSubject<Manager | null>;
  public currentManager: Observable<Manager | null>;

  constructor(private http: HttpClient) {
    this.currentManagerSubject = new BehaviorSubject<Manager | null>(
      JSON.parse(localStorage.getItem('currentManager') || 'null')
    );
    this.currentManager = this.currentManagerSubject.asObservable();
  }

  public get currentManagerValue(): Manager | null {
    return this.currentManagerSubject.value;
  }

  public get isLoggedIn(): boolean {
    return !!this.currentManagerValue;
  }

  login(email: string, password: string): Observable<Manager> {
    return this.http.post<any>(`${environment.apiUrl}/users/login`, { email, password }).pipe(
      map(response => {
        if (response.success && response.data) {
          const manager: Manager = {
            ...response.data,
            token: response.token
          };

          if (manager.role !== 'manager' && manager.role !== 'admin') {
            throw new Error('Accès réservé aux managers.');
          }

          // Clear any stale employee session before setting manager session
          localStorage.removeItem('employeeToken');
          localStorage.removeItem('currentEmployee');
          localStorage.setItem('currentManager', JSON.stringify(manager));
          localStorage.setItem('managerToken', response.token);
          this.currentManagerSubject.next(manager);
          return manager;
        } else {
          throw new Error(response.message || 'Erreur d\'authentification');
        }
      })
    );
  }


  logout(): void {
    localStorage.removeItem('currentManager');
    localStorage.removeItem('managerToken');
    this.currentManagerSubject.next(null);
  }

  register(managerData: {
    nom: string;
    prenom: string;
    email: string;
    password: string;
    telephone?: string;
  }): Observable<any> {
    const dataWithRole = {
      ...managerData,
      role: 'manager'
    };

    return this.http.post(`${environment.apiUrl}/users/register`, dataWithRole);
  }

  refreshToken(): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager || !currentManager.token) {
      return new Observable();
    }

    return this.http.post<any>(`${environment.apiUrl}/users/refresh-token`, {
      token: currentManager.token
    }).pipe(
      tap(response => {
        if (response.token) {
          const updatedManager = { ...currentManager, token: response.token };
          localStorage.setItem('currentManager', JSON.stringify(updatedManager));
          this.currentManagerSubject.next(updatedManager);
        }
      })
    );
  }

  // Créer un projet dans la base de données
  createProject(projectData: Omit<Project, 'id' | 'manager_id' | 'progress' | 'status'>): Observable<Project> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      console.error('Aucun manager connecté');
      throw new Error('Aucun manager connecté');
    }

    console.log('Tentative de création de projet avec les données:', projectData);
    console.log('Manager connecté:', currentManager);

    const projectWithManager: Project = {
      ...projectData,
      manager_id: currentManager.id,
      progress: 0,
      status: 'active',
      deadline: projectData.endDate || 'À définir'
    };

    console.log('Données envoyées au backend:', projectWithManager);

    // Appel au backend pour créer le projet
    return this.http.post<Project>(`${environment.apiUrl}/projects`, projectWithManager, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    }).pipe(
      tap(response => {
        console.log('Réponse du backend:', response);
      }),
      catchError((error: any) => {
        console.error('Erreur HTTP:', error);
        console.error('Status:', error.status);
        console.error('Error body:', error.error);
        return throwError(error);
      })
    );
  }

  // Obtenir les projets du manager connecté
  getManagerProjects(): Observable<Project[]> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    return this.http.get<Project[]>(`${environment.apiUrl}/projects/manager/${currentManager.id}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  updateProject(projectId: number, projectData: any): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.put<any>(`${environment.apiUrl}/projects/${projectId}`, projectData, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  deleteProject(projectId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.delete<any>(`${environment.apiUrl}/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  // Méthodes pour la gestion des utilisateurs
  getAllUsers(): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.get<any>(`${environment.apiUrl}/users`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  createUser(userData: any): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.post<any>(`${environment.apiUrl}/users`, userData, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  updateUser(userId: number, userData: any): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.put<any>(`${environment.apiUrl}/users/${userId}`, userData, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  deleteUser(userId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.delete<any>(`${environment.apiUrl}/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  // Méthodes pour la gestion des tâches
  createTask(taskData: any): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.post<any>(`${environment.apiUrl}/tasks`, taskData, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  updateTask(taskId: number, taskData: any): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.put<any>(`${environment.apiUrl}/tasks/${taskId}`, taskData, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  updateTaskStatus(taskId: number, status: string): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.put<any>(`${environment.apiUrl}/tasks/${taskId}/status`, { status }, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  approveTask(taskId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.put<any>(`${environment.apiUrl}/tasks/${taskId}/approve`, {}, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  rejectTask(taskId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.put<any>(`${environment.apiUrl}/tasks/${taskId}/reject`, { reason: '' }, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  deleteTask(taskId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.delete<any>(`${environment.apiUrl}/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  getTasksByStatus(status: string): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.get<any>(`${environment.apiUrl}/tasks/status/${status}?managerId=${currentManager.id}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  // Méthodes pour la gestion du timesheet
  getTimesheetEntries(): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.get<any>(`${environment.apiUrl}/timesheet/manager/${currentManager.id}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  getTimesheetStats(): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.get<any>(`${environment.apiUrl}/timesheet/stats/manager/${currentManager.id}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  getTimesheetByPeriod(period?: string, startDate?: string, endDate?: string): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    let params = new URLSearchParams();
    if (period) params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.http.get<any>(`${environment.apiUrl}/timesheet/period/manager/${currentManager.id}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  // Méthodes pour la gestion des réunions
  createMeeting(meeting: Omit<Meeting, 'id' | 'creator_id' | 'created_at' | 'updated_at'>): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    const meetingData = {
      ...meeting,
      creator_id: currentManager.id
    };

    return this.http.post<any>(`${environment.apiUrl}/meetings`, meetingData, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  getMeetings(): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.get<any>(`${environment.apiUrl}/meetings/manager/${currentManager.id}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  updateMeeting(meetingId: number, meeting: Partial<Meeting>): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    return this.http.put<any>(`${environment.apiUrl}/meetings/${meetingId}`, meeting, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  deleteMeeting(meetingId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    return this.http.delete<any>(`${environment.apiUrl}/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  // Récupérer les réunions assignées à un employé
  getEmployeeMeetings(employeeId: number): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    return this.http.get<any>(`${environment.apiUrl}/meetings/employee/${employeeId}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  // Mettre à jour le statut de participation d'un employé à une réunion
  updateMeetingAttendance(meetingId: number, employeeId: number, status: string, notes?: string): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }

    return this.http.put<any>(`${environment.apiUrl}/meetings/${meetingId}/employee/${employeeId}/status`,
      { status, notes }, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }

  getUpcomingMeetings(): Observable<any> {
    const currentManager = this.currentManagerValue;
    if (!currentManager) {
      throw new Error('Aucun manager connecté');
    }
    return this.http.get<any>(`${environment.apiUrl}/meetings/upcoming/manager/${currentManager.id}`, {
      headers: {
        'Authorization': `Bearer ${currentManager.token}`
      }
    });
  }
}

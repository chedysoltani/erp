import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class EmployeeAuthService {
  private currentEmployeeSubject: BehaviorSubject<Employee | null>;
  public currentEmployee: Observable<Employee | null>;

  constructor(
    private router: Router,
    private http: HttpClient
  ) {
    // Ne pas charger automatiquement depuis localStorage pour éviter la redirection
    this.currentEmployeeSubject = new BehaviorSubject<Employee | null>(null);
    this.currentEmployee = this.currentEmployeeSubject.asObservable();
  }

  public get currentEmployeeValue(): Employee | null {
    return this.currentEmployeeSubject.value;
  }

  public get isLoggedIn(): boolean {
    return !!this.currentEmployeeValue;
  }

  login(email: string, password: string): Observable<Employee> {
    return this.http.post<any>(`${environment.apiUrl}/users/login`, { email, password })
      .pipe(
        map(response => {
          // Vérifier si l'utilisateur est un employé
          if (response.success && response.data && response.data.role === 'employee') {
            const employee: Employee = {
              ...response.data,
              manager_id: 1, // Par défaut
              token: response.token
            };
            // Clear any stale manager session before setting employee session
            localStorage.removeItem('managerToken');
            localStorage.removeItem('currentManager');
            localStorage.setItem('currentEmployee', JSON.stringify(employee));
            localStorage.setItem('employeeToken', response.token);
            this.currentEmployeeSubject.next(employee);
            console.log('Employé authentifié:', employee);
            return employee;
          } else if (response.success && response.data && response.data.role !== 'employee') {
            throw new Error('Accès réservé aux employés. Votre rôle est: ' + response.data.role);
          } else {
            throw new Error('Email ou mot de passe incorrect');
          }
        }),
        catchError((error: HttpErrorResponse) => {
          const msg = error.error?.message || 'Email ou mot de passe incorrect';
          return throwError(() => new Error(msg));
        })
      );
  }

  logout(): void {
    localStorage.removeItem('currentEmployee');
    this.currentEmployeeSubject.next(null);
    this.router.navigate(['/employee-login']);
  }

  // Méthode pour charger manuellement l'employé depuis localStorage si nécessaire
  loadEmployeeFromStorage(): boolean {
    const employeeData = localStorage.getItem('currentEmployee');
    if (employeeData) {
      try {
        const employee = JSON.parse(employeeData);
        this.currentEmployeeSubject.next(employee);
        return true;
      } catch (e) {
        localStorage.removeItem('currentEmployee');
      }
    }
    return false;
  }
}

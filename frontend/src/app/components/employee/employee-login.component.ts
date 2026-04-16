import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerAuthService, Employee } from '../../services/manager-auth.service';

@Component({
  selector: 'app-employee-login',
  templateUrl: './employee-login.component.html',
  styleUrls: ['./employee-login.component.css']
})
export class EmployeeLoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private router: Router,
    private managerAuthService: ManagerAuthService
  ) {}

  ngOnInit() {
    // Vérifier si l'employé est déjà connecté
    const employeeData = localStorage.getItem('currentEmployee');
    if (employeeData) {
      this.router.navigate(['/employee']);
    }
  }

  login() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Simulation de login pour tester
    if (this.email && this.password) {
      const mockEmployee: Employee = {
        id: 2,
        nom: 'Employé',
        prenom: 'Test',
        email: this.email,
        role: 'employee',
        telephone: '0123456789',
        date_creation: new Date().toISOString(),
        manager_id: 1,
        token: 'employee-token-' + Date.now()
      };
      
      localStorage.setItem('currentEmployee', JSON.stringify(mockEmployee));
      this.router.navigate(['/employee']);
      this.isLoading = false;
    }
  }

  goToManagerLogin() {
    this.router.navigate(['/manager-login']);
  }
}

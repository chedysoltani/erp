import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EmployeeDashboardComponent } from './employee-dashboard.component';
import { EmployeeLoginComponent } from './employee-login.component';

const routes = [
  { path: 'login', component: EmployeeLoginComponent },
  { path: '', component: EmployeeDashboardComponent }
];

@NgModule({
  declarations: [
    EmployeeDashboardComponent,
    EmployeeLoginComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class EmployeeModule { }

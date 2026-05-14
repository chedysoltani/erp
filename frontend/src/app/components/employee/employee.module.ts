import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EmployeeDashboardComponent } from './employee-dashboard.component';

const routes = [
  { path: '', component: EmployeeDashboardComponent }
];

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    EmployeeDashboardComponent
  ]
})
export class EmployeeModule { }

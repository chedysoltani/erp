import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManagerAuthGuard } from './guards/manager-auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/landing', pathMatch: 'full' },
  { path: 'landing', loadChildren: () => import('./components/landing/landing.module').then(m => m.LandingModule) },
  { path: 'users', loadChildren: () => import('./components/users/users.module').then(m => m.UsersModule) },
  { path: 'manager-login', loadChildren: () => import('./components/manager/manager.module').then(m => m.ManagerModule) },
  { path: 'manager', loadChildren: () => import('./components/manager/manager.module').then(m => m.ManagerModule) },
  { path: 'employee-login', loadChildren: () => import('./components/employee/employee.module').then(m => m.EmployeeModule) },
  { path: 'employee', loadChildren: () => import('./components/employee/employee.module').then(m => m.EmployeeModule) },
  //{ path: 'home', loadChildren: () => import('./components/home/home.module').then(m => m.HomeModule) },
 
  { path: '**', redirectTo: '/landing' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

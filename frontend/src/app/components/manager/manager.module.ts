import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ManagerDashboardComponent } from './manager-dashboard.component';
import { TaskRecommendationComponent } from './task-recommendation.component';
import { ProjectSimulatorComponent } from './project-simulator.component';
import { ManagerRoutingModule } from './manager-routing.module';
import { IARecommendationService } from '../../services/ia-recommendation.service';
import { SkillsService } from '../../services/skills.service';

@NgModule({
  declarations: [
    ManagerDashboardComponent,
    TaskRecommendationComponent,
    ProjectSimulatorComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ManagerRoutingModule
  ],
  providers: [
    IARecommendationService,
    SkillsService
  ]
})
export class ManagerModule { }

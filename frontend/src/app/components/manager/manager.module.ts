import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ManagerDashboardComponent } from './manager-dashboard.component';
import { TaskRecommendationComponent } from './task-recommendation.component';
import { ProjectSimulatorComponent } from './project-simulator.component';
import { EnhancedGanttComponent } from './enhanced-gantt.component';
import { TaskTimeTrackerComponent } from './task-time-tracker.component';
import { ManagerRoutingModule } from './manager-routing.module';
import { ManagerAttendanceComponent } from './manager-attendance.component';
import { IARecommendationService } from '../../services/ia-recommendation.service';
import { SkillsService } from '../../services/skills.service';
import { AnalyticsService } from '../../services/analytics.service';
import { TaskEnhancedService } from '../../services/task-enhanced.service';

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
    ManagerRoutingModule,
    EnhancedGanttComponent,
    TaskTimeTrackerComponent,
    ManagerAttendanceComponent
  ],
  providers: [
    IARecommendationService,
    SkillsService,
    AnalyticsService,
    TaskEnhancedService
  ]
})
export class ManagerModule { }

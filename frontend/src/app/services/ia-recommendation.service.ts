import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  EmployeeSkillsProfile, 
  TaskWithRequirements, 
  EmployeeMatch,
  TaskRequirement,
  ProjectSimulation,
  Skill,
  Technology,
  TimelineItem
} from '../models/skills.model';

@Injectable({
  providedIn: 'root'
})
export class IARecommendationService {
  private apiUrl = 'http://localhost:3001/api/manager';
  private iaApiUrl = 'http://localhost:3001/api/ia';

  constructor(private http: HttpClient) {}

  // Obtenir les recommandations d'employés pour une tâche
  getTaskRecommendations(task: TaskWithRequirements): Observable<EmployeeMatch[]> {
    console.log('🚀 Tentative d\'obtenir les recommandations depuis le backend...');
    console.log('📤 Tâche envoyée:', task);
    console.log('🌐 URL du backend:', `${this.apiUrl}/recommendations/task`);
    
    return this.http.post(`${this.apiUrl}/recommendations/task`, task).pipe(
      map((response: any) => {
        console.log('✅ Réponse du backend reçue:', response);
        if (response.success) {
          console.log('📊 Données du backend utilisées - Nombre de recommandations:', response.data.length);
          return response.data.map((match: any) => this.formatEmployeeMatch(match));
        }
        console.log('⚠️ Backend a répondu mais sans succès');
        return [];
      }),
      catchError(error => {
        console.error('❌ Erreur du backend détectée:', error);
        console.log('🔄 Utilisation de l\'algorithme local en fallback...');
        console.log('📝 Données mockées utilisées car le backend n\'est pas accessible');
        const localResults = this.calculateTaskMatches(task);
        console.log('📊 Résultats de l\'algorithme local:', localResults);
        return of(localResults);
      })
    );
  }

  // Obtenir tous les profils de compétences des employés
  getEmployeeSkillsProfiles(): Observable<EmployeeSkillsProfile[]> {
    return this.http.get(`${this.apiUrl}/employees/skills-profiles`).pipe(
      map((response: any) => {
        if (response.success) {
          return response.data.map((profile: any) => this.formatSkillsProfile(profile));
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading skills profiles:', error);
        return throwError(() => error);
      })
    );
  }

  // Simuler un projet avec IA
  simulateProject(project: ProjectSimulation): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate-project`, project).pipe(
      map((response: any) => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Project simulation failed');
      }),
      catchError(error => {
        console.error('Error simulating project:', error);
        // Fallback vers l'algorithme local
        return of(this.localProjectSimulation(project));
      })
    );
  }

  // --- NOUVELLES METHODES POUR L'ANALYSE DE PDF ---

  simulateProjectFromPdf(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.iaApiUrl}/simulate-pdf`, formData).pipe(
      map((response: any) => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message || 'Erreur lors de la simulation via PDF');
      }),
      catchError(error => {
        console.error('Error simulating project from PDF:', error);
        return throwError(() => error);
      })
    );
  }

  confirmGeneratedProject(projectData: any, managerId: number): Observable<any> {
    return this.http.post(`${this.iaApiUrl}/confirm-project`, { projectData, manager_id: managerId }).pipe(
      map((response: any) => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message || 'Erreur lors de la création du projet');
      }),
      catchError(error => {
        console.error('Error confirming project:', error);
        return throwError(() => error);
      })
    );
  }

  // Algorithme local de matching compétences-tâches
  private calculateTaskMatches(task: TaskWithRequirements): EmployeeMatch[] {
    console.log('🔧 Démarrage de l\'algorithme local de matching...');
    console.log('📋 Compétences requises pour la tâche:', task.requirements);
    
    // Pour l'instant, utiliser des données mockées car nous n'avons pas accès aux profils réels
    // En production, cela utilisera les vrais profils d'employés depuis la base de données
    const mockEmployees = [
      {
        employeeId: 12,
        employeeName: 'Jean Dupont',
        skills: [
          { name: 'JavaScript', level: 4 },
          { name: 'React', level: 4 },
          { name: 'Node.js', level: 3 },
          { name: 'TypeScript', level: 2 }
        ],
        availability: 80,
        workload: 60
      },
      {
        employeeId: 13,
        employeeName: 'Marie Martin',
        skills: [
          { name: 'JavaScript', level: 3 },
          { name: 'React', level: 4 },
          { name: 'Node.js', level: 2 },
          { name: 'TypeScript', level: 1 }
        ],
        availability: 90,
        workload: 40
      },
      {
        employeeId: 14,
        employeeName: 'Pierre Durand',
        skills: [
          { name: 'JavaScript', level: 2 },
          { name: 'React', level: 2 },
          { name: 'Node.js', level: 4 },
          { name: 'TypeScript', level: 1 }
        ],
        availability: 70,
        workload: 80
      }
    ];

    const results = mockEmployees.map(employee => {
      console.log(`👤 Analyse de l'employé: ${employee.employeeName}`);
      const matchResult = this.calculateEmployeeTaskMatch(employee, task);
      console.log(`📊 Score pour ${employee.employeeName}: ${matchResult.score}%`);
      console.log(`✅ Compétences correspondantes: ${matchResult.matchingSkills.join(', ')}`);
      console.log(`❌ Compétences manquantes: ${matchResult.missingSkills.join(', ')}`);
      
      return {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        matchScore: matchResult.score,
        matchingSkills: matchResult.matchingSkills,
        missingSkills: matchResult.missingSkills,
        availability: employee.availability,
        workload: employee.workload,
        recommendation: this.getRecommendationFromScore(matchResult.score)
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
    
    console.log('🏆 Résultats finaux triés par score:', results);
    return results;
  }

  // Calculer le matching entre un employé et une tâche
  private calculateEmployeeTaskMatch(employee: any, task: TaskWithRequirements): { score: number; matchingSkills: string[]; missingSkills: string[] } {
    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];
    let totalScore = 0;
    let maxScore = 0;

    task.requirements.forEach(requirement => {
      const employeeSkill = employee.skills.find((s: any) => s.name === requirement.skillName);
      const importanceWeight = requirement.importance === 'critical' ? 30 : 
                             requirement.importance === 'high' ? 20 : 
                             requirement.importance === 'medium' ? 10 : 5;
      maxScore += importanceWeight;

      if (employeeSkill) {
        const skillScore = Math.min(employeeSkill.level, requirement.requiredLevel) / requirement.requiredLevel;
        totalScore += skillScore * importanceWeight;
        matchingSkills.push(requirement.skillName);
      } else {
        missingSkills.push(requirement.skillName);
      }
    });

    const score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    return { score, matchingSkills, missingSkills };
  }

  // Déterminer la recommandation basée sur le score
  private getRecommendationFromScore(score: number): 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended' {
    if (score >= 80) return 'highly_recommended';
    if (score >= 60) return 'recommended';
    if (score >= 40) return 'consider';
    return 'not_recommended';
  }

  // Algorithme local de simulation de projet
  private localProjectSimulation(project: ProjectSimulation) {
    const startDate = new Date();
    const totalDays = project.duration;
    const endDate = new Date(startDate.getTime() + (totalDays * 24 * 60 * 60 * 1000));
    
    // Simulation simple de répartition des tâches
    const taskAssignments = project.tasks.map(task => ({
      taskId: task.id,
      employeeId: this.selectBestEmployee(task, project.availableEmployees)
    }));

    // Calcul du risque basé sur la complexité et la durée
    const riskLevel = this.calculateRiskLevel(project);

    return {
      timeline: this.generateTimeline(project.tasks, totalDays),
      taskAssignments,
      estimatedCompletion: endDate,
      riskLevel,
      recommendations: this.generateRecommendations(project, riskLevel)
    };
  }

  // Sélectionner le meilleur employé pour une tâche
  private selectBestEmployee(task: TaskWithRequirements, availableEmployees: number[]): number {
    // Logique simple pour l'instant
    // En production, cela analyserait les compétences réelles
    if (availableEmployees.length > 0) {
      return availableEmployees[0];
    }
    return 1; // Default employee
  }

  // Calculer le niveau de risque d'un projet
  private calculateRiskLevel(project: ProjectSimulation): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    // Risque basé sur la durée
    if (project.duration > 60) riskScore += 2;
    else if (project.duration > 30) riskScore += 1;
    
    // Risque basé sur le nombre de tâches
    if (project.tasks.length > 20) riskScore += 2;
    else if (project.tasks.length > 10) riskScore += 1;
    
    // Risque basé sur la complexité des tâches
    const highComplexityTasks = project.tasks.filter(task => 
      task.requirements.some(req => req.importance === 'critical')
    ).length;
    
    if (highComplexityTasks > 5) riskScore += 2;
    else if (highComplexityTasks > 2) riskScore += 1;
    
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  // Générer une timeline pour le projet
  private generateTimeline(tasks: TaskWithRequirements[], totalDays: number): TimelineItem[] {
    const timeline: TimelineItem[] = [];
    const daysPerTask = Math.floor(totalDays / tasks.length);
    
    tasks.forEach((task, index) => {
      const startDay = index * daysPerTask;
      const endDay = Math.min((index + 1) * daysPerTask, totalDays);
      
      timeline.push({
        taskId: task.id,
        taskTitle: task.title,
        startDate: new Date(Date.now() + (startDay * 24 * 60 * 60 * 1000)),
        endDate: new Date(Date.now() + (endDay * 24 * 60 * 60 * 1000)),
        duration: endDay - startDay,
        priority: task.priority
      });
    });
    
    return timeline;
  }

  // Générer des recommandations pour le projet
  private generateRecommendations(project: ProjectSimulation, riskLevel: string): string[] {
    const recommendations = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Considérez diviser le projet en plusieurs phases plus petites');
      recommendations.push('Prévoyez des points de contrôle réguliers');
      recommendations.push('Allouez des ressources supplémentaires en cas de retard');
    } else if (riskLevel === 'medium') {
      recommendations.push('Surveillez attentivement le progrès hebdomadaire');
      recommendations.push('Préparez un plan de contingence');
    } else {
      recommendations.push('Le projet semble réalisable dans les délais prévus');
    }
    
    // Recommandations basées sur les tâches
    const criticalTasks = project.tasks.filter(task => 
      task.requirements.some(req => req.importance === 'critical')
    );
    
    if (criticalTasks.length > 0) {
      recommendations.push(`Accordez une attention particulière aux ${criticalTasks.length} tâches critiques`);
    }
    
    return recommendations;
  }

  // Formatter un profil de compétences
  private formatSkillsProfile(data: any): EmployeeSkillsProfile {
    return {
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      skills: data.skills || [],
      technologies: data.technologies || [],
      specialities: data.specialities || [],
      overallScore: data.overallScore || 0,
      lastUpdated: new Date(data.lastUpdated),
      strengths: data.strengths || [],
      improvementAreas: data.improvementAreas || []
    };
  }

  // Formatter un match d'employé
  private formatEmployeeMatch(data: any): EmployeeMatch {
    return {
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      matchScore: data.matchScore || 0,
      matchingSkills: data.matchingSkills || [],
      missingSkills: data.missingSkills || [],
      availability: data.availability || 0,
      workload: data.workload || 0,
      recommendation: data.recommendation || 'consider'
    };
  }

  // Calculer le score de compatibilité entre un employé et une tâche
  calculateCompatibilityScore(employeeProfile: EmployeeSkillsProfile, task: TaskWithRequirements): number {
    let totalScore = 0;
    let maxScore = 0;
    
    task.requirements.forEach(requirement => {
      maxScore += requirement.importance === 'critical' ? 30 : 
                  requirement.importance === 'high' ? 20 : 
                  requirement.importance === 'medium' ? 10 : 5;
      
      const employeeSkill = employeeProfile.skills.find(s => s.name === requirement.skillName);
      if (employeeSkill) {
        const skillScore = Math.min(employeeSkill.level, requirement.requiredLevel) / requirement.requiredLevel;
        totalScore += skillScore * (requirement.importance === 'critical' ? 30 : 
                                   requirement.importance === 'high' ? 20 : 
                                   requirement.importance === 'medium' ? 10 : 5);
      }
    });
    
    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  }

  // Analyser la charge de travail d'un employé
  analyzeWorkload(employeeId: number, currentTasks: any[]): { availability: number; workload: number } {
    const totalHours = currentTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    const weeklyCapacity = 40; // 40 heures par semaine
    const workload = Math.min((totalHours / weeklyCapacity) * 100, 100);
    const availability = Math.max(100 - workload, 0);
    
    return { availability, workload };
  }

  // Générer des suggestions d'amélioration pour un employé
  generateImprovementSuggestions(employeeProfile: EmployeeSkillsProfile): string[] {
    const suggestions = [];
    
    // Analyser les compétences faibles
    const weakSkills = employeeProfile.skills.filter(s => s.level <= 2);
    if (weakSkills.length > 0) {
      suggestions.push(`Considérez une formation pour améliorer: ${weakSkills.map(s => s.name).join(', ')}`);
    }
    
    // Analyser les technologies de base
    const basicTechnologies = employeeProfile.technologies.filter(t => t.proficiency === 'basic');
    if (basicTechnologies.length > 0) {
      suggestions.push(`Progresser sur les technologies: ${basicTechnologies.map(t => t.name).join(', ')}`);
    }
    
    // Suggestions basées sur les tendances du marché
    const hasModernSkills = employeeProfile.skills.some(s => 
      ['React', 'Angular', 'Vue.js', 'Node.js', 'Python', 'Docker'].includes(s.name)
    );
    
    if (!hasModernSkills) {
      suggestions.push('Considérez l\'apprentissage de technologies modernes (React, Angular, Node.js, etc.)');
    }
    
    return suggestions;
  }
}

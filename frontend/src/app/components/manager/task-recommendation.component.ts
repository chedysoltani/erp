import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { IARecommendationService } from '../../services/ia-recommendation.service';
import { 
  TaskWithRequirements, 
  TaskRequirement, 
  EmployeeMatch,
  EmployeeSkillsProfile 
} from '../../models/skills.model';

@Component({
  selector: 'app-task-recommendation',
  templateUrl: './task-recommendation.component.html',
  styleUrls: ['./task-recommendation.component.css']
})
export class TaskRecommendationComponent implements OnInit {
  taskForm!: FormGroup;
  recommendations: EmployeeMatch[] = [];
  loading: boolean = false;
  showResults: boolean = false;
  
  employeeProfiles: EmployeeSkillsProfile[] = [];
  
  // Options pour les compétences (chargées depuis le backend)
  availableSkills: string[] = [];
  
  constructor(
    private fb: FormBuilder,
    private iaService: IARecommendationService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    this.loadEmployeeProfiles();
  }

  private initializeForm() {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      estimatedHours: [8, [Validators.required, Validators.min(1)]],
      priority: ['medium', Validators.required],
      deadline: ['', Validators.required],
      requirements: this.fb.array([])
    });
    
    // Ajouter une compétence par défaut pour faciliter les tests
    setTimeout(() => {
      this.addRequirement();
    }, 100);
  }

  get requirementsArray(): FormArray {
    return this.taskForm.get('requirements') as FormArray;
  }

  loadEmployeeProfiles() {
    this.iaService.getEmployeeSkillsProfiles().subscribe({
      next: (profiles) => {
        this.employeeProfiles = profiles;
        console.log('Profils employés chargés:', profiles);
        
        // Extraire toutes les compétences uniques
        const allSkills = new Set<string>();
        profiles.forEach(profile => {
          profile.skills.forEach(skill => {
            allSkills.add(skill.name);
          });
        });
        this.availableSkills = Array.from(allSkills).sort();
        console.log('Compétences disponibles:', this.availableSkills);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des profils:', error);
        // En cas d'erreur, utiliser la liste par défaut
        this.availableSkills = [
          'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Angular', 
          'Vue.js', 'Node.js', 'Docker', 'Kubernetes', 'MySQL', 
          'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'Git'
        ];
      }
    });
  }

  addRequirement() {
    const requirementGroup = this.fb.group({
      skillName: ['', Validators.required],
      requiredLevel: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      importance: ['medium', Validators.required]
    });
    
    this.requirementsArray.push(requirementGroup);
  }

  removeRequirement(index: number) {
    this.requirementsArray.removeAt(index);
  }

  getRecommendations() {
    console.log('Validation du formulaire...');
    console.log('Formulaire valide:', this.taskForm.valid);
    console.log('Nombre de compétences:', this.requirementsArray.length);
    console.log('Compétences:', this.requirementsArray.value);
    
    if (this.taskForm.invalid) {
      console.log('Formulaire invalide - détails:', this.taskForm.errors);
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    if (this.requirementsArray.length === 0) {
      console.log('Aucune compétence ajoutée');
      alert('Veuillez ajouter au moins une compétence requise');
      return;
    }
    
    // Vérifier si chaque compétence est valide
    const invalidRequirements = this.requirementsArray.controls.filter(control => control.invalid);
    if (invalidRequirements.length > 0) {
      console.log('Compétences invalides:', invalidRequirements);
      alert('Veuillez compléter toutes les informations des compétences requises');
      return;
    }

    this.loading = true;
    
    const taskData: TaskWithRequirements = {
      id: Date.now(),
      title: this.taskForm.value.title,
      description: this.taskForm.value.description,
      requirements: this.taskForm.value.requirements,
      estimatedHours: this.taskForm.value.estimatedHours,
      priority: this.taskForm.value.priority,
      deadline: new Date(this.taskForm.value.deadline)
    };

    this.iaService.getTaskRecommendations(taskData).subscribe({
      next: (recommendations) => {
        this.recommendations = recommendations.sort((a, b) => b.matchScore - a.matchScore);
        this.showResults = true;
        this.loading = false;
        console.log('Recommandations obtenues:', recommendations);
      },
      error: (error) => {
        console.error('Erreur lors de l\'obtention des recommandations:', error);
        this.loading = false;
        alert('Erreur lors de l\'obtention des recommandations');
      }
    });
  }

  resetForm() {
    this.taskForm.reset({
      title: '',
      description: '',
      estimatedHours: 8,
      priority: 'medium',
      deadline: ''
    });
    
    while (this.requirementsArray.length > 0) {
      this.requirementsArray.removeAt(0);
    }
    
    this.showResults = false;
    this.recommendations = [];
  }

  assignTask(employee: EmployeeMatch) {
    const confirmMessage = `Voulez-vous assigner cette tâche à ${employee.employeeName} ?\n\n` +
      `Score de compatibilité: ${employee.matchScore}%\n` +
      `Compétences correspondantes: ${employee.matchingSkills.join(', ')}\n` +
      `Disponibilité: ${employee.availability}%`;
    
    if (confirm(confirmMessage)) {
      // Logique d'assignation de la tâche
      console.log('Tâche assignée à:', employee);
      alert(`Tâche assignée avec succès à ${employee.employeeName} !`);
      
      // Ici, vous appelleriez votre service pour créer et assigner la tâche
      // this.taskService.createAndAssignTask(taskData, employee.employeeId).subscribe(...)
    }
  }

  // Méthodes utilitaires
  getRecommendationColor(recommendation: string): string {
    switch (recommendation) {
      case 'highly_recommended': return '#10b981';
      case 'recommended': return '#3b82f6';
      case 'consider': return '#f59e0b';
      case 'not_recommended': return '#ef4444';
      default: return '#6b7280';
    }
  }

  getRecommendationLabel(recommendation: string): string {
    switch (recommendation) {
      case 'highly_recommended': return 'Fortement recommandé';
      case 'recommended': return 'Recommandé';
      case 'consider': return 'À considérer';
      case 'not_recommended': return 'Non recommandé';
      default: return recommendation;
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }

  getImportanceColor(importance: string): string {
    switch (importance) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  }

  getImportanceLabel(importance: string): string {
    switch (importance) {
      case 'critical': return 'Critique';
      case 'high': return 'Élevée';
      case 'medium': return 'Moyenne';
      case 'low': return 'Faible';
      default: return importance;
    }
  }

  getLevelLabel(level: number): string {
    const labels = ['', 'Débutant', 'Intermédiaire', 'Compétent', 'Avancé', 'Expert'];
    return labels[level] || '';
  }

  getAvailabilityColor(availability: number): string {
    if (availability >= 80) return '#10b981';
    if (availability >= 60) return '#3b82f6';
    if (availability >= 40) return '#f59e0b';
    return '#ef4444';
  }

  getWorkloadColor(workload: number): string {
    if (workload <= 40) return '#10b981';
    if (workload <= 70) return '#f59e0b';
    return '#ef4444';
  }

  // Obtenir les détails d'un employé
  getEmployeeDetails(employeeId: number): EmployeeSkillsProfile | undefined {
    return this.employeeProfiles.find(profile => profile.employeeId === employeeId);
  }

  // Calculer le nombre de compétences correspondantes
  getMatchingSkillsCount(matchingSkills: string[]): number {
    return matchingSkills.length;
  }

  // Calculer le nombre de compétences manquantes
  getMissingSkillsCount(missingSkills: string[]): number {
    return missingSkills.length;
  }
}

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { IARecommendationService } from '../../services/ia-recommendation.service';
import { 
  ProjectSimulation, 
  TaskWithRequirements, 
  TaskRequirement,
  EmployeeSkillsProfile
} from '../../models/skills.model';

@Component({
  selector: 'app-project-simulator',
  templateUrl: './project-simulator.component.html',
  styleUrls: ['./project-simulator.component.css']
})
export class ProjectSimulatorComponent implements OnInit {
  projectForm!: FormGroup;
  simulationResult: any = null;
  loading: boolean = false;
  showResults: boolean = false;
  
  // Nouveaux états pour le PDF
  activeMode: 'pdf' | 'manual' = 'pdf';
  selectedFile: File | null = null;
  generatedProjectData: any = null;
  confirming: boolean = false;
  
  availableEmployees: { id: number; name: string; role: string }[] = [];
  
  // Options pour les compétences (chargées depuis le backend)
  availableSkills: string[] = [];
  
  // Profils des employés
  employeeProfiles: EmployeeSkillsProfile[] = [];
  
  constructor(
    private fb: FormBuilder,
    private iaService: IARecommendationService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    this.loadEmployeeData();
    // Ajouter seulement un objectif par défaut après le chargement des données
    setTimeout(() => {
      this.addObjective();
      // Ne pas ajouter de tâche par défaut pour éviter les requirements vides
    }, 500);
  }

  // Charger les données des employés depuis le backend
  private loadEmployeeData() {
    this.iaService.getEmployeeSkillsProfiles().subscribe({
      next: (profiles) => {
        this.employeeProfiles = profiles;
        console.log('Profils employés chargés pour simulateur:', profiles);
        console.log('🔍 Vérification employeeName dans les profils:');
        profiles.slice(0, 3).forEach((profile, index) => {
          console.log(`  - Employé ${index}: ID=${profile.employeeId}, Name=${(profile as any).employeeName}`);
        });
        
        // Extraire les employés disponibles
        this.availableEmployees = profiles.map(profile => ({
          id: profile.employeeId,
          name: profile.employeeName || `Employé ${profile.employeeId}`,
          role: profile.specialities?.[0]?.name || 'Développeur'
        }));
        
        console.log('🔍 AvailableEmployees après mapping:');
        this.availableEmployees.slice(0, 3).forEach((emp, index) => {
          console.log(`  - ${index}: ID=${emp.id}, Name=${emp.name}`);
        });
        
        // Extraire toutes les compétences uniques
        const allSkills = new Set<string>();
        profiles.forEach(profile => {
          profile.skills.forEach(skill => {
            allSkills.add(skill.name);
          });
        });
        this.availableSkills = Array.from(allSkills).sort();
        
        console.log('Employés disponibles:', this.availableEmployees);
        console.log('Compétences disponibles:', this.availableSkills);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des données employés:', error);
        // En cas d'erreur, utiliser les données par défaut
        this.availableEmployees = [
          { id: 1, name: 'Jean Dupont', role: 'Développeur Senior' },
          { id: 2, name: 'Marie Martin', role: 'Développeur Frontend' },
          { id: 3, name: 'Pierre Durand', role: 'Développeur Backend' }
        ];
        this.availableSkills = [
          'JavaScript', 'TypeScript', 'React', 'Node.js', 'Docker', 'MySQL'
        ];
      }
    });
  }

  private initializeForm() {
    this.projectForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      duration: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
      objectives: this.fb.array([]),
      availableEmployees: [[]],
      tasks: this.fb.array([])
    });
  }

  get objectivesArray(): FormArray {
    return this.projectForm.get('objectives') as FormArray;
  }

  get tasksArray(): FormArray {
    return this.projectForm.get('tasks') as FormArray;
  }

  addObjective() {
    const objectiveGroup = this.fb.group({
      description: ['Objectif du projet', Validators.required]
    });
    this.objectivesArray.push(objectiveGroup);
  }

  removeObjective(index: number) {
    this.objectivesArray.removeAt(index);
  }

  addTask() {
    const taskGroup = this.fb.group({
      title: ['Nouvelle tâche', Validators.required],
      description: ['Description de la tâche', Validators.required],
      estimatedHours: [8, [Validators.required, Validators.min(1)]],
      priority: ['medium', Validators.required],
      requirements: this.fb.array([])
    });
    
    this.tasksArray.push(taskGroup);
  }

  removeTask(index: number) {
    this.tasksArray.removeAt(index);
  }

  getTaskRequirements(taskIndex: number): FormArray {
    return this.tasksArray.at(taskIndex).get('requirements') as FormArray;
  }

  // Obtenir le contrôle direct pour éviter les problèmes de formArrayName imbriqués
  getTaskRequirementControl(taskIndex: number, reqIndex: number, controlName: string) {
    return this.tasksArray.at(taskIndex).get(['requirements', reqIndex, controlName]);
  }

  addTaskRequirement(taskIndex: number) {
    const requirementGroup = this.fb.group({
      skillName: ['', Validators.required],
      requiredLevel: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      importance: ['medium', Validators.required]
    });
    
    this.getTaskRequirements(taskIndex).push(requirementGroup);
  }

  removeTaskRequirement(taskIndex: number, requirementIndex: number) {
    this.getTaskRequirements(taskIndex).removeAt(requirementIndex);
  }

  // Supprimer les requirements vides (sans skillName)
  clearEmptyRequirements(taskIndex: number) {
    const requirements = this.getTaskRequirements(taskIndex);
    console.log(`🧹 Nettoyage des requirements pour la tâche ${taskIndex}. Avant: ${requirements.length} requirements`);
    
    // Trouver les indices des requirements vides à supprimer
    const indicesToRemove: number[] = [];
    requirements.controls.forEach((req, index) => {
      if (!req.value.skillName || req.value.skillName.trim() === '') {
        indicesToRemove.push(index);
      }
    });
    
    // Supprimer en partant de la fin pour éviter les problèmes d'indices
    indicesToRemove.reverse().forEach(index => {
      requirements.removeAt(index);
      console.log(`  - Supprimé requirement ${index} (skillName vide)`);
    });
    
    console.log(`✅ Requirements nettoyés pour la tâche ${taskIndex}. ${requirements.length} requirements restants.`);
  }

  simulateProject() {
    console.log('🔍 Validation du formulaire de simulation...');
    console.log('Formulaire valide:', this.projectForm.valid);
    console.log('Valeurs du formulaire:', this.projectForm.value);
    console.log('Nombre de tâches:', this.tasksArray.length);
    console.log('Nombre d\'objectifs:', this.objectivesArray.length);
    console.log('Employés sélectionnés:', this.projectForm.value.availableEmployees);
    
    // Vérifier chaque champ individuellement
    console.log('🔍 Validation des champs individuels:');
    console.log('  - name:', this.projectForm.get('name')?.valid, 'valeur:', this.projectForm.get('name')?.value);
    console.log('  - description:', this.projectForm.get('description')?.valid, 'valeur:', this.projectForm.get('description')?.value);
    console.log('  - duration:', this.projectForm.get('duration')?.valid, 'valeur:', this.projectForm.get('duration')?.value);
    console.log('  - availableEmployees:', this.projectForm.get('availableEmployees')?.valid, 'valeur:', this.projectForm.get('availableEmployees')?.value);
    console.log('  - objectives:', this.objectivesArray.valid, 'nombre:', this.objectivesArray.length);
    console.log('  - tasks:', this.tasksArray.valid, 'nombre:', this.tasksArray.length);
    
    // Vérifier chaque tâche individuellement
    console.log('🔍 Validation des tâches individuelles:');
    this.tasksArray.controls.forEach((task, index) => {
      console.log(`  - Tâche ${index}:`, task.valid, 'valeurs:', task.value);
      console.log(`    - title:`, task.get('title')?.valid, 'valeur:', task.get('title')?.value);
      console.log(`    - description:`, task.get('description')?.valid, 'valeur:', task.get('description')?.value);
      console.log(`    - estimatedHours:`, task.get('estimatedHours')?.valid, 'valeur:', task.get('estimatedHours')?.value);
      console.log(`    - priority:`, task.get('priority')?.valid, 'valeur:', task.get('priority')?.value);
      console.log(`    - requirements:`, task.get('requirements')?.valid, 'nombre:', (task.get('requirements') as FormArray)?.length);
      
      // Vérifier chaque requirement individuellement
      const requirementsArray = task.get('requirements') as FormArray;
      if (requirementsArray && requirementsArray.length > 0) {
        requirementsArray.controls.forEach((req, reqIndex) => {
          console.log(`      - Requirement ${reqIndex}:`, req.valid, 'valeurs:', req.value);
          console.log(`        - skillName:`, req.get('skillName')?.valid, 'valeur:', req.get('skillName')?.value);
          console.log(`        - requiredLevel:`, req.get('requiredLevel')?.valid, 'valeur:', req.get('requiredLevel')?.value);
          console.log(`        - importance:`, req.get('importance')?.valid, 'valeur:', req.get('importance')?.value);
        });
      }
    });
    
    // Vérifier les erreurs de chaque champ
    console.log('🔍 Erreurs des champs:');
    console.log('  - name errors:', this.projectForm.get('name')?.errors);
    console.log('  - description errors:', this.projectForm.get('description')?.errors);
    console.log('  - duration errors:', this.projectForm.get('duration')?.errors);
    console.log('  - availableEmployees errors:', this.projectForm.get('availableEmployees')?.errors);
    
    if (this.projectForm.invalid) {
      console.log('❌ Formulaire invalide - erreurs:', this.projectForm.errors);
      const missingFields = [];
      if (!this.projectForm.get('name')?.valid) missingFields.push('Nom du projet');
      if (!this.projectForm.get('description')?.valid) missingFields.push('Description');
      if (!this.projectForm.get('duration')?.valid) missingFields.push('Durée');
      if (!this.projectForm.get('availableEmployees')?.valid) missingFields.push('Équipe');
      
      alert(`Veuillez remplir les champs obligatoires: ${missingFields.join(', ')}`);
      return;
    }
    
    if (this.tasksArray.length === 0) {
      console.log('❌ Aucune tâche ajoutée');
      alert('Veuillez ajouter au moins une tâche au projet');
      return;
    }
    
    // Vérifier que toutes les tâches ont des requirements valides
    let hasInvalidRequirements = false;
    this.tasksArray.controls.forEach((task, index) => {
      const requirements = task.get('requirements') as FormArray;
      if (requirements.length > 0) {
        requirements.controls.forEach(req => {
          if (!req.valid) {
            hasInvalidRequirements = true;
            console.log(`❌ Requirement invalide dans la tâche ${index}:`, req.value);
          }
        });
      }
    });
    
    if (hasInvalidRequirements) {
      alert('Veuillez compléter toutes les compétences requises pour chaque tâche (supprimez les compétences vides ou complétez-les)');
      return;
    }
    
    if (this.objectivesArray.length === 0) {
      console.log('❌ Aucun objectif ajouté');
      alert('Veuillez ajouter au moins un objectif au projet');
      return;
    }
    
    console.log('✅ Validation réussie - lancement de la simulation');

    this.loading = true;
    
    const projectData: ProjectSimulation = {
      id: Date.now(),
      name: this.projectForm.value.name,
      description: this.projectForm.value.description,
      duration: this.projectForm.value.duration,
      objectives: this.projectForm.value.objectives.map((obj: any) => obj.description),
      availableEmployees: this.projectForm.value.availableEmployees,
      tasks: this.formatTasks(this.projectForm.value.tasks),
      generatedPlan: null as any
    };

    this.iaService.simulateProject(projectData).subscribe({
      next: (simulation) => {
        console.log('✅ Simulation terminée avec succès!');
        console.log('📊 Données brutes reçues:', simulation);
        console.log('📊 Type de simulation:', typeof simulation);
        console.log('📊 Clés de simulation:', Object.keys(simulation));
        
        // Les données sont directement dans simulation, pas dans simulation.data
        const results = simulation;
        console.log('📊 Données de simulation:', results);
        
        console.log('📊 Résumé des résultats:');
        console.log(`  - ${results?.taskAssignments?.length || 0} tâches assignées`);
        console.log(`  - Risque: ${results?.riskLevel}`);
        console.log(`  - Date de fin: ${results?.estimatedCompletion}`);
        console.log(`  - Recommandations:`, results?.recommendations);
        
        if (results?.debugInfo) {
          console.log('🔍 Debug info:');
          console.log(`  - Total tâches: ${results.debugInfo.totalTasks}`);
          console.log(`  - Total employés: ${results.debugInfo.totalEmployees}`);
          console.log(`  - Total assignations: ${results.debugInfo.totalAssignations}`);
        }
        
        this.simulationResult = results;
        this.showResults = true;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors de la simulation:', error);
        this.loading = false;
        alert('Erreur lors de la simulation du projet');
      }
    });
  }

  // --- NOUVELLES METHODES POUR LE PDF ---

  setMode(mode: 'pdf' | 'manual') {
    this.activeMode = mode;
    this.showResults = false;
    this.simulationResult = null;
    this.generatedProjectData = null;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
    } else {
      alert('Veuillez sélectionner un fichier PDF valide.');
      this.selectedFile = null;
    }
  }

  simulateFromPdf() {
    if (!this.selectedFile) {
      alert('Veuillez sélectionner un fichier PDF d\'abord.');
      return;
    }

    this.loading = true;
    this.showResults = false;

    this.iaService.simulateProjectFromPdf(this.selectedFile).subscribe({
      next: (projectData) => {
        console.log('✅ Plan généré par IA depuis le PDF:', projectData);
        this.generatedProjectData = projectData;
        this.showResults = true;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur IA PDF:', error);
        this.loading = false;
        alert('Erreur lors de l\'analyse du PDF par l\'IA.');
      }
    });
  }

  confirmGeneratedProject() {
    if (!this.generatedProjectData) return;

    this.confirming = true;
    
    // Essayer de récupérer l'ID du manager
    let managerId = 1;
    try {
      const currentManagerStr = localStorage.getItem('currentManager');
      if (currentManagerStr) {
        managerId = JSON.parse(currentManagerStr).id;
      }
    } catch(e) {}

    this.iaService.confirmGeneratedProject(this.generatedProjectData, managerId).subscribe({
      next: (response) => {
        console.log('✅ Projet créé avec succès:', response);
        this.confirming = false;
        alert('Projet confirmé et créé avec succès !');
        this.showResults = false;
        this.generatedProjectData = null;
        this.selectedFile = null;
      },
      error: (error) => {
        console.error('Erreur confirmation projet:', error);
        this.confirming = false;
        alert('Erreur lors de la création du projet.');
      }
    });
  }

  private formatTasks(tasks: any[]): TaskWithRequirements[] {
    return tasks.map((task, index) => ({
      id: index + 1,
      title: task.title,
      description: task.description,
      requirements: task.requirements || [], // Utiliser un tableau vide si pas de requirements
      estimatedHours: task.estimatedHours,
      priority: task.priority,
      deadline: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 jours par défaut
    }));
  }

  resetForm() {
    this.projectForm.reset({
      name: '',
      description: '',
      duration: 30,
      availableEmployees: []
    });
    
    while (this.objectivesArray.length > 0) {
      this.objectivesArray.removeAt(0);
    }
    
    while (this.tasksArray.length > 0) {
      this.tasksArray.removeAt(0);
    }
    
    this.showResults = false;
    this.simulationResult = null;
  }

  // Méthodes utilitaires
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

  getRiskLevelColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      default: return '#6b7280';
    }
  }

  getRiskLevelLabel(riskLevel: string): string {
    switch (riskLevel) {
      case 'low': return 'Faible';
      case 'medium': return 'Moyen';
      case 'high': return 'Élevé';
      default: return riskLevel;
    }
  }

  // Formater les dates
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // Calculer la durée totale
  getTotalEstimatedHours(): number {
    return this.tasksArray.controls.reduce((total, task) => {
      return total + (task.value.estimatedHours || 0);
    }, 0);
  }

  // Obtenir le nom d'un employé
  getEmployeeName(employeeId: number): string {
    const employee = this.availableEmployees.find(emp => emp.id === employeeId);
    return employee ? employee.name : `Employé ${employeeId}`;
  }

  // Obtenir les détails d'un employé pour l'affichage
  getEmployeeDetails(employeeId: number): any {
    const employee = this.employeeProfiles.find(profile => profile.employeeId === employeeId);
    if (employee) {
      return {
        id: employee.employeeId,
        name: `Employé ${employee.employeeId}`, // Temporaire - à améliorer avec vrais noms
        skills: employee.skills.slice(0, 3), // Top 3 compétences
        overallScore: employee.overallScore
      };
    }
    return {
      id: employeeId,
      name: `Employé ${employeeId}`,
      skills: [],
      overallScore: 0
    };
  }

  // Vérifier si un employé est sélectionné
  isEmployeeSelected(employeeId: number): boolean {
    const selectedEmployees = this.projectForm.value.availableEmployees || [];
    return selectedEmployees.includes(employeeId);
  }

  // Obtenir le titre d'une tâche depuis son ID
  getTaskTitle(taskId: number): string {
    const tasks = this.projectForm.value.tasks || [];
    const task = tasks.find((t: any) => t.id === taskId);
    return task?.title || `Tâche ${taskId}`;
  }

  // Obtenir les compétences d'un employé
  getEmployeeSkills(employeeId: number): any[] {
    const employee = this.employeeProfiles.find(profile => profile.employeeId === employeeId);
    if (employee && employee.skills) {
      // Retourner les 5 meilleures compétences
      return employee.skills
        .sort((a, b) => b.level - a.level)
        .slice(0, 5);
    }
    return [];
  }

  // Obtenir les employés sélectionnés
  getSelectedEmployees(): any[] {
    const selectedIds = this.projectForm.value.availableEmployees || [];
    return this.availableEmployees.filter(emp => selectedIds.includes(emp.id));
  }

  // Obtenir les top compétences d'un employé
  getEmployeeTopSkills(employeeId: number, count: number): any[] {
    const employee = this.employeeProfiles.find(profile => profile.employeeId === employeeId);
    if (employee && employee.skills) {
      return employee.skills
        .sort((a, b) => b.level - a.level)
        .slice(0, count);
    }
    return [];
  }

  // Obtenir la durée d'une tâche
  getTaskDuration(taskId: number): number {
    const tasks = this.projectForm.value.tasks || [];
    const task = tasks.find((t: any) => t.id === taskId);
    return task?.estimatedHours || 8;
  }

  // Obtenir la priorité d'une tâche
  getTaskPriority(taskId: number): string {
    const tasks = this.projectForm.value.tasks || [];
    const task = tasks.find((t: any) => t.id === taskId);
    return task?.priority || 'medium';
  }

  toggleEmployeeSelection(employeeId: number) {
    const currentSelection = this.projectForm.value.availableEmployees || [];
    const index = currentSelection.indexOf(employeeId);
    
    if (index > -1) {
      currentSelection.splice(index, 1);
    } else {
      currentSelection.push(employeeId);
    }
    
    this.projectForm.patchValue({ availableEmployees: currentSelection });
  }
}

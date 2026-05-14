import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { SkillsService } from '../../services/skills.service';
import {
  EmployeeSkillsProfile,
  Skill,
  Technology,
  Speciality,
  SkillCategory,
  TECHNOLOGY_CATEGORIES
} from '../../models/skills.model';

@Component({
  selector: 'app-skills-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './skills-profile.component.html',
  styleUrls: ['./skills-profile.component.css']
})
export class SkillsProfileComponent implements OnInit {
  currentEmployeeId: number = 0;
  skillsProfile: EmployeeSkillsProfile | null = null;
  loading: boolean = false;
  saving: boolean = false;
  
  skillsForm!: FormGroup;
  technologiesForm!: FormGroup;
  specialitiesForm!: FormGroup;
  
  skillCategories = this.skillsService.getSkillCategories();
  technologyCategories = TECHNOLOGY_CATEGORIES;
  
  // États pour l'UI
  activeTab: 'skills' | 'technologies' | 'specialities' = 'skills';
  showAddSkillForm: boolean = false;
  showAddTechnologyForm: boolean = false;
  showAddSpecialityForm: boolean = false;
  
  editingSkill: Skill | null = null;
  editingTechnology: Technology | null = null;
  editingSpeciality: Speciality | null = null;

  constructor(
    private fb: FormBuilder,
    private skillsService: SkillsService
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.getCurrentEmployeeId();
    this.loadSkillsProfile();
  }

  private getCurrentEmployeeId() {
    const employeeData = localStorage.getItem('currentEmployee');
    if (employeeData) {
      const employee = JSON.parse(employeeData);
      this.currentEmployeeId = employee.id;
    }
  }

  private initializeForms() {
    // Formulaire pour les compétences
    this.skillsForm = this.fb.group({
      name: ['', Validators.required],
      category: ['technical', Validators.required],
      level: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      yearsExperience: [0, [Validators.required, Validators.min(0)]],
      validated: [false]
    });

    // Formulaire pour les technologies
    this.technologiesForm = this.fb.group({
      name: ['', Validators.required],
      category: ['frontend', Validators.required],
      proficiency: ['intermediate', Validators.required],
      projects: [0, [Validators.required, Validators.min(0)]]
    });

    // Formulaire pour les spécialités
    this.specialitiesForm = this.fb.group({
      name: ['', Validators.required],
      domain: ['', Validators.required],
      description: ['', Validators.required]
    });
  }

  loadSkillsProfile() {
    this.loading = true;
    this.skillsService.getEmployeeSkillsProfile(this.currentEmployeeId).subscribe({
      next: (profile) => {
        this.skillsProfile = profile;
        this.loading = false;
        console.log('Profil de compétences chargé depuis l\'API:', profile);
      },
      error: (error) => {
        console.error('Erreur lors du chargement du profil:', error);
        this.loading = false;
        // Utiliser des données mockées en cas d'erreur API
        this.loadMockSkillsProfile();
      }
    });
  }

  // Charger des données mockées pour démonstration
  private loadMockSkillsProfile() {
    this.skillsProfile = {
      employeeId: this.currentEmployeeId,
      skills: [
        {
          id: 1,
          name: 'JavaScript',
          category: 'technical',
          level: 4,
          yearsExperience: 3,
          validated: true,
          lastUsed: new Date()
        },
        {
          id: 2,
          name: 'React',
          category: 'technical',
          level: 4,
          yearsExperience: 2,
          validated: true,
          lastUsed: new Date()
        },
        {
          id: 3,
          name: 'Node.js',
          category: 'technical',
          level: 3,
          yearsExperience: 2,
          validated: false,
          lastUsed: new Date()
        }
      ],
      technologies: [
        {
          id: 1,
          name: 'Angular',
          category: 'frontend',
          proficiency: 'advanced',
          projects: 5
        },
        {
          id: 2,
          name: 'Docker',
          category: 'devops',
          proficiency: 'intermediate',
          projects: 2
        }
      ],
      specialities: [
        {
          id: 1,
          name: 'Développement Frontend',
          domain: 'Informatique',
          description: 'Spécialisé dans les applications web modernes avec React et Angular'
        }
      ],
      overallScore: 75,
      lastUpdated: new Date(),
      strengths: ['Expertise en JavaScript et React', 'Solide expérience en développement frontend'],
      improvementAreas: ['Améliorer les compétences backend', 'Valider plus de certifications']
    };
    console.log('Profil mocké chargé:', this.skillsProfile);
  }

  // Méthodes pour les compétences
  addSkill() {
    if (this.skillsForm.invalid) return;

    const skillData = {
      ...this.skillsForm.value,
      lastUsed: new Date()
    };

    if (this.editingSkill) {
      // Mettre à jour la compétence existante via l'API
      this.skillsService.updateSkill(this.currentEmployeeId, this.editingSkill.id, skillData).subscribe({
        next: () => {
          this.updateLocalSkill(this.editingSkill!.id, skillData);
          this.resetSkillForm();
          console.log('Compétence mise à jour via API:', skillData);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour:', error);
          // En cas d'erreur, mise à jour locale
          this.updateLocalSkill(this.editingSkill!.id, skillData);
          this.resetSkillForm();
        }
      });
    } else {
      // Ajouter via l'API
      this.skillsService.addSkill(this.currentEmployeeId, skillData).subscribe({
        next: (response) => {
          const newSkill = { id: response.id || Date.now(), ...skillData };
          this.skillsProfile?.skills.push(newSkill);
          this.resetSkillForm();
          console.log('Compétence ajoutée via API:', newSkill);
        },
        error: (error) => {
          console.error('Erreur lors de l\'ajout:', error);
          // En cas d'erreur, ajout local
          const newSkill = { id: Date.now(), ...skillData };
          this.skillsProfile?.skills.push(newSkill);
          this.resetSkillForm();
        }
      });
    }
  }

  updateLocalSkill(skillId: number, updates: any) {
    if (this.skillsProfile) {
      const skillIndex = this.skillsProfile.skills.findIndex(s => s.id === skillId);
      if (skillIndex !== -1) {
        this.skillsProfile.skills[skillIndex] = { ...this.skillsProfile.skills[skillIndex], ...updates };
      }
    }
  }

  editSkill(skill: Skill) {
    this.editingSkill = skill;
    this.skillsForm.patchValue({
      name: skill.name,
      category: skill.category,
      level: skill.level,
      yearsExperience: skill.yearsExperience,
      validated: skill.validated
    });
    this.showAddSkillForm = true;
  }

  deleteSkill(skillId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette compétence ?')) {
      // Supprimer localement
      if (this.skillsProfile) {
        this.skillsProfile.skills = this.skillsProfile.skills.filter(s => s.id !== skillId);
        console.log('Compétence supprimée localement:', skillId);
      }
    }
  }

  resetSkillForm() {
    this.skillsForm.reset({
      name: '',
      category: 'technical',
      level: 3,
      yearsExperience: 0,
      validated: false
    });
    this.editingSkill = null;
    this.showAddSkillForm = false;
  }

  // Méthodes pour les technologies
  addTechnology() {
    if (this.technologiesForm.invalid) return;

    const techData = this.technologiesForm.value;

    if (this.editingTechnology) {
      // Mettre à jour localement
      this.updateLocalTechnology(this.editingTechnology!.id, techData);
      this.resetTechnologyForm();
      console.log('Technologie mise à jour localement:', techData);
    } else {
      // Ajouter localement
      const newTech = { id: Date.now(), ...techData };
      this.skillsProfile?.technologies.push(newTech);
      this.resetTechnologyForm();
      console.log('Technologie ajoutée localement:', newTech);
    }
  }

  updateLocalTechnology(techId: number, updates: any) {
    if (this.skillsProfile) {
      const techIndex = this.skillsProfile.technologies.findIndex(t => t.id === techId);
      if (techIndex !== -1) {
        this.skillsProfile.technologies[techIndex] = { ...this.skillsProfile.technologies[techIndex], ...updates };
      }
    }
  }

  editTechnology(technology: Technology) {
    this.editingTechnology = technology;
    this.technologiesForm.patchValue(technology);
    this.showAddTechnologyForm = true;
  }

  deleteTechnology(techId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette technologie ?')) {
      // Supprimer localement
      if (this.skillsProfile) {
        this.skillsProfile.technologies = this.skillsProfile.technologies.filter(t => t.id !== techId);
        console.log('Technologie supprimée localement:', techId);
      }
    }
  }

  resetTechnologyForm() {
    this.technologiesForm.reset({
      name: '',
      category: 'frontend',
      proficiency: 'intermediate',
      projects: 0
    });
    this.editingTechnology = null;
    this.showAddTechnologyForm = false;
  }

  // Méthodes pour les spécialités
  addSpeciality() {
    if (this.specialitiesForm.invalid) return;

    const specialityData = this.specialitiesForm.value;

    if (this.editingSpeciality) {
      // Mise à jour locale pour l'instant
      this.updateLocalSpeciality(this.editingSpeciality.id, specialityData);
      this.resetSpecialityForm();
      console.log('Spécialité mise à jour localement:', specialityData);
    } else {
      // Ajouter localement
      const newSpeciality = { id: Date.now(), ...specialityData };
      this.skillsProfile?.specialities.push(newSpeciality);
      this.resetSpecialityForm();
      console.log('Spécialité ajoutée localement:', newSpeciality);
    }
  }

  updateLocalSpeciality(specialityId: number, updates: any) {
    if (this.skillsProfile) {
      const specialityIndex = this.skillsProfile.specialities.findIndex(s => s.id === specialityId);
      if (specialityIndex !== -1) {
        this.skillsProfile.specialities[specialityIndex] = { ...this.skillsProfile.specialities[specialityIndex], ...updates };
      }
    }
  }

  editSpeciality(speciality: Speciality) {
    this.editingSpeciality = speciality;
    this.specialitiesForm.patchValue(speciality);
    this.showAddSpecialityForm = true;
  }

  deleteSpeciality(specialityId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette spécialité ?')) {
      // Supprimer localement
      if (this.skillsProfile) {
        this.skillsProfile.specialities = this.skillsProfile.specialities.filter(s => s.id !== specialityId);
        console.log('Spécialité supprimée localement:', specialityId);
      }
    }
  }

  resetSpecialityForm() {
    this.specialitiesForm.reset({
      name: '',
      domain: '',
      description: ''
    });
    this.editingSpeciality = null;
    this.showAddSpecialityForm = false;
  }

  // Sauvegarder tout le profil
  saveProfile() {
    if (!this.skillsProfile) return;

    this.saving = true;
    
    // Mettre à jour le score global et l'analyse
    this.skillsProfile.overallScore = this.skillsService.calculateOverallScore(this.skillsProfile);
    const analysis = this.skillsService.analyzeProfile(this.skillsProfile);
    this.skillsProfile.strengths = analysis.strengths;
    this.skillsProfile.improvementAreas = analysis.improvementAreas;
    this.skillsProfile.lastUpdated = new Date();

    // Pour l'instant, sauvegarder localement
    console.log('Profil sauvegardé localement:', this.skillsProfile);
    this.saving = false;
    alert('Profil de compétences sauvegardé localement avec succès !');
    
    // TODO: Activer quand l'API backend sera prête
    // this.skillsService.saveEmployeeSkillsProfile(this.skillsProfile).subscribe({...});
  }

  // Utilitaires
  getLevelLabel(level: number): string {
    const labels = ['', 'Débutant', 'Intermédiaire', 'Compétent', 'Avancé', 'Expert'];
    return labels[level] || '';
  }

  getProficiencyLabel(proficiency: string): string {
    const labels = {
      'basic': 'Base',
      'intermediate': 'Intermédiaire',
      'advanced': 'Avancé',
      'expert': 'Expert'
    };
    return labels[proficiency as keyof typeof labels] || proficiency;
  }

  getLevelColor(level: number): string {
    const colors = ['', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];
    return colors[level] || '#6b7280';
  }

  getProficiencyColor(proficiency: string): string {
    const colors = {
      'basic': '#ef4444',
      'intermediate': '#f59e0b',
      'advanced': '#eab308',
      'expert': '#10b981'
    };
    return colors[proficiency as keyof typeof colors] || '#6b7280';
  }
}

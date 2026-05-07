export interface Skill {
  id: number;
  name: string;
  category: 'technical' | 'soft' | 'language' | 'certification';
  level: 1 | 2 | 3 | 4 | 5; // 1: Débutant, 5: Expert
  yearsExperience: number;
  lastUsed?: Date;
  validated: boolean;
}

export interface Technology {
  id: number;
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'mobile' | 'ai' | 'other';
  proficiency: 'basic' | 'intermediate' | 'advanced' | 'expert';
  projects: number;
}

export interface Speciality {
  id: number;
  name: string;
  domain: string;
  description: string;
}

export interface EmployeeSkillsProfile {
  employeeId: number;
  skills: Skill[];
  technologies: Technology[];
  specialities: Speciality[];
  overallScore: number;
  lastUpdated: Date;
  strengths: string[];
  improvementAreas: string[];
}

export interface TaskRequirement {
  skillId: number;
  skillName: string;
  requiredLevel: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface TaskWithRequirements {
  id: number;
  title: string;
  description: string;
  requirements: TaskRequirement[];
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high';
  deadline: Date;
}

export interface TimelineItem {
  taskId: number;
  taskTitle: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  priority: 'low' | 'medium' | 'high';
}

export interface EmployeeMatch {
  employeeId: number;
  employeeName: string;
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  availability: number;
  workload: number;
  recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
}

export interface ProjectSimulation {
  id: number;
  name: string;
  description: string;
  duration: number; // en jours
  objectives: string[];
  availableEmployees: number[];
  tasks: TaskWithRequirements[];
  generatedPlan: {
    timeline: TimelineItem[];
    taskAssignments: { taskId: number; employeeId: number }[];
    estimatedCompletion: Date;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
}

export interface SkillCategory {
  id: string;
  name: string;
  description: string;
  skills: string[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: 'technical',
    name: 'Compétences Techniques',
    description: 'Langages de programmation, frameworks, outils',
    skills: ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Angular', 'Node.js', 'Docker']
  },
  {
    id: 'soft',
    name: 'Compétences Douces',
    description: 'Communication, leadership, gestion de projet',
    skills: ['Communication', 'Leadership', 'Gestion de projet', 'Travail d\'équipe', 'Résolution de problèmes']
  },
  {
    id: 'language',
    name: 'Langues',
    description: 'Compétences linguistiques',
    skills: ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Italien']
  },
  {
    id: 'certification',
    name: 'Certifications',
    description: 'Certifications professionnelles',
    skills: ['PMP', 'Scrum Master', 'AWS', 'Azure', 'Google Cloud', 'ISTQB']
  }
];

export const TECHNOLOGY_CATEGORIES = [
  { id: 'frontend', name: 'Frontend', examples: ['React', 'Angular', 'Vue.js', 'HTML/CSS'] },
  { id: 'backend', name: 'Backend', examples: ['Node.js', 'Python', 'Java', 'PHP', '.NET'] },
  { id: 'database', name: 'Base de données', examples: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis'] },
  { id: 'devops', name: 'DevOps', examples: ['Docker', 'Kubernetes', 'Jenkins', 'GitLab CI'] },
  { id: 'mobile', name: 'Mobile', examples: ['React Native', 'Flutter', 'Swift', 'Kotlin'] },
  { id: 'ai', name: 'IA/ML', examples: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'OpenAI'] },
  { id: 'other', name: 'Autre', examples: ['Autres technologies'] }
];

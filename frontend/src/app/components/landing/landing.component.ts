import { Component, OnInit, HostListener } from '@angular/core';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {

  isScrolled = false;

  company = {
    name: 'SIT',
    tagline: 'Pilotez votre entreprise. En un seul endroit.',
    description: 'La plateforme ERP conçue pour les équipes modernes — gestion de projets, tâches, temps, réunions et documents, unifiés dans une interface fluide et intelligente.',
    
  };

  features = [
    {
      title: 'Centralisation totale',
      description: 'Tous vos projets, équipes et données en un seul tableau de bord unifié et accessible à tout moment.',
      icon: 'bi-layers-fill',
      accent: '#7C74FF'
    },
    {
      title: 'Collaboration en temps réel',
      description: 'Assignation de tâches, suivi d\'avancement et commentaires partagés entre les membres de l\'équipe.',
      icon: 'bi-people-fill',
      accent: '#00CFAA'
    },
    {
      title: 'Sécurité & Contrôle d\'accès',
      description: 'Gestion granulaire des permissions par rôle : Admin, Manager et Employé avec authentification sécurisée.',
      icon: 'bi-shield-lock-fill',
      accent: '#FB7185'
    },
    {
      title: 'Analytics & Rapports',
      description: 'Timesheets, statistiques de projets et dashboards pour des décisions éclairées et un suivi précis.',
      icon: 'bi-bar-chart-line-fill',
      accent: '#F59E0B'
    }
  ];

  modules = [
    {
      name: 'Utilisateurs & Rôles',
      description: 'Authentification sécurisée, gestion des rôles Admin, Manager, Employé et permissions granulaires.',
      icon: 'bi-person-badge-fill',
      tag: 'Sécurité'
    },
    {
      name: 'Gestion des Projets',
      description: 'Création, suivi d\'état et attribution des membres à chaque projet de l\'entreprise.',
      icon: 'bi-kanban-fill',
      tag: 'Core'
    },
    {
      name: 'Gestion des Tâches',
      description: 'Kanban avec priorités, statuts To Do / In Progress / Done et dates limites.',
      icon: 'bi-check2-square',
      tag: 'Productivité'
    },
    {
      name: 'Diagramme de Gantt',
      description: 'Planification visuelle de vos projets avec gestion des dépendances entre tâches.',
      icon: 'bi-calendar3-range',
      tag: 'Planification'
    },
    {
      name: 'Timesheet',
      description: 'Enregistrement des heures de travail et rapports détaillés par utilisateur ou par projet.',
      icon: 'bi-clock-history',
      tag: 'RH'
    },
    {
      name: 'Réunions',
      description: 'Planification, gestion des participants, agenda et prise de notes centralisés.',
      icon: 'bi-camera-video-fill',
      tag: 'Collaboration'
    },
    {
      name: 'Documents',
      description: 'Upload, partage et organisation des fichiers par projet avec accès sécurisé.',
      icon: 'bi-folder2-open',
      tag: 'Stockage'
    },
    {
      name: 'Dashboard',
      description: 'Statistiques globales, tâches en cours, terminées et activité des équipes en temps réel.',
      icon: 'bi-speedometer2',
      tag: 'Analytics'
    }
  ];

  stats = [
    { number: '8',   label: 'Modules intégrés',    suffix: '' },
    { number: '100', label: 'Uptime garanti',       suffix: '%' },
    { number: '3',   label: 'Rôles & permissions',  suffix: '' },
    { number: '24',  label: 'Accès continu',        suffix: '/7' }
  ];

  ngOnInit(): void {
    this.initScrollReveal();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 60;
  }

  private initScrollReveal(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    setTimeout(() => {
      const elements = document.querySelectorAll('.reveal');
      elements.forEach(el => observer.observe(el));
    }, 100);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  getTagColor(tag: string): string {
    const map: { [key: string]: string } = {
      'Sécurité':     '#FB7185',
      'Core':         '#7C74FF',
      'Productivité': '#00CFAA',
      'Planification':'#F59E0B',
      'RH':           '#F97316',
      'Collaboration':'#38BDF8',
      'Stockage':     '#86EFAC',
      'Analytics':    '#C084FC'
    };
    return map[tag] || '#7C74FF';
  }
}
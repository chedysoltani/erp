const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Obtenir tous les profils de compétences des employés
router.get('/employees/skills-profiles', async (req, res) => {
  try {
    console.log('📋 Requête pour obtenir les profils de compétences des employés');
    
    const query = `
      SELECT 
        u.id as employeeId,
        u.prenom,
        u.nom,
        CONCAT(u.prenom, ' ', u.nom) as employeeName,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', es.id,
            'name', es.name,
            'category', es.category,
            'level', es.level,
            'yearsExperience', es.years_experience,
            'validated', es.validated,
            'lastUsed', es.last_used
          )
        ) as skills,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', et.id,
            'name', et.name,
            'category', et.category,
            'proficiency', et.proficiency,
            'projects', et.projects
          )
        ) FROM employee_technologies et WHERE et.employee_id = u.id) as technologies,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', esp.id,
            'name', esp.name,
            'domain', esp.domain,
            'description', esp.description
          )
        ) FROM employee_specialities esp WHERE esp.employee_id = u.id) as specialities
      FROM users u
      LEFT JOIN employee_skills es ON u.id = es.employee_id
      WHERE u.role = 'employee'
      GROUP BY u.id, u.prenom, u.nom
      ORDER BY u.prenom, u.nom
    `;
    
    const results = await db.query(query);
    
    // Calculer le score global pour chaque employé
    const profiles = results.map(employee => {
      const skills = employee.skills ? (typeof employee.skills === 'string' ? JSON.parse(employee.skills) : employee.skills) : [];
      const technologies = employee.technologies ? (typeof employee.technologies === 'string' ? JSON.parse(employee.technologies) : employee.technologies) : [];
      const specialities = employee.specialities ? (typeof employee.specialities === 'string' ? JSON.parse(employee.specialities) : employee.specialities) : [];
      
      // Calculer le score global basé sur les compétences
      let totalScore = 0;
      let skillCount = 0;
      
      skills.forEach(skill => {
        if (skill.validated) {
          totalScore += skill.level * 20; // 20 points par niveau validé
          skillCount++;
        }
      });
      
      const overallScore = skillCount > 0 ? Math.min(totalScore / (skillCount * 100) * 100, 100) : 0;
      
      return {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        skills: skills,
        technologies: technologies,
        specialities: specialities,
        overallScore: Math.round(overallScore),
        lastUpdated: new Date(),
        strengths: skills.filter(s => s.level >= 4).map(s => s.name),
        improvementAreas: skills.filter(s => s.level <= 2).map(s => s.name)
      };
    });
    
    console.log(`✅ ${profiles.length} profils d'employés trouvés`);
    
    res.json({
      success: true,
      data: profiles,
      count: profiles.length
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des profils:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des profils de compétences',
      details: error.message
    });
  }
});

// Obtenir les recommandations d'employés pour une tâche spécifique
router.post('/recommendations/task', async (req, res) => {
  try {
    console.log('🎯 Requête de recommandations pour une tâche');
    const task = req.body;
    console.log('📋 Tâche reçue:', task);
    
    // Récupérer tous les employés avec leurs compétences
    const employeeProfilesQuery = `
      SELECT 
        u.id as employeeId,
        CONCAT(u.prenom, ' ', u.nom) as employeeName,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'name', es.name,
            'level', es.level,
            'validated', es.validated
          )
        ) as skills
      FROM users u
      LEFT JOIN employee_skills es ON u.id = es.employee_id
      WHERE u.role = 'employee'
      GROUP BY u.id, u.prenom, u.nom
    `;
    
    const employeeResults = await db.query(employeeProfilesQuery);
    
    // Calculer les scores de matching pour chaque employé
    const recommendations = employeeResults.map(employee => {
      const skills = employee.skills ? (typeof employee.skills === 'string' ? JSON.parse(employee.skills) : employee.skills) : [];
      const matchingSkills = [];
      const missingSkills = [];
      let totalScore = 0;
      let maxScore = 0;
      
      console.log(`👤 Analyse employé ${employee.employeeName}:`, skills);
      
      task.requirements.forEach(requirement => {
        const employeeSkill = skills.find(s => s.name === requirement.skillName);
        const importanceWeight = requirement.importance === 'critical' ? 30 : 
                               requirement.importance === 'high' ? 20 : 
                               requirement.importance === 'medium' ? 10 : 5;
        maxScore += importanceWeight;
        
        if (employeeSkill) {
          const skillScore = Math.min(employeeSkill.level, requirement.requiredLevel) / requirement.requiredLevel;
          totalScore += skillScore * importanceWeight;
          matchingSkills.push(requirement.skillName);
          console.log(`  ✅ ${requirement.skillName}: niveau ${employeeSkill.level}/${requirement.requiredLevel} = ${skillScore * importanceWeight} points`);
        } else {
          missingSkills.push(requirement.skillName);
          console.log(`  ❌ ${requirement.skillName}: non trouvé`);
        }
      });
      
      const matchScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      
      // Déterminer la recommandation
      let recommendation;
      if (matchScore >= 80) recommendation = 'highly_recommended';
      else if (matchScore >= 60) recommendation = 'recommended';
      else if (matchScore >= 40) recommendation = 'consider';
      else recommendation = 'not_recommended';
      
      // Simuler disponibilité et charge de travail (à remplacer par de vraies données)
      const availability = Math.max(100 - (matchScore < 60 ? 30 : matchScore < 80 ? 20 : 10), 20);
      const workload = 100 - availability;
      
      const result = {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        matchScore,
        matchingSkills,
        missingSkills,
        availability,
        workload,
        recommendation
      };
      
      console.log(`  📊 Score final: ${matchScore}% - ${recommendation}`);
      return result;
    }).filter(rec => rec.matchScore > 0); // Filtrer les employés avec un score > 0
    
    // Trier par score de matching
    recommendations.sort((a, b) => b.matchScore - a.matchScore);
    
    console.log(`✅ ${recommendations.length} recommandations générées`);
    console.log('🏆 Meilleure recommandation:', recommendations[0]);
    
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
      taskAnalyzed: task.title
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération des recommandations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération des recommandations',
      details: error.message
    });
  }
});

// Simuler un projet avec IA
router.post('/simulate-project', async (req, res) => {
  try {
    console.log('🏗️ Requête de simulation de projet');
    const project = req.body;
    
    // Simulation simple de timeline
    const timeline = [];
    const daysPerTask = Math.floor(project.duration / project.tasks.length);
    
    project.tasks.forEach((task, index) => {
      const startDay = index * daysPerTask;
      const endDay = Math.min((index + 1) * daysPerTask, project.duration);
      
      timeline.push({
        taskId: task.id,
        taskTitle: task.title,
        startDate: new Date(Date.now() + (startDay * 24 * 60 * 60 * 1000)),
        endDate: new Date(Date.now() + (endDay * 24 * 60 * 60 * 1000)),
        duration: endDay - startDay,
        priority: task.priority
      });
    });
    
    // Simulation des assignations de tâches
    const taskAssignments = project.tasks.map(task => ({
      taskId: task.id,
      employeeId: project.availableEmployees[0] || 1
    }));
    
    // Calcul du niveau de risque
    let riskScore = 0;
    if (project.duration > 60) riskScore += 2;
    else if (project.duration > 30) riskScore += 1;
    
    if (project.tasks.length > 20) riskScore += 2;
    else if (project.tasks.length > 10) riskScore += 1;
    
    const highComplexityTasks = project.tasks.filter(task => 
      task.requirements.some(req => req.importance === 'critical')
    ).length;
    
    if (highComplexityTasks > 5) riskScore += 2;
    else if (highComplexityTasks > 2) riskScore += 1;
    
    let riskLevel;
    if (riskScore >= 4) riskLevel = 'high';
    else if (riskScore >= 2) riskLevel = 'medium';
    else riskLevel = 'low';
    
    // Générer des recommandations
    const recommendations = [];
    if (riskLevel === 'high') {
      recommendations.push('Considérez diviser le projet en plusieurs phases plus petites');
      recommendations.push('Prévoyez des points de contrôle réguliers');
    } else if (riskLevel === 'medium') {
      recommendations.push('Surveillez attentivement le progrès hebdomadaire');
    } else {
      recommendations.push('Le projet semble réalisable dans les délais prévus');
    }
    
    const simulationResult = {
      timeline,
      taskAssignments,
      estimatedCompletion: new Date(Date.now() + (project.duration * 24 * 60 * 60 * 1000)),
      riskLevel,
      recommendations
    };
    
    console.log('✅ Simulation de projet terminée');
    
    res.json({
      success: true,
      data: simulationResult
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la simulation du projet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la simulation du projet',
      details: error.message
    });
  }
});

module.exports = router;

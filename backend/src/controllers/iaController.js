const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class IAController {
  static async simulateProjectFromPdf(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier PDF fourni.' });
      }

      // Lire le contenu du PDF
      const dataBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(dataBuffer);
      const pdfText = data.text;

      // Nettoyer le fichier une fois lu
      fs.unlinkSync(req.file.path);

      if (!pdfText || pdfText.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Le fichier PDF est vide ou illisible.' });
      }

      // Initialiser le modèle Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
Tu es un assistant IA intégré dans un ERP intelligent de gestion de projets.
Ton rôle est d’analyser un cahier de charge fourni et de générer automatiquement un planning professionnel et structuré pour le projet.

Voici le contenu extrait du cahier des charges :
"""
${pdfText}
"""

À partir de ce cahier de charge, tu dois générer un planning structuré sous forme JSON UNIQUEMENT, strictement conforme au format ci-dessous.
N'ajoute AUCUN texte, explication ou bloc de code (comme \`\`\`json) en dehors de l'objet JSON. Le JSON doit être valide et prêt à être parsé.

FORMAT JSON ATTENDU :
{
  "projectName": "Nom du projet",
  "description": "Description courte",
  "duration": "Ex: 60 jours",
  "complexity": "faible | moyen | élevé",
  "phases": [
    {
      "name": "Nom de la phase",
      "description": "Description de la phase",
      "tasks": [
        {
          "title": "Titre de la tâche",
          "description": "Description détaillée",
          "estimatedTime": "Ex: 5 jours",
          "priority": "low | medium | high",
          "dependencies": ["Titre d'une autre tâche"],
          "role": "Rôle recommandé (ex: Frontend Developer)",
          "status": "not started"
        }
      ]
    }
  ],
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  }
}
`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Nettoyer la réponse pour s'assurer d'avoir un JSON valide
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.substring(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      cleanJson = cleanJson.trim();

      const projectData = JSON.parse(cleanJson);

      res.json({
        success: true,
        data: projectData
      });

    } catch (error) {
      console.error('Erreur lors de la simulation IA :', error);
      res.status(500).json({ success: false, message: 'Erreur lors de l\'analyse par l\'IA.', error: error.message });
    }
  }

  static async confirmProject(req, res) {
    try {
      const { projectData, manager_id } = req.body;

      if (!projectData || !projectData.projectName) {
        return res.status(400).json({ success: false, message: 'Données de projet invalides.' });
      }

      // Création du projet
      const startDate = projectData.timeline?.startDate || new Date().toISOString().split('T')[0];
      const endDate = projectData.timeline?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const projectInsert = await db.query(
        `INSERT INTO projects (name, description, team, priority, start_date, end_date, budget, manager_id, status, progress) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectData.projectName,
          projectData.description,
          'Équipe à définir',
          projectData.complexity === 'élevé' ? 'high' : projectData.complexity === 'moyen' ? 'medium' : 'low',
          startDate,
          endDate,
          0,
          manager_id || 1, // Manager par défaut si non fourni
          'active',
          0
        ]
      );

      const projectId = projectInsert.insertId;

      // Création des tâches "Non assignées"
      let createdTasks = 0;
      for (const phase of projectData.phases) {
        for (const task of phase.tasks) {
          await db.query(
            `INSERT INTO tasks (title, description, project_id, status, priority, due_date, progress, created_at, tags, creator_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
            [
              `[${phase.name}] ${task.title}`,
              task.description,
              projectId,
              'todo', // status
              task.priority,
              endDate, // Par défaut, on met la deadline du projet pour la tâche
              0, // progress
              JSON.stringify([task.role]), // on garde le rôle dans les tags
              manager_id || 1 // creator_id
            ]
          );
          createdTasks++;
        }
      }

      res.json({
        success: true,
        message: `Projet créé avec succès avec ${createdTasks} tâches.`,
        data: { projectId }
      });

    } catch (error) {
      console.error('Erreur lors de la confirmation du projet :', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la création du projet.', error: error.message });
    }
  }
}

module.exports = IAController;

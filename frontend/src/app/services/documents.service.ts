import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ---------------------------------------------------------------
// NOTE : JWT/auth temporairement désactivé.
// Aucun header Authorization n'est envoyé.
// ---------------------------------------------------------------

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = `${environment.apiUrl}/documents`;

  constructor(private http: HttpClient) {}

  // ── Routes Manager ──────────────────────────────────────────

  /**
   * Upload un document (multipart/form-data).
   * Le FormData doit contenir : file, title, description, employeeId, uploadedBy (optionnel).
   */
  uploadDocument(formData: FormData): Observable<any> {
    // Pas de Content-Type explicite : HttpClient le gère automatiquement
    // pour multipart/form-data (boundary inclus).
    return this.http.post(this.apiUrl, formData);
  }

  getAllDocuments(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  updateDocument(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteDocument(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // ── Routes Employé ──────────────────────────────────────────

  /** Récupérer les documents assignés à un employé spécifique */
  getDocumentsByEmployee(employeeId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/employee/${employeeId}`);
  }

  /** Route legacy — passe employeeId en query param */
  getMyDocuments(employeeId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/my`, {
      params: { employeeId: employeeId.toString() }
    });
  }

  // ── Téléchargement ──────────────────────────────────────────

  /** Ouvre le fichier dans un nouvel onglet */
  downloadDocument(filePath: string): void {
    const base = environment.apiUrl.replace('/api', ''); // ex: http://localhost:3001
    const url = `${base}/${filePath}`;
    window.open(url, '_blank');
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    // Manager token takes priority — employees never have managerToken set
    const token = localStorage.getItem('managerToken') || localStorage.getItem('employeeToken') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── EMPLOYÉ ──────────────────────────────────────────────────────────────

  checkIn(employeeId: number): Observable<any> {
    return this.http.post(`${this.api}/attendance/employee/${employeeId}/checkin`, {}, { headers: this.headers() });
  }

  checkOut(employeeId: number): Observable<any> {
    return this.http.post(`${this.api}/attendance/employee/${employeeId}/checkout`, {}, { headers: this.headers() });
  }

  getTodayStatus(employeeId: number): Observable<any> {
    return this.http.get(`${this.api}/attendance/employee/${employeeId}/today`, { headers: this.headers() });
  }

  getHistory(employeeId: number, from?: string, to?: string): Observable<any> {
    let url = `${this.api}/attendance/employee/${employeeId}/history`;
    const params: string[] = [];
    if (from) params.push(`from=${from}`);
    if (to)   params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get(url, { headers: this.headers() });
  }

  requestLeave(employeeId: number, data: { type: string; start_date: string; end_date: string; reason?: string }): Observable<any> {
    return this.http.post(`${this.api}/attendance/employee/${employeeId}/leave`, data, { headers: this.headers() });
  }

  getMyLeaves(employeeId: number): Observable<any> {
    return this.http.get(`${this.api}/attendance/employee/${employeeId}/leaves`, { headers: this.headers() });
  }

  // ── MANAGER ──────────────────────────────────────────────────────────────

  getTeamAttendance(date?: string): Observable<any> {
    const q = date ? `?date=${date}` : '';
    return this.http.get(`${this.api}/attendance/team${q}`, { headers: this.headers() });
  }

  validateAttendance(recordId: number, note?: string): Observable<any> {
    return this.http.put(`${this.api}/attendance/records/${recordId}/validate`, { note }, { headers: this.headers() });
  }

  correctAttendance(recordId: number, data: any): Observable<any> {
    return this.http.put(`${this.api}/attendance/records/${recordId}/correct`, data, { headers: this.headers() });
  }

  getPendingLeaves(): Observable<any> {
    return this.http.get(`${this.api}/attendance/leaves/pending`, { headers: this.headers() });
  }

  respondLeave(requestId: number, status: 'approved' | 'rejected', note?: string): Observable<any> {
    return this.http.put(`${this.api}/attendance/leaves/${requestId}/respond`, { status, response_note: note }, { headers: this.headers() });
  }

  getMonthlyStats(year?: number, month?: number): Observable<any> {
    const params: string[] = [];
    if (year)  params.push(`year=${year}`);
    if (month) params.push(`month=${month}`);
    const q = params.length ? '?' + params.join('&') : '';
    return this.http.get(`${this.api}/attendance/stats/monthly${q}`, { headers: this.headers() });
  }
}

export interface Document {
  id: number;
  title: string;
  description: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: string | number;
  employee_id: number;
  employee_name?: string;
  uploaded_by: number;
  created_at: string;
  updated_at: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_prompt_logs: {
        Row: {
          correction_notes: string | null
          id: string
          model: string
          project_id: string
          prompt: string
          prompt_type: Database["public"]["Enums"]["ai_prompt_type"]
          response: string
          submission_id: string | null
          timestamp: string
          tokens_used: number | null
          validation_status: string | null
        }
        Insert: {
          correction_notes?: string | null
          id?: string
          model?: string
          project_id: string
          prompt: string
          prompt_type: Database["public"]["Enums"]["ai_prompt_type"]
          response: string
          submission_id?: string | null
          timestamp?: string
          tokens_used?: number | null
          validation_status?: string | null
        }
        Update: {
          correction_notes?: string | null
          id?: string
          model?: string
          project_id?: string
          prompt?: string
          prompt_type?: Database["public"]["Enums"]["ai_prompt_type"]
          response?: string
          submission_id?: string | null
          timestamp?: string
          tokens_used?: number | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_findings: {
        Row: {
          action: string
          action_type: Database["public"]["Enums"]["action_type"]
          calculation_result: Json | null
          created_at: string
          description: string
          evidence_pointer: string | null
          id: string
          impact_if_unresolved: string | null
          issue_id: string
          location: string | null
          name: string
          risk_explanation: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          standard_reference: string | null
          submission_id: string
          verification_method: string | null
          violated_requirement: string | null
        }
        Insert: {
          action: string
          action_type: Database["public"]["Enums"]["action_type"]
          calculation_result?: Json | null
          created_at?: string
          description: string
          evidence_pointer?: string | null
          id?: string
          impact_if_unresolved?: string | null
          issue_id: string
          location?: string | null
          name: string
          risk_explanation?: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          standard_reference?: string | null
          submission_id: string
          verification_method?: string | null
          violated_requirement?: string | null
        }
        Update: {
          action?: string
          action_type?: Database["public"]["Enums"]["action_type"]
          calculation_result?: Json | null
          created_at?: string
          description?: string
          evidence_pointer?: string | null
          id?: string
          impact_if_unresolved?: string | null
          issue_id?: string
          location?: string | null
          name?: string
          risk_explanation?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          standard_reference?: string | null
          submission_id?: string
          verification_method?: string | null
          violated_requirement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_findings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          content: string | null
          generated_at: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["deliverable_status"]
          storage_path: string | null
          submission_id: string
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          generated_at?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["deliverable_status"]
          storage_path?: string | null
          submission_id: string
          type: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          generated_at?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["deliverable_status"]
          storage_path?: string | null
          submission_id?: string
          type?: Database["public"]["Enums"]["deliverable_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_data: {
        Row: {
          cable_summary: Json | null
          created_at: string
          id: string
          inverter_parameters: Json | null
          layers: Json | null
          module_parameters: Json | null
          project_id: string
          pv_parameters: Json | null
          text_labels: Json | null
          updated_at: string
        }
        Insert: {
          cable_summary?: Json | null
          created_at?: string
          id?: string
          inverter_parameters?: Json | null
          layers?: Json | null
          module_parameters?: Json | null
          project_id: string
          pv_parameters?: Json | null
          text_labels?: Json | null
          updated_at?: string
        }
        Update: {
          cable_summary?: Json | null
          created_at?: string
          id?: string
          inverter_parameters?: Json | null
          layers?: Json | null
          module_parameters?: Json | null
          project_id?: string
          pv_parameters?: Json | null
          text_labels?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          job_type: string
          progress: number | null
          project_id: string
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          progress?: number | null
          project_id: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          progress?: number | null
          project_id?: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          file_type: Database["public"]["Enums"]["file_type"]
          id: string
          name: string
          project_id: string
          size: number
          source_reference: string | null
          status: Database["public"]["Enums"]["file_status"]
          storage_path: string | null
          uploaded_at: string
        }
        Insert: {
          file_type: Database["public"]["Enums"]["file_type"]
          id?: string
          name: string
          project_id: string
          size: number
          source_reference?: string | null
          status?: Database["public"]["Enums"]["file_status"]
          storage_path?: string | null
          uploaded_at?: string
        }
        Update: {
          file_type?: Database["public"]["Enums"]["file_type"]
          id?: string
          name?: string
          project_id?: string
          size?: number
          source_reference?: string | null
          status?: Database["public"]["Enums"]["file_status"]
          storage_path?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          location: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          system_type: Database["public"]["Enums"]["system_type"]
          updated_at: string
          use_project_specific_standards: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          system_type?: Database["public"]["Enums"]["system_type"]
          updated_at?: string
          use_project_specific_standards?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          system_type?: Database["public"]["Enums"]["system_type"]
          updated_at?: string
          use_project_specific_standards?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      standards_library: {
        Row: {
          category: Database["public"]["Enums"]["standard_category"]
          file_name: string
          file_size: number
          id: string
          is_global: boolean
          name: string
          project_id: string | null
          storage_path: string | null
          uploaded_at: string
          user_id: string
          version: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["standard_category"]
          file_name: string
          file_size: number
          id?: string
          is_global?: boolean
          name: string
          project_id?: string | null
          storage_path?: string | null
          uploaded_at?: string
          user_id: string
          version?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["standard_category"]
          file_name?: string
          file_size?: number
          id?: string
          is_global?: boolean
          name?: string
          project_id?: string | null
          storage_path?: string | null
          uploaded_at?: string
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standards_library_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          completed_at: string | null
          compliance_percentage: number | null
          id: string
          project_id: string
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          completed_at?: string | null
          compliance_percentage?: number | null
          id?: string
          project_id: string
          status?: string
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          completed_at?: string | null
          compliance_percentage?: number | null
          id?: string
          project_id?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_type: "corrective" | "recommendation"
      ai_prompt_type:
        | "extraction"
        | "calculation"
        | "compliance"
        | "optimization"
      deliverable_status: "not_generated" | "generated" | "updated"
      deliverable_type:
        | "ai_prompt_log"
        | "design_review_report"
        | "issue_register"
        | "compliance_checklist"
        | "recalculation_sheet"
        | "redline_notes"
        | "bom_boq"
        | "risk_reflection"
      file_status: "pending" | "processing" | "completed" | "error"
      file_type: "dwg" | "pdf" | "excel" | "datasheet" | "standard"
      project_status:
        | "draft"
        | "setup"
        | "analyzing"
        | "standards"
        | "reviewing"
        | "completed"
      severity_level: "critical" | "major" | "minor" | "pass"
      standard_category:
        | "IEC"
        | "SEC"
        | "SBC"
        | "SASO"
        | "MOMRA"
        | "SERA"
        | "WERA"
        | "NEC"
        | "OTHER"
      system_type: "standalone" | "on-grid" | "hybrid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_type: ["corrective", "recommendation"],
      ai_prompt_type: [
        "extraction",
        "calculation",
        "compliance",
        "optimization",
      ],
      deliverable_status: ["not_generated", "generated", "updated"],
      deliverable_type: [
        "ai_prompt_log",
        "design_review_report",
        "issue_register",
        "compliance_checklist",
        "recalculation_sheet",
        "redline_notes",
        "bom_boq",
        "risk_reflection",
      ],
      file_status: ["pending", "processing", "completed", "error"],
      file_type: ["dwg", "pdf", "excel", "datasheet", "standard"],
      project_status: [
        "draft",
        "setup",
        "analyzing",
        "standards",
        "reviewing",
        "completed",
      ],
      severity_level: ["critical", "major", "minor", "pass"],
      standard_category: [
        "IEC",
        "SEC",
        "SBC",
        "SASO",
        "MOMRA",
        "SERA",
        "WERA",
        "NEC",
        "OTHER",
      ],
      system_type: ["standalone", "on-grid", "hybrid"],
    },
  },
} as const

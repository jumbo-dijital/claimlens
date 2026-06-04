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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_assessments: {
        Row: {
          claim_id: string
          created_at: string
          feedback: string | null
          feedback_at: string | null
          feedback_by: string | null
          id: string
          model: string | null
          overall_confidence: number | null
          raw_json: Json | null
          summary: string | null
          version: number
        }
        Insert: {
          claim_id: string
          created_at?: string
          feedback?: string | null
          feedback_at?: string | null
          feedback_by?: string | null
          id?: string
          model?: string | null
          overall_confidence?: number | null
          raw_json?: Json | null
          summary?: string | null
          version?: number
        }
        Update: {
          claim_id?: string
          created_at?: string
          feedback?: string | null
          feedback_at?: string | null
          feedback_by?: string | null
          id?: string
          model?: string | null
          overall_confidence?: number | null
          raw_json?: Json | null
          summary?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_assessments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assessments_feedback_by_fkey"
            columns: ["feedback_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_line_items: {
        Row: {
          assessment_id: string
          confidence: number | null
          created_at: string
          damage_type: string
          edited_by: string | null
          evidence_image_id: string | null
          id: string
          is_deleted: boolean
          labour_cost: number
          labour_hours: number
          location: string
          part_cost: number
          rationale: string | null
          severity: string
          source: string
          suggested_repair: string
        }
        Insert: {
          assessment_id: string
          confidence?: number | null
          created_at?: string
          damage_type: string
          edited_by?: string | null
          evidence_image_id?: string | null
          id?: string
          is_deleted?: boolean
          labour_cost?: number
          labour_hours?: number
          location: string
          part_cost?: number
          rationale?: string | null
          severity?: string
          source?: string
          suggested_repair: string
        }
        Update: {
          assessment_id?: string
          confidence?: number | null
          created_at?: string
          damage_type?: string
          edited_by?: string | null
          evidence_image_id?: string | null
          id?: string
          is_deleted?: boolean
          labour_cost?: number
          labour_hours?: number
          location?: string
          part_cost?: number
          rationale?: string | null
          severity?: string
          source?: string
          suggested_repair?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_line_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ai_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_line_items_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_line_items_evidence_image_id_fkey"
            columns: ["evidence_image_id"]
            isOneToOne: false
            referencedRelation: "claim_images"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_persona_id: string | null
          actor_role: string | null
          actor_user_id: string | null
          claim_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_persona_id?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          claim_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_persona_id?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          claim_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_persona_id_fkey"
            columns: ["actor_persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_images: {
        Row: {
          ai_generated: boolean
          angle: string
          claim_id: string
          created_at: string
          id: string
          prompt: string | null
          quality_flag: string | null
          url: string
        }
        Insert: {
          ai_generated?: boolean
          angle?: string
          claim_id: string
          created_at?: string
          id?: string
          prompt?: string | null
          quality_flag?: string | null
          url: string
        }
        Update: {
          ai_generated?: boolean
          angle?: string
          claim_id?: string
          created_at?: string
          id?: string
          prompt?: string | null
          quality_flag?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_images_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          claim_number: string
          created_at: string
          current_agent_id: string | null
          current_reviewer_id: string | null
          damage_severity: string | null
          id: string
          image_angle_count: number | null
          image_model: string | null
          impact_area: string | null
          incident_date: string
          incident_description: string | null
          paint_color: string | null
          policy_number: string
          policyholder_name: string
          scene: string | null
          status: string
          updated_at: string
          vehicle_class: string
          vehicle_make: string
          vehicle_model: string
          vehicle_plate: string | null
          vehicle_year: number
        }
        Insert: {
          claim_number: string
          created_at?: string
          current_agent_id?: string | null
          current_reviewer_id?: string | null
          damage_severity?: string | null
          id?: string
          image_angle_count?: number | null
          image_model?: string | null
          impact_area?: string | null
          incident_date: string
          incident_description?: string | null
          paint_color?: string | null
          policy_number: string
          policyholder_name: string
          scene?: string | null
          status?: string
          updated_at?: string
          vehicle_class?: string
          vehicle_make: string
          vehicle_model: string
          vehicle_plate?: string | null
          vehicle_year: number
        }
        Update: {
          claim_number?: string
          created_at?: string
          current_agent_id?: string | null
          current_reviewer_id?: string | null
          damage_severity?: string | null
          id?: string
          image_angle_count?: number | null
          image_model?: string | null
          impact_area?: string | null
          incident_date?: string
          incident_description?: string | null
          paint_color?: string | null
          policy_number?: string
          policyholder_name?: string
          scene?: string | null
          status?: string
          updated_at?: string
          vehicle_class?: string
          vehicle_make?: string
          vehicle_model?: string
          vehicle_plate?: string | null
          vehicle_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "claims_current_agent_id_fkey"
            columns: ["current_agent_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_current_reviewer_id_fkey"
            columns: ["current_reviewer_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          avatar_color: string
          created_at: string
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          email: string
          id?: string
          name: string
          role: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_catalog: {
        Row: {
          base_labour_hours: number
          base_part_cost: number
          id: string
          labour_rate: number
          notes: string | null
          part_name: string
          vehicle_class: string
        }
        Insert: {
          base_labour_hours: number
          base_part_cost: number
          id?: string
          labour_rate?: number
          notes?: string | null
          part_name: string
          vehicle_class?: string
        }
        Update: {
          base_labour_hours?: number
          base_part_cost?: number
          id?: string
          labour_rate?: number
          notes?: string | null
          part_name?: string
          vehicle_class?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          claim_id: string
          comment: string | null
          created_at: string
          decision: string
          id: string
          reviewer_id: string | null
        }
        Insert: {
          claim_id: string
          comment?: string | null
          created_at?: string
          decision: string
          id?: string
          reviewer_id?: string | null
        }
        Update: {
          claim_id?: string
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "agent" | "adjuster" | "superadmin"
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
      app_role: ["agent", "adjuster", "superadmin"],
    },
  },
} as const

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
      access_requests: {
        Row: {
          agent_code: string
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          decided_at: string | null
          id: string
          purpose: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_code: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          decided_at?: string | null
          id?: string
          purpose?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_code?: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          decided_at?: string | null
          id?: string
          purpose?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_agent_code_fkey"
            columns: ["agent_code"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["code"]
          },
        ]
      }
      action_approvals: {
        Row: {
          action_draft_id: string
          approver_id: string
          created_at: string
          decision: string
          id: string
          note: string
        }
        Insert: {
          action_draft_id: string
          approver_id: string
          created_at?: string
          decision: string
          id?: string
          note?: string
        }
        Update: {
          action_draft_id?: string
          approver_id?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_approvals_action_draft_id_fkey"
            columns: ["action_draft_id"]
            isOneToOne: false
            referencedRelation: "action_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      action_drafts: {
        Row: {
          action_code: string
          agent_code: string | null
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          executed_at: string | null
          executed_by: string | null
          execution_result: Json | null
          id: string
          payload: Json
          requested_by: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_code: string
          agent_code?: string | null
          approver_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_result?: Json | null
          id?: string
          payload?: Json
          requested_by: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          action_code?: string
          agent_code?: string | null
          approver_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_result?: Json | null
          id?: string
          payload?: Json
          requested_by?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_drafts_action_code_fkey"
            columns: ["action_code"]
            isOneToOne: false
            referencedRelation: "sensitive_actions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "action_drafts_agent_code_fkey"
            columns: ["agent_code"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["code"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          agent_code: string
          allowed: boolean
          created_at: string
          division: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          agent_code: string
          allowed?: boolean
          created_at?: string
          division?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          agent_code?: string
          allowed?: boolean
          created_at?: string
          division?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_agent_code_fkey"
            columns: ["agent_code"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["code"]
          },
        ]
      }
      agent_user_grants: {
        Row: {
          access_request_id: string | null
          agent_code: string
          created_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          access_request_id?: string | null
          agent_code: string
          created_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          access_request_id?: string | null
          agent_code?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_user_grants_access_request_id_fkey"
            columns: ["access_request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_user_grants_agent_code_fkey"
            columns: ["agent_code"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["code"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_color: string
          avatar_url: string | null
          code: string
          created_at: string
          description: string
          division: string
          id: string
          is_active: boolean
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          avatar_url?: string | null
          code: string
          created_at?: string
          description?: string
          division?: string
          id?: string
          is_active?: boolean
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          avatar_url?: string | null
          code?: string
          created_at?: string
          description?: string
          division?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          access_request_id: string
          approver_id: string
          created_at: string
          decision: string
          id: string
          note: string
        }
        Insert: {
          access_request_id: string
          approver_id: string
          created_at?: string
          decision: string
          id?: string
          note?: string
        }
        Update: {
          access_request_id?: string
          approver_id?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_access_request_id_fkey"
            columns: ["access_request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          agent_code: string | null
          created_at: string
          data_scope: string
          detail: Json
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          agent_code?: string | null
          created_at?: string
          data_scope?: string
          detail?: Json
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          agent_code?: string | null
          created_at?: string
          data_scope?: string
          detail?: Json
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_code: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_code: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_code?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_code_fkey"
            columns: ["agent_code"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["code"]
          },
        ]
      }
      daily_snapshots: {
        Row: {
          created_at: string
          detail: Json
          id: string
          metric_key: string
          metric_value: number
          snapshot_date: string
          source_code: string
          unit: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          metric_key: string
          metric_value?: number
          snapshot_date: string
          source_code?: string
          unit?: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          metric_key?: string
          metric_value?: number
          snapshot_date?: string
          source_code?: string
          unit?: string
        }
        Relationships: []
      }
      data_classifications: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          classification: string
          code: string
          created_at: string
          data_as_of: string
          id: string
          is_demo: boolean
          name: string
          system: string
        }
        Insert: {
          classification?: string
          code: string
          created_at?: string
          data_as_of?: string
          id?: string
          is_demo?: boolean
          name: string
          system?: string
        }
        Update: {
          classification?: string
          code?: string
          created_at?: string
          data_as_of?: string
          id?: string
          is_demo?: boolean
          name?: string
          system?: string
        }
        Relationships: []
      }
      demo_attendance: {
        Row: {
          created_at: string
          employee_no: string
          id: string
          late_minutes: number
          note: string
          status: string
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_no: string
          id?: string
          late_minutes?: number
          note?: string
          status: string
          work_date: string
        }
        Update: {
          created_at?: string
          employee_no?: string
          id?: string
          late_minutes?: number
          note?: string
          status?: string
          work_date?: string
        }
        Relationships: []
      }
      demo_cash_positions: {
        Row: {
          account: string
          as_of_date: string
          balance: number
          created_at: string
          id: string
        }
        Insert: {
          account: string
          as_of_date: string
          balance?: number
          created_at?: string
          id?: string
        }
        Update: {
          account?: string
          as_of_date?: string
          balance?: number
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      demo_employees: {
        Row: {
          created_at: string
          division: string
          employee_no: string
          full_name: string
          id: string
          join_date: string
          position: string
          status: string
        }
        Insert: {
          created_at?: string
          division: string
          employee_no: string
          full_name: string
          id?: string
          join_date: string
          position: string
          status?: string
        }
        Update: {
          created_at?: string
          division?: string
          employee_no?: string
          full_name?: string
          id?: string
          join_date?: string
          position?: string
          status?: string
        }
        Relationships: []
      }
      demo_payables: {
        Row: {
          amount: number
          bill_no: string
          created_at: string
          due_date: string
          id: string
          status: string
          supplier: string
        }
        Insert: {
          amount?: number
          bill_no: string
          created_at?: string
          due_date: string
          id?: string
          status?: string
          supplier: string
        }
        Update: {
          amount?: number
          bill_no?: string
          created_at?: string
          due_date?: string
          id?: string
          status?: string
          supplier?: string
        }
        Relationships: []
      }
      demo_purchase_orders: {
        Row: {
          amount: number
          created_at: string
          eta_date: string | null
          id: string
          order_date: string
          po_no: string
          status: string
          supplier: string
        }
        Insert: {
          amount?: number
          created_at?: string
          eta_date?: string | null
          id?: string
          order_date: string
          po_no: string
          status?: string
          supplier: string
        }
        Update: {
          amount?: number
          created_at?: string
          eta_date?: string | null
          id?: string
          order_date?: string
          po_no?: string
          status?: string
          supplier?: string
        }
        Relationships: []
      }
      demo_receivables: {
        Row: {
          amount: number
          created_at: string
          customer: string
          due_date: string
          id: string
          invoice_no: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer: string
          due_date: string
          id?: string
          invoice_no: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer?: string
          due_date?: string
          id?: string
          invoice_no?: string
          status?: string
        }
        Relationships: []
      }
      demo_sales: {
        Row: {
          amount: number
          created_at: string
          customer: string
          id: string
          invoice_no: string
          order_date: string
          product: string
          sales_person: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer: string
          id?: string
          invoice_no: string
          order_date: string
          product?: string
          sales_person?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer?: string
          id?: string
          invoice_no?: string
          order_date?: string
          product?: string
          sales_person?: string
          status?: string
        }
        Relationships: []
      }
      demo_stock: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          product_name: string
          qty_on_hand: number
          sku: string
          uom: string
          warehouse: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_name: string
          qty_on_hand?: number
          sku: string
          uom?: string
          warehouse: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          product_name?: string
          qty_on_hand?: number
          sku?: string
          uom?: string
          warehouse?: string
        }
        Relationships: []
      }
      disciplinary_letters: {
        Row: {
          action_draft_id: string
          employee_no: string
          id: string
          issued_at: string
          issued_by: string
          letter_type: string
          reason: string
        }
        Insert: {
          action_draft_id: string
          employee_no: string
          id?: string
          issued_at?: string
          issued_by: string
          letter_type: string
          reason?: string
        }
        Update: {
          action_draft_id?: string
          employee_no?: string
          id?: string
          issued_at?: string
          issued_by?: string
          letter_type?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_letters_action_draft_id_fkey"
            columns: ["action_draft_id"]
            isOneToOne: false
            referencedRelation: "action_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          data_as_of: string
          id: string
          role: string
          sources: Json
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          data_as_of?: string
          id?: string
          role: string
          sources?: Json
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          data_as_of?: string
          id?: string
          role?: string
          sources?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          division: string
          full_name: string
          id: string
          language_pref: string
          theme_pref: string
        }
        Insert: {
          created_at?: string
          division?: string
          full_name?: string
          id: string
          language_pref?: string
          theme_pref?: string
        }
        Update: {
          created_at?: string
          division?: string
          full_name?: string
          id?: string
          language_pref?: string
          theme_pref?: string
        }
        Relationships: []
      }
      sensitive_actions: {
        Row: {
          approver_role: Database["public"]["Enums"]["app_role"]
          code: string
          created_at: string
          description: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          approver_role?: Database["public"]["Enums"]["app_role"]
          code: string
          created_at?: string
          description?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["app_role"]
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      build_daily_snapshot: { Args: { p_date?: string }; Returns: number }
      can_use_agent: {
        Args: { _agent_code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "CEO" | "Director" | "Manager" | "Supervisor" | "Staff" | "super_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["CEO", "Director", "Manager", "Supervisor", "Staff", "super_admin"],
    },
  },
} as const

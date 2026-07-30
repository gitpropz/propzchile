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
      bank_statement_imports: {
        Row: {
          account_number: string | null
          applied: boolean
          bank_name: string | null
          created_at: string
          file_name: string | null
          id: string
          matched_count: number
          notes: string | null
          organization_id: string
          period_month: number | null
          period_year: number | null
          raw_transactions: Json | null
          statement_downloaded_at: string
          transactions_count: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          account_number?: string | null
          applied?: boolean
          bank_name?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          matched_count?: number
          notes?: string | null
          organization_id: string
          period_month?: number | null
          period_year?: number | null
          raw_transactions?: Json | null
          statement_downloaded_at?: string
          transactions_count?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          account_number?: string | null
          applied?: boolean
          bank_name?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          matched_count?: number
          notes?: string | null
          organization_id?: string
          period_month?: number | null
          period_year?: number | null
          raw_transactions?: Json | null
          statement_downloaded_at?: string
          transactions_count?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          counterparty_account: string | null
          counterparty_bank: string | null
          counterparty_name: string | null
          counterparty_rut: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          description: string | null
          id: string
          import_id: string | null
          match_confidence: string | null
          match_status: string
          matched_unit_id: string | null
          movement_type: string
          operation_number: string | null
          organization_id: string
          raw: Json | null
          tx_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          counterparty_account?: string | null
          counterparty_bank?: string | null
          counterparty_name?: string | null
          counterparty_rut?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          id?: string
          import_id?: string | null
          match_confidence?: string | null
          match_status?: string
          matched_unit_id?: string | null
          movement_type?: string
          operation_number?: string | null
          organization_id: string
          raw?: Json | null
          tx_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          counterparty_account?: string | null
          counterparty_bank?: string | null
          counterparty_name?: string | null
          counterparty_rut?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          id?: string
          import_id?: string | null
          match_confidence?: string | null
          match_status?: string
          matched_unit_id?: string | null
          movement_type?: string
          operation_number?: string | null
          organization_id?: string
          raw?: Json | null
          tx_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_unit_id_fkey"
            columns: ["matched_unit_id"]
            isOneToOne: false
            referencedRelation: "rentable_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monitored_services: {
        Row: {
          active: boolean
          alert_threshold_pct: number
          created_at: string
          created_by: string | null
          currency: string
          expected_amount: number | null
          id: string
          last_alert_at: string | null
          last_detected_amount: number | null
          last_detected_at: string | null
          last_detected_period: string | null
          notes: string | null
          organization_id: string
          property_id: string | null
          provider: string | null
          service_identifier: string | null
          service_type: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          alert_threshold_pct?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_amount?: number | null
          id?: string
          last_alert_at?: string | null
          last_detected_amount?: number | null
          last_detected_at?: string | null
          last_detected_period?: string | null
          notes?: string | null
          organization_id: string
          property_id?: string | null
          provider?: string | null
          service_identifier?: string | null
          service_type?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          alert_threshold_pct?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_amount?: number | null
          id?: string
          last_alert_at?: string | null
          last_detected_amount?: number | null
          last_detected_at?: string | null
          last_detected_period?: string | null
          notes?: string | null
          organization_id?: string
          property_id?: string | null
          provider?: string | null
          service_identifier?: string | null
          service_type?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitored_services_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitored_services_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "rentable_units"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          created_by: string | null
          default_currency: Database["public"]["Enums"]["currency"]
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          created_by?: string | null
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          created_by?: string | null
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          comuna: string | null
          cover_photo_url: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          property_type: Database["public"]["Enums"]["unit_type"]
          region: string | null
          updated_at: string
        }
        Insert: {
          address: string
          comuna?: string | null
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          property_type?: Database["public"]["Enums"]["unit_type"]
          region?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          comuna?: string | null
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          property_type?: Database["public"]["Enums"]["unit_type"]
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          doc_type: string | null
          id: string
          organization_id: string
          property_id: string
          storage_path: string
          title: string
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          id?: string
          organization_id: string
          property_id: string
          storage_path: string
          title: string
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          id?: string
          organization_id?: string
          property_id?: string
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string
          ownership_pct: number | null
          phone: string | null
          property_id: string
          rut: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id: string
          ownership_pct?: number | null
          phone?: string | null
          property_id: string
          rut?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          ownership_pct?: number | null
          phone?: string | null
          property_id?: string
          rut?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          organization_id: string
          property_id: string
          sort_order: number | null
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          organization_id: string
          property_id: string
          sort_order?: number | null
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          property_id?: string
          sort_order?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payment_allocations: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_date: string
          rent_payment_id: string
          source: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_date: string
          rent_payment_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_date?: string
          rent_payment_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payment_allocations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payment_allocations_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          amount: number
          amount_paid: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          due_date: string
          id: string
          needs_review: boolean
          notes: string | null
          organization_id: string
          paid_date: string | null
          period_month: number
          period_year: number
          property_id: string
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_date: string
          id?: string
          needs_review?: boolean
          notes?: string | null
          organization_id: string
          paid_date?: string | null
          period_month: number
          period_year: number
          property_id: string
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_date?: string
          id?: string
          needs_review?: boolean
          notes?: string | null
          organization_id?: string
          paid_date?: string | null
          period_month?: number
          period_year?: number
          property_id?: string
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "rentable_units"
            referencedColumns: ["id"]
          },
        ]
      }
      rentable_units: {
        Row: {
          base_rent_amount: number | null
          base_rent_currency: Database["public"]["Enums"]["currency"] | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          id: string
          identifier: string | null
          label: string
          notes: string | null
          organization_id: string
          payment_day: number | null
          property_id: string
          rent_active: boolean
          rent_start_date: string | null
          surface_m2: number | null
          tenant_account_numbers: string[]
          tenant_aliases: string[]
          tenant_contact: string | null
          tenant_email: string | null
          tenant_name: string | null
          tenant_rut: string | null
          tenant_ruts: string[]
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          base_rent_amount?: number | null
          base_rent_currency?: Database["public"]["Enums"]["currency"] | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          identifier?: string | null
          label: string
          notes?: string | null
          organization_id: string
          payment_day?: number | null
          property_id: string
          rent_active?: boolean
          rent_start_date?: string | null
          surface_m2?: number | null
          tenant_account_numbers?: string[]
          tenant_aliases?: string[]
          tenant_contact?: string | null
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_rut?: string | null
          tenant_ruts?: string[]
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          base_rent_amount?: number | null
          base_rent_currency?: Database["public"]["Enums"]["currency"] | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          identifier?: string | null
          label?: string
          notes?: string | null
          organization_id?: string
          payment_day?: number | null
          property_id?: string
          rent_active?: boolean
          rent_start_date?: string | null
          surface_m2?: number | null
          tenant_account_numbers?: string[]
          tenant_aliases?: string[]
          tenant_contact?: string | null
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_rut?: string | null
          tenant_ruts?: string[]
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentable_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentable_units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      service_import_batches: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          detected_count: number
          documents_count: number
          id: string
          matched_count: number
          notes: string | null
          organization_id: string
          period: string | null
          raw: Json | null
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          detected_count?: number
          documents_count?: number
          id?: string
          matched_count?: number
          notes?: string | null
          organization_id: string
          period?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          detected_count?: number
          documents_count?: number
          id?: string
          matched_count?: number
          notes?: string | null
          organization_id?: string
          period?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_readings: {
        Row: {
          amount_due: number
          batch_id: string | null
          created_at: string
          created_by: string | null
          detected_at: string
          document_ref: string | null
          expected_amount: number | null
          id: string
          months_due: number | null
          notes: string | null
          organization_id: string
          period: string
          property_id: string
          raw: Json | null
          service_id: string
          source: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          detected_at?: string
          document_ref?: string | null
          expected_amount?: number | null
          id?: string
          months_due?: number | null
          notes?: string | null
          organization_id: string
          period: string
          property_id: string
          raw?: Json | null
          service_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          detected_at?: string
          document_ref?: string | null
          expected_amount?: number | null
          id?: string
          months_due?: number | null
          notes?: string | null
          organization_id?: string
          period?: string
          property_id?: string
          raw?: Json | null
          service_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_readings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "service_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_readings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_readings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "monitored_services"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_bills: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          paid_by: string | null
          period: string | null
          provider: string | null
          source: string
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          paid_by?: string | null
          period?: string | null
          provider?: string | null
          source?: string
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          paid_by?: string | null
          period?: string | null
          provider?: string | null
          source?: string
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_bills_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "rentable_units"
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
      create_org_for_current_user: { Args: { _name: string }; Returns: string }
      has_global_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: { _org: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "admin"
        | "owner"
        | "tenant"
        | "provider"
        | "referrer"
      currency: "CLP" | "UF" | "USD"
      unit_type:
        | "apartment"
        | "house"
        | "office"
        | "retail"
        | "parking"
        | "storage"
        | "other"
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
      app_role: [
        "superadmin",
        "admin",
        "owner",
        "tenant",
        "provider",
        "referrer",
      ],
      currency: ["CLP", "UF", "USD"],
      unit_type: [
        "apartment",
        "house",
        "office",
        "retail",
        "parking",
        "storage",
        "other",
      ],
    },
  },
} as const

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      blocked_periods: {
        Row: {
          created_at: string
          end_at: string
          id: string
          reason: string | null
          start_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          reason?: string | null
          start_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          reason?: string | null
          start_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_account_notifications: {
        Row: {
          account_id: string
          created_at: string
          event_type: string
          id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          event_type: string
          id?: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          event_type?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_account_notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_account_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_events: {
        Row: {
          created_at: string
          description: string | null
          end_at: string
          event_type: Database["public"]["Enums"]["facility_event_type"]
          id: string
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at: string
          event_type: Database["public"]["Enums"]["facility_event_type"]
          id?: string
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string
          event_type?: Database["public"]["Enums"]["facility_event_type"]
          id?: string
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      facility_settings: {
        Row: {
          cancellation_hours: number
          created_at: string
          default_price: number
          facility_name: string
          id: number
          timezone: string
          updated_at: string
        }
        Insert: {
          cancellation_hours?: number
          created_at?: string
          default_price: number
          facility_name: string
          id?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          cancellation_hours?: number
          created_at?: string
          default_price?: number
          facility_name?: string
          id?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          decided_at: string | null
          id: string
          player_id: string
          requested_at: string
          reservation_id: string
          status: Database["public"]["Enums"]["join_request_status"]
          updated_at: string
        }
        Insert: {
          decided_at?: string | null
          id?: string
          player_id: string
          requested_at?: string
          reservation_id: string
          status?: Database["public"]["Enums"]["join_request_status"]
          updated_at?: string
        }
        Update: {
          decided_at?: string | null
          id?: string
          player_id?: string
          requested_at?: string
          reservation_id?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          error_message: string | null
          event_type: Database["public"]["Enums"]["notification_event_type"]
          external_message_id: string | null
          id: string
          reservation_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          error_message?: string | null
          event_type: Database["public"]["Enums"]["notification_event_type"]
          external_message_id?: string | null
          id?: string
          reservation_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          external_message_id?: string | null
          id?: string
          reservation_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_issue_reports: {
        Row: {
          category: string
          created_at: string
          details: string
          id: number
          locale: string
          page_path: string | null
          player_id: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          details: string
          id?: never
          locale?: string
          page_path?: string | null
          player_id: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: never
          locale?: string
          page_path?: string | null
          player_id?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_main_administrator: boolean
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_main_administrator?: boolean
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_main_administrator?: boolean
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reservation_participants: {
        Row: {
          joined_at: string
          player_id: string
          reservation_id: string
          role: Database["public"]["Enums"]["participant_role"]
        }
        Insert: {
          joined_at?: string
          player_id: string
          reservation_id: string
          role?: Database["public"]["Enums"]["participant_role"]
        }
        Update: {
          joined_at?: string
          player_id?: string
          reservation_id?: string
          role?: Database["public"]["Enums"]["participant_role"]
        }
        Relationships: [
          {
            foreignKeyName: "reservation_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_participants_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancelled_at: string | null
          created_at: string
          end_at: string
          host_id: string
          id: string
          initial_player_count: number
          payment_confirmed_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pass_code: string
          pass_token: string
          price: number
          start_at: string
          status: Database["public"]["Enums"]["reservation_status"]
          type: Database["public"]["Enums"]["reservation_type"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          end_at: string
          host_id: string
          id?: string
          initial_player_count?: number
          payment_confirmed_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pass_code?: string
          pass_token?: string
          price: number
          start_at: string
          status?: Database["public"]["Enums"]["reservation_status"]
          type: Database["public"]["Enums"]["reservation_type"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          end_at?: string
          host_id?: string
          id?: string
          initial_player_count?: number
          payment_confirmed_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pass_code?: string
          pass_token?: string
          price?: number
          start_at?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          type?: Database["public"]["Enums"]["reservation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_rules: {
        Row: {
          closing_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          opening_time: string | null
          slot_duration_minutes: number
          updated_at: string
        }
        Insert: {
          closing_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          opening_time?: string | null
          slot_duration_minutes?: number
          updated_at?: string
        }
        Update: {
          closing_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          opening_time?: string | null
          slot_duration_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_administrators: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_main_administrator: boolean
          phone_number: string | null
          username: string
        }[]
      }
      admin_list_account_notifications: {
        Args: never
        Returns: {
          account_email: string
          account_full_name: string | null
          account_id: string
          account_role: Database["public"]["Enums"]["user_role"]
          account_username: string
          created_at: string
          event_type: string
          notification_id: string
          read_at: string | null
        }[]
      }
      admin_mark_account_notifications_read: {
        Args: { p_notification_ids?: string[] | null }
        Returns: number
      }
      admin_list_open_court_requests: {
        Args: { p_reservation_id: string }
        Returns: {
          decided_at: string | null
          join_request_id: string
          player_email: string
          player_full_name: string | null
          player_id: string
          player_phone_number: string | null
          player_username: string
          request_status: Database["public"]["Enums"]["join_request_status"]
          requested_at: string
        }[]
      }
      admin_list_open_courts: {
        Args: never
        Returns: {
          accepted_count: number
          available_spots: number
          end_at: string
          host_email: string
          host_full_name: string | null
          host_id: string
          host_phone_number: string | null
          host_username: string
          initial_player_count: number
          occupied_spots: number
          pass_code: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          pending_count: number
          price: number
          reservation_id: string
          start_at: string
        }[]
      }
      admin_remove_open_court_participant: {
        Args: { p_join_request_id: string }
        Returns: string
      }
      admin_respond_open_court_request: {
        Args: { p_accept: boolean; p_join_request_id: string }
        Returns: string
      }
      admin_search_reservations: {
        Args: {
          p_end_at?: string | null
          p_limit?: number
          p_offset?: number
          p_payment_status?: Database["public"]["Enums"]["payment_status"] | null
          p_search?: string | null
          p_start_at?: string | null
          p_status?: Database["public"]["Enums"]["reservation_status"] | null
          p_type?: Database["public"]["Enums"]["reservation_type"] | null
        }
        Returns: {
          cancelled_at: string | null
          created_at: string
          end_at: string
          host_email: string | null
          host_full_name: string | null
          host_id: string
          host_phone_number: string | null
          host_username: string
          initial_player_count: number
          pass_code: string
          pass_token: string
          payment_confirmed_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          reservation_id: string
          start_at: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_count: number
          type: Database["public"]["Enums"]["reservation_type"]
          updated_at: string
        }[]
      }
      admin_get_player_details: {
        Args: { p_player_id: string }
        Returns: {
          friend_count: number
          reservations_played: number
        }[]
      }
      admin_cancel_reservation: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      admin_confirm_cash_payment: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      admin_list_players: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          phone_number: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      admin_update_player_profile: {
        Args: {
          p_full_name: string
          p_phone_number: string
          p_player_id: string
        }
        Returns: string
      }
      admin_update_reservation: {
        Args: {
          p_end_at: string
          p_initial_player_count: number
          p_price: number
          p_reservation_id: string
          p_start_at: string
          p_status: Database["public"]["Enums"]["reservation_status"]
          p_type: Database["public"]["Enums"]["reservation_type"]
        }
        Returns: string
      }
      cancel_reservation: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      create_reservation: {
        Args: {
          p_end_at: string
          p_initial_player_count?: number
          p_start_at: string
          p_type: Database["public"]["Enums"]["reservation_type"]
        }
        Returns: string
      }
      get_available_slots: {
        Args: { p_date: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
    }
    Enums: {
      facility_event_type: "tournament" | "community" | "announcement"
      join_request_status: "pending" | "accepted" | "rejected" | "cancelled"
      notification_delivery_status: "pending" | "sent" | "failed"
      notification_event_type:
        | "reservation_confirmation"
        | "reservation_cancellation"
        | "join_request_created"
        | "join_request_accepted"
        | "join_request_rejected"
        | "reservation_reminder"
        | "participant_removed"
        | "open_court_auto_cancelled"
      participant_role: "host" | "member"
      payment_status: "unpaid" | "paid"
      reservation_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "expired"
      reservation_type: "private" | "open"
      user_role: "player" | "administrator" | "deleted"
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
      facility_event_type: ["tournament", "community", "announcement"],
      join_request_status: ["pending", "accepted", "rejected", "cancelled"],
      notification_delivery_status: ["pending", "sent", "failed"],
      notification_event_type: [
        "reservation_confirmation",
        "reservation_cancellation",
        "join_request_created",
        "join_request_accepted",
        "join_request_rejected",
        "reservation_reminder",
        "participant_removed",
        "open_court_auto_cancelled",
      ],
      participant_role: ["host", "member"],
      payment_status: ["unpaid", "paid"],
      reservation_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "expired",
      ],
      reservation_type: ["private", "open"],
      user_role: ["player", "administrator", "deleted"],
    },
  },
} as const

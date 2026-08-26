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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
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
      administrative_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_username: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_username?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_username?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "administrative_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      email_notification_outbox: {
        Row: {
          actor_username: string | null
          admin_notification_id: string | null
          attempts: number
          available_at: string
          context_type: string | null
          created_at: string
          error_message: string | null
          event_key: string | null
          event_type: string
          id: string
          notification_id: string | null
          provider_message_id: string | null
          recipient_email: string
          recipient_name: string | null
          recipient_user_id: string
          reservation_end_at: string | null
          reservation_id: string | null
          reservation_start_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_username?: string | null
          admin_notification_id?: string | null
          attempts?: number
          available_at?: string
          context_type?: string | null
          created_at?: string
          error_message?: string | null
          event_key?: string | null
          event_type: string
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          recipient_user_id: string
          reservation_end_at?: string | null
          reservation_id?: string | null
          reservation_start_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_username?: string | null
          admin_notification_id?: string | null
          attempts?: number
          available_at?: string
          context_type?: string | null
          created_at?: string
          error_message?: string | null
          event_key?: string | null
          event_type?: string
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          recipient_user_id?: string
          reservation_end_at?: string | null
          reservation_id?: string | null
          reservation_start_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notification_outbox_admin_notification_id_fkey"
            columns: ["admin_notification_id"]
            isOneToOne: true
            referencedRelation: "admin_account_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notification_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notification_outbox_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
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
          discount_enabled: boolean
          discount_ends_at: string | null
          discount_name: string | null
          discount_percentage: number
          discount_starts_at: string | null
          facility_name: string
          id: number
          timezone: string
          updated_at: string
        }
        Insert: {
          cancellation_hours?: number
          created_at?: string
          default_price: number
          discount_enabled?: boolean
          discount_ends_at?: string | null
          discount_name?: string | null
          discount_percentage?: number
          discount_starts_at?: string | null
          facility_name: string
          id?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          cancellation_hours?: number
          created_at?: string
          default_price?: number
          discount_enabled?: boolean
          discount_ends_at?: string | null
          discount_name?: string | null
          discount_percentage?: number
          discount_starts_at?: string | null
          facility_name?: string
          id?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          event_key: string | null
          event_type: Database["public"]["Enums"]["notification_event_type"]
          external_message_id: string | null
          friendship_id: string | null
          id: string
          invitation_id: string | null
          join_request_id: string | null
          read_at: string | null
          reservation_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          updated_at: string
          user_id: string
          waitlist_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          error_message?: string | null
          event_key?: string | null
          event_type: Database["public"]["Enums"]["notification_event_type"]
          external_message_id?: string | null
          friendship_id?: string | null
          id?: string
          invitation_id?: string | null
          join_request_id?: string | null
          read_at?: string | null
          reservation_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          updated_at?: string
          user_id: string
          waitlist_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          error_message?: string | null
          event_key?: string | null
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          external_message_id?: string | null
          friendship_id?: string | null
          id?: string
          invitation_id?: string | null
          join_request_id?: string | null
          read_at?: string | null
          reservation_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          updated_at?: string
          user_id?: string
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_friendship_id_fkey"
            columns: ["friendship_id"]
            isOneToOne: false
            referencedRelation: "friendships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "reservation_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_join_request_id_fkey"
            columns: ["join_request_id"]
            isOneToOne: false
            referencedRelation: "join_requests"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "notifications_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "reservation_waitlist"
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
      reservation_invitations: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          reservation_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          reservation_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          reservation_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_invitations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
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
      reservation_series: {
        Row: {
          created_at: string
          frequency: string
          host_id: string
          id: string
          occurrence_count: number
        }
        Insert: {
          created_at?: string
          frequency?: string
          host_id: string
          id?: string
          occurrence_count: number
        }
        Update: {
          created_at?: string
          frequency?: string
          host_id?: string
          id?: string
          occurrence_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_series_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_waitlist: {
        Row: {
          id: string
          joined_at: string
          player_id: string
          reservation_id: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          joined_at?: string
          player_id: string
          reservation_id: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          joined_at?: string
          player_id?: string
          reservation_id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_waitlist_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_waitlist_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          base_price: number
          cancelled_at: string | null
          created_at: string
          discount_amount: number
          discount_name: string | null
          discount_percentage: number
          end_at: string
          host_id: string
          id: string
          initial_player_count: number
          pass_code: string
          pass_token: string
          payment_confirmed_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          series_id: string | null
          series_occurrence: number | null
          start_at: string
          status: Database["public"]["Enums"]["reservation_status"]
          type: Database["public"]["Enums"]["reservation_type"]
          updated_at: string
        }
        Insert: {
          base_price: number
          cancelled_at?: string | null
          created_at?: string
          discount_amount?: number
          discount_name?: string | null
          discount_percentage?: number
          end_at: string
          host_id: string
          id?: string
          initial_player_count?: number
          pass_code?: string
          pass_token?: string
          payment_confirmed_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price: number
          series_id?: string | null
          series_occurrence?: number | null
          start_at: string
          status?: Database["public"]["Enums"]["reservation_status"]
          type: Database["public"]["Enums"]["reservation_type"]
          updated_at?: string
        }
        Update: {
          base_price?: number
          cancelled_at?: string | null
          created_at?: string
          discount_amount?: number
          discount_name?: string | null
          discount_percentage?: number
          end_at?: string
          host_id?: string
          id?: string
          initial_player_count?: number
          pass_code?: string
          pass_token?: string
          payment_confirmed_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number
          series_id?: string | null
          series_occurrence?: number | null
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
          {
            foreignKeyName: "reservations_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "reservation_series"
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
      admin_cancel_reservation: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      admin_confirm_cash_payment: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      admin_get_player_details: {
        Args: { p_player_id: string }
        Returns: {
          friend_count: number
          reservations_played: number
        }[]
      }
      admin_list_account_notifications: {
        Args: never
        Returns: {
          account_email: string
          account_full_name: string
          account_id: string
          account_role: Database["public"]["Enums"]["user_role"]
          account_username: string
          created_at: string
          event_type: string
          notification_id: string
          read_at: string
        }[]
      }
      admin_list_administrators: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_main_administrator: boolean
          phone_number: string
          username: string
        }[]
      }
      admin_list_open_court_requests: {
        Args: { p_reservation_id: string }
        Returns: {
          decided_at: string
          join_request_id: string
          player_email: string
          player_full_name: string
          player_id: string
          player_phone_number: string
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
          host_full_name: string
          host_id: string
          host_phone_number: string
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
      admin_lookup_reservation_receipt: {
        Args: { p_receipt_value: string }
        Returns: {
          cancelled_at: string
          created_at: string
          end_at: string
          host_email: string
          host_full_name: string
          host_id: string
          host_phone_number: string
          host_username: string
          id: string
          initial_player_count: number
          pass_code: string
          pass_token: string
          payment_confirmed_at: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          start_at: string
          status: Database["public"]["Enums"]["reservation_status"]
          type: Database["public"]["Enums"]["reservation_type"]
          updated_at: string
        }[]
      }
      admin_mark_account_notifications_read: {
        Args: { p_notification_ids?: string[] }
        Returns: number
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
          p_end_at?: string
          p_limit?: number
          p_offset?: number
          p_payment_status?: Database["public"]["Enums"]["payment_status"]
          p_search?: string
          p_start_at?: string
          p_status?: Database["public"]["Enums"]["reservation_status"]
          p_type?: Database["public"]["Enums"]["reservation_type"]
        }
        Returns: {
          cancelled_at: string
          created_at: string
          end_at: string
          host_email: string
          host_full_name: string
          host_id: string
          host_phone_number: string
          host_username: string
          initial_player_count: number
          pass_code: string
          pass_token: string
          payment_confirmed_at: string
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
      claim_email_notification_outbox: {
        Args: { p_limit?: number }
        Returns: {
          actor_username: string | null
          admin_notification_id: string | null
          attempts: number
          available_at: string
          context_type: string | null
          created_at: string
          error_message: string | null
          event_key: string | null
          event_type: string
          id: string
          notification_id: string | null
          provider_message_id: string | null
          recipient_email: string
          recipient_name: string | null
          recipient_user_id: string
          reservation_end_at: string | null
          reservation_id: string | null
          reservation_start_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_private_reservation: {
        Args: { p_end_at: string; p_friend_ids: string[]; p_start_at: string }
        Returns: string
      }
      create_recurring_reservations: {
        Args: {
          p_end_at: string
          p_friend_ids: string[]
          p_initial_player_count: number
          p_occurrence_count: number
          p_start_at: string
          p_type: Database["public"]["Enums"]["reservation_type"]
        }
        Returns: string[]
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
      get_calendar_blocks: {
        Args: { p_date: string }
        Returns: {
          block_type: string
          end_at: string
          start_at: string
        }[]
      }
      get_open_court_details: {
        Args: { p_reservation_id: string }
        Returns: {
          available_spots: number
          end_at: string
          host_username: string
          participant_role: string
          participant_username: string
          player_count: number
          reservation_id: string
          start_at: string
          unregistered_player_count: number
        }[]
      }
      get_player_public_profile: {
        Args: { p_username: string }
        Returns: {
          friend_count: number
          is_self: boolean
          player_id: string
          relationship_direction: string
          relationship_status: string
          reservation_count: number
          username: string
        }[]
      }
      get_reservation_receipt_players: {
        Args: { p_reservation_ids: string[] }
        Returns: {
          participant_role: string
          reservation_id: string
          unregistered_player_count: number
          username: string
        }[]
      }
      join_reservation_waitlist: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      leave_open_court: { Args: { p_reservation_id: string }; Returns: string }
      leave_reservation_waitlist: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      list_calendar_waitlist_opportunities: {
        Args: { p_date: string }
        Returns: {
          end_at: string
          reservation_id: string
          reservation_type: string
          start_at: string
          waitlist_position: number
          waitlist_status: string
        }[]
      }
      list_friendships: {
        Args: never
        Returns: {
          direction: string
          friendship_id: string
          player_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          username: string
        }[]
      }
      list_open_court_requests: {
        Args: never
        Returns: {
          end_at: string
          join_request_id: string
          player_username: string
          requested_at: string
          reservation_id: string
          start_at: string
        }[]
      }
      list_open_courts: {
        Args: never
        Returns: {
          available_spots: number
          end_at: string
          host_username: string
          is_host: boolean
          player_count: number
          request_status: string
          reservation_id: string
          start_at: string
          waitlist_position: number
          waitlist_status: string
        }[]
      }
      list_player_notifications: {
        Args: never
        Returns: {
          actor_username: string
          created_at: string
          event_type: string
          friendship_id: string
          join_request_id: string
          notification_id: string
          read_at: string
          reservation_end_at: string
          reservation_id: string
          reservation_start_at: string
        }[]
      }
      list_private_reservation_invitations: {
        Args: never
        Returns: {
          created_at: string
          end_at: string
          host_username: string
          invitation_id: string
          invitee_username: string
          is_host: boolean
          reservation_id: string
          start_at: string
          status: string
        }[]
      }
      mark_notifications_read: {
        Args: { p_notification_ids?: string[] }
        Returns: number
      }
      request_open_court_join: {
        Args: { p_reservation_id: string }
        Returns: string
      }
      respond_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string }
        Returns: string
      }
      respond_open_court_join: {
        Args: { p_accept: boolean; p_join_request_id: string }
        Returns: string
      }
      respond_reservation_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: string
      }
      search_players: {
        Args: { p_query: string }
        Returns: {
          player_id: string
          relationship_direction: string
          relationship_status: Database["public"]["Enums"]["friendship_status"]
          username: string
        }[]
      }
      send_friend_request: { Args: { p_player_id: string }; Returns: string }
      update_player_profile: {
        Args: { p_phone_number: string; p_username: string }
        Returns: string
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      facility_event_type: "tournament" | "community" | "announcement"
      friendship_status: "pending" | "accepted" | "rejected"
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
      friendship_status: ["pending", "accepted", "rejected"],
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

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_fee_payments: {
        Row: {
          amount: number
          calculated_from_revenue: number | null
          commission_rate: number | null
          commission_type: string | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          invoice_url: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_month: number
          period_year: number
          provider_registration_id: string
          status: string | null
          total_enrollments: number | null
          total_provider_revenue: number | null
          upi_transaction_id: string | null
        }
        Insert: {
          amount: number
          calculated_from_revenue?: number | null
          commission_rate?: number | null
          commission_type?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_month: number
          period_year: number
          provider_registration_id: string
          status?: string | null
          total_enrollments?: number | null
          total_provider_revenue?: number | null
          upi_transaction_id?: string | null
        }
        Update: {
          amount?: number
          calculated_from_revenue?: number | null
          commission_rate?: number | null
          commission_type?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_month?: number
          period_year?: number
          provider_registration_id?: string
          status?: string | null
          total_enrollments?: number | null
          total_provider_revenue?: number | null
          upi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_fee_payments_provider_registration_id_fkey"
            columns: ["provider_registration_id"]
            isOneToOne: false
            referencedRelation: "provider_apartment_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_type: string | null
          apartment_id: string | null
          author_id: string
          batch_id: string | null
          body: string
          class_id: string | null
          created_at: string | null
          id: string
          is_pinned: boolean | null
          target_audience: string
          title: string
        }
        Insert: {
          announcement_type?: string | null
          apartment_id?: string | null
          author_id: string
          batch_id?: string | null
          body: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          target_audience: string
          title: string
        }
        Update: {
          announcement_type?: string | null
          apartment_id?: string | null
          author_id?: string
          batch_id?: string | null
          body?: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          target_audience?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_admins: {
        Row: {
          apartment_id: string
          created_at: string | null
          fee_amount: number | null
          fee_type: string | null
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          apartment_id: string
          created_at?: string | null
          fee_amount?: number | null
          fee_type?: string | null
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          apartment_id?: string
          created_at?: string | null
          fee_amount?: number | null
          fee_type?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartment_admins_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: true
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_complexes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string
          created_at: string | null
          full_address: string | null
          id: string
          is_active: boolean | null
          locality: string
          logo_url: string | null
          name: string
          pin_code: string | null
          registered_by: string | null
          status: string | null
          total_units: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city: string
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_active?: boolean | null
          locality: string
          logo_url?: string | null
          name: string
          pin_code?: string | null
          registered_by?: string | null
          status?: string | null
          total_units?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_active?: boolean | null
          locality?: string
          logo_url?: string | null
          name?: string
          pin_code?: string | null
          registered_by?: string | null
          status?: string | null
          total_units?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartment_complexes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_complexes_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          batch_id: string
          enrollment_id: string
          id: string
          marked_at: string | null
          marked_by: string
          notes: string | null
          session_date: string
          status: string | null
        }
        Insert: {
          batch_id: string
          enrollment_id: string
          id?: string
          marked_at?: string | null
          marked_by: string
          notes?: string | null
          session_date: string
          status?: string | null
        }
        Update: {
          batch_id?: string
          enrollment_id?: string
          id?: string
          marked_at?: string | null
          marked_by?: string
          notes?: string | null
          session_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_schedules: {
        Row: {
          batch_id: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
        }
        Insert: {
          batch_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
        }
        Update: {
          batch_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_schedules_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          age_group_max: number | null
          age_group_min: number | null
          auto_waitlist: boolean | null
          batch_name: string
          batch_type: string | null
          class_id: string
          created_at: string | null
          current_enrollment_count: number | null
          end_date: string | null
          fee_amount: number
          fee_frequency: string
          id: string
          max_batch_size: number
          notes: string | null
          registration_fee: number | null
          registration_mode: string | null
          skill_level: string | null
          start_date: string | null
          status: string | null
          total_sessions: number | null
          trainer_id: string | null
          updated_at: string | null
        }
        Insert: {
          age_group_max?: number | null
          age_group_min?: number | null
          auto_waitlist?: boolean | null
          batch_name: string
          batch_type?: string | null
          class_id: string
          created_at?: string | null
          current_enrollment_count?: number | null
          end_date?: string | null
          fee_amount: number
          fee_frequency: string
          id?: string
          max_batch_size: number
          notes?: string | null
          registration_fee?: number | null
          registration_mode?: string | null
          skill_level?: string | null
          start_date?: string | null
          status?: string | null
          total_sessions?: number | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group_max?: number | null
          age_group_min?: number | null
          auto_waitlist?: boolean | null
          batch_name?: string
          batch_type?: string | null
          class_id?: string
          created_at?: string | null
          current_enrollment_count?: number | null
          end_date?: string | null
          fee_amount?: number
          fee_frequency?: string
          id?: string
          max_batch_size?: number
          notes?: string | null
          registration_fee?: number | null
          registration_mode?: string | null
          skill_level?: string | null
          start_date?: string | null
          status?: string | null
          total_sessions?: number | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message_text: string
          message_type: string | null
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text: string
          message_type?: string | null
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string
          message_type?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      class_addons: {
        Row: {
          class_id: string
          created_at: string | null
          description: string | null
          fee_amount: number
          fee_type: string | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          name: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          description?: string | null
          fee_amount: number
          fee_type?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          name: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          description?: string | null
          fee_amount?: number
          fee_type?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_addons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_categories: {
        Row: {
          display_order: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_category_id: string | null
          slug: string
        }
        Insert: {
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_category_id?: string | null
          slug: string
        }
        Update: {
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_category_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      class_materials: {
        Row: {
          batch_id: string | null
          class_id: string
          created_at: string | null
          description: string | null
          external_url: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          material_type: string
          title: string
          uploaded_by: string
        }
        Insert: {
          batch_id?: string | null
          class_id: string
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          material_type: string
          title: string
          uploaded_by: string
        }
        Update: {
          batch_id?: string | null
          class_id?: string
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          material_type?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          age_group_max: number | null
          age_group_min: number | null
          category_id: string
          class_type: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          gallery_urls: string[] | null
          id: string
          is_featured: boolean | null
          promo_video_url: string | null
          provider_registration_id: string
          rating_count: number | null
          short_description: string | null
          skill_level: string[] | null
          status: string | null
          title: string
          total_rating: number | null
          trial_available: boolean | null
          trial_fee: number | null
          updated_at: string | null
          venue_details: string | null
          what_to_bring: string | null
        }
        Insert: {
          age_group_max?: number | null
          age_group_min?: number | null
          category_id: string
          class_type?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gallery_urls?: string[] | null
          id?: string
          is_featured?: boolean | null
          promo_video_url?: string | null
          provider_registration_id: string
          rating_count?: number | null
          short_description?: string | null
          skill_level?: string[] | null
          status?: string | null
          title: string
          total_rating?: number | null
          trial_available?: boolean | null
          trial_fee?: number | null
          updated_at?: string | null
          venue_details?: string | null
          what_to_bring?: string | null
        }
        Update: {
          age_group_max?: number | null
          age_group_min?: number | null
          category_id?: string
          class_type?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gallery_urls?: string[] | null
          id?: string
          is_featured?: boolean | null
          promo_video_url?: string | null
          provider_registration_id?: string
          rating_count?: number | null
          short_description?: string | null
          skill_level?: string[] | null
          status?: string | null
          title?: string
          total_rating?: number | null
          trial_available?: boolean | null
          trial_fee?: number | null
          updated_at?: string | null
          venue_details?: string | null
          what_to_bring?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_provider_registration_id_fkey"
            columns: ["provider_registration_id"]
            isOneToOne: false
            referencedRelation: "provider_apartment_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_registrations: {
        Row: {
          created_at: string | null
          demo_session_id: string
          family_member_id: string
          id: string
          registered_by: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          demo_session_id: string
          family_member_id: string
          id?: string
          registered_by: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          demo_session_id?: string
          family_member_id?: string
          id?: string
          registered_by?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_registrations_demo_session_id_fkey"
            columns: ["demo_session_id"]
            isOneToOne: false
            referencedRelation: "demo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_registrations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_registrations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          class_id: string
          created_at: string | null
          current_count: number | null
          end_time: string
          fee: number | null
          id: string
          max_participants: number | null
          notes: string | null
          session_date: string
          start_time: string
          status: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          current_count?: number | null
          end_time: string
          fee?: number | null
          id?: string
          max_participants?: number | null
          notes?: string | null
          session_date: string
          start_time: string
          status?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          current_count?: number | null
          end_time?: string
          fee?: number | null
          id?: string
          max_participants?: number | null
          notes?: string | null
          session_date?: string
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          approved_at: string | null
          batch_id: string
          created_at: string | null
          drop_reason: string | null
          dropped_at: string | null
          enrolled_at: string | null
          enrolled_by: string
          family_member_id: string
          id: string
          notes: string | null
          selected_addon_ids: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          batch_id: string
          created_at?: string | null
          drop_reason?: string | null
          dropped_at?: string | null
          enrolled_at?: string | null
          enrolled_by: string
          family_member_id: string
          id?: string
          notes?: string | null
          selected_addon_ids?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          batch_id?: string
          created_at?: string | null
          drop_reason?: string | null
          dropped_at?: string | null
          enrolled_at?: string | null
          enrolled_by?: string
          family_member_id?: string
          id?: string
          notes?: string | null
          selected_addon_ids?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          apartment_id: string
          block_tower: string | null
          created_at: string | null
          flat_number: string | null
          id: string
          primary_user_id: string
          updated_at: string | null
        }
        Insert: {
          apartment_id: string
          block_tower?: string | null
          created_at?: string | null
          flat_number?: string | null
          id?: string
          primary_user_id: string
          updated_at?: string | null
        }
        Update: {
          apartment_id?: string
          block_tower?: string | null
          created_at?: string | null
          flat_number?: string | null
          id?: string
          primary_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          claimed_member_id: string | null
          created_at: string | null
          expires_at: string | null
          family_id: string
          id: string
          invite_code: string
          invite_type: string | null
          invited_by: string
          invited_email: string | null
          invited_phone: string | null
          invited_user_id: string | null
          message: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          claimed_member_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          family_id: string
          id?: string
          invite_code: string
          invite_type?: string | null
          invited_by: string
          invited_email?: string | null
          invited_phone?: string | null
          invited_user_id?: string | null
          message?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          claimed_member_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          family_id?: string
          id?: string
          invite_code?: string
          invite_type?: string | null
          invited_by?: string
          invited_email?: string | null
          invited_phone?: string | null
          invited_user_id?: string | null
          message?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invites_claimed_member_id_fkey"
            columns: ["claimed_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_links: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          linked_at: string | null
          linked_via: string | null
          role: string | null
          status: string | null
          unlink_reason: string | null
          unlinked_at: string | null
          unlinked_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          linked_at?: string | null
          linked_via?: string | null
          role?: string | null
          status?: string | null
          unlink_reason?: string | null
          unlinked_at?: string | null
          unlinked_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          linked_at?: string | null
          linked_via?: string | null
          role?: string | null
          status?: string | null
          unlink_reason?: string | null
          unlinked_at?: string | null
          unlinked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_links_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_links_unlinked_by_fkey"
            columns: ["unlinked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          age_group: string | null
          avatar_url: string | null
          created_at: string | null
          date_of_birth: string | null
          family_id: string
          gender: string | null
          id: string
          is_active: boolean | null
          name: string
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          family_id: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          family_id?: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_class_listings: {
        Row: {
          ad_fee: number | null
          admin_notes: string | null
          apartment_id: string
          banner_image_url: string
          class_id: string
          created_at: string | null
          display_order: number | null
          fee_accepted_at: string | null
          fee_status: string | null
          id: string
          provider_registration_id: string
          requested_at: string | null
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          status: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          ad_fee?: number | null
          admin_notes?: string | null
          apartment_id: string
          banner_image_url: string
          class_id: string
          created_at?: string | null
          display_order?: number | null
          fee_accepted_at?: string | null
          fee_status?: string | null
          id?: string
          provider_registration_id: string
          requested_at?: string | null
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          ad_fee?: number | null
          admin_notes?: string | null
          apartment_id?: string
          banner_image_url?: string
          class_id?: string
          created_at?: string | null
          display_order?: number | null
          fee_accepted_at?: string | null
          fee_status?: string | null
          id?: string
          provider_registration_id?: string
          requested_at?: string | null
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_class_listings_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_class_listings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_class_listings_provider_registration_id_fkey"
            columns: ["provider_registration_id"]
            isOneToOne: false
            referencedRelation: "provider_apartment_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_class_listings_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_class_listings_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_read: boolean | null
          notification_type: string
          reference_id: string | null
          reference_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          due_date: string | null
          enrollment_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payer_user_id: string
          payment_method: string | null
          payment_period_end: string | null
          payment_period_start: string | null
          payment_type: string
          provider_id: string
          receipt_url: string | null
          status: string | null
          updated_at: string | null
          upi_transaction_id: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payer_user_id: string
          payment_method?: string | null
          payment_period_end?: string | null
          payment_period_start?: string | null
          payment_type: string
          provider_id: string
          receipt_url?: string | null
          status?: string | null
          updated_at?: string | null
          upi_transaction_id?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payer_user_id?: string
          payment_method?: string | null
          payment_period_end?: string | null
          payment_period_start?: string | null
          payment_type?: string
          provider_id?: string
          receipt_url?: string | null
          status?: string | null
          updated_at?: string | null
          upi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_config: {
        Row: {
          applies_to: string | null
          created_at: string | null
          effective_from: string | null
          fee_type: string | null
          fee_value: number | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          applies_to?: string | null
          created_at?: string | null
          effective_from?: string | null
          fee_type?: string | null
          fee_value?: number | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          applies_to?: string | null
          created_at?: string | null
          effective_from?: string | null
          fee_type?: string | null
          fee_value?: number | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      provider_apartment_registrations: {
        Row: {
          admin_fee_amount: number | null
          admin_fee_type: string | null
          apartment_id: string
          approved_at: string | null
          approved_by: string | null
          commercial_notes: string | null
          created_at: string | null
          free_trial_days: number | null
          id: string
          min_guaranteed_fee: number | null
          payment_frequency: string | null
          provider_id: string
          revenue_share_pct: number | null
          status: string | null
          suspended_at: string | null
          suspension_reason: string | null
          terms_accepted_at: string | null
          terms_status: string | null
          terms_version: number | null
          updated_at: string | null
        }
        Insert: {
          admin_fee_amount?: number | null
          admin_fee_type?: string | null
          apartment_id: string
          approved_at?: string | null
          approved_by?: string | null
          commercial_notes?: string | null
          created_at?: string | null
          free_trial_days?: number | null
          id?: string
          min_guaranteed_fee?: number | null
          payment_frequency?: string | null
          provider_id: string
          revenue_share_pct?: number | null
          status?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          terms_accepted_at?: string | null
          terms_status?: string | null
          terms_version?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_fee_amount?: number | null
          admin_fee_type?: string | null
          apartment_id?: string
          approved_at?: string | null
          approved_by?: string | null
          commercial_notes?: string | null
          created_at?: string | null
          free_trial_days?: number | null
          id?: string
          min_guaranteed_fee?: number | null
          payment_frequency?: string | null
          provider_id?: string
          revenue_share_pct?: number | null
          status?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          terms_accepted_at?: string | null
          terms_status?: string | null
          terms_version?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_apartment_registrations_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_apartment_registrations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_apartment_registrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          apartment_id: string
          converted_at: string | null
          created_at: string | null
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string
          reward_type: string | null
          reward_value: number | null
          status: string | null
        }
        Insert: {
          apartment_id: string
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id: string
          reward_type?: string | null
          reward_value?: number | null
          status?: string | null
        }
        Update: {
          apartment_id?: string
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          reward_type?: string | null
          reward_value?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          class_id: string
          created_at: string | null
          enrollment_id: string | null
          id: string
          is_verified: boolean | null
          is_visible: boolean | null
          provider_replied_at: string | null
          provider_reply: string | null
          rating: number
          review_text: string | null
          reviewer_user_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_verified?: boolean | null
          is_visible?: boolean | null
          provider_replied_at?: string | null
          provider_reply?: string | null
          rating: number
          review_text?: string | null
          reviewer_user_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_verified?: boolean | null
          is_visible?: boolean | null
          provider_replied_at?: string | null
          provider_reply?: string | null
          rating?: number
          review_text?: string | null
          reviewer_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          bio: string | null
          business_name: string | null
          created_at: string | null
          experience_years: number | null
          id: string
          instagram_handle: string | null
          intro_video_url: string | null
          is_verified: boolean | null
          profile_photos: string[] | null
          provider_type: string | null
          qualifications: string | null
          specialization_category_ids: string[] | null
          specializations: string[] | null
          updated_at: string | null
          upi_id: string | null
          upi_qr_image_url: string | null
          user_id: string
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          bio?: string | null
          business_name?: string | null
          created_at?: string | null
          experience_years?: number | null
          id?: string
          instagram_handle?: string | null
          intro_video_url?: string | null
          is_verified?: boolean | null
          profile_photos?: string[] | null
          provider_type?: string | null
          qualifications?: string | null
          specialization_category_ids?: string[] | null
          specializations?: string[] | null
          updated_at?: string | null
          upi_id?: string | null
          upi_qr_image_url?: string | null
          user_id: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          bio?: string | null
          business_name?: string | null
          created_at?: string | null
          experience_years?: number | null
          id?: string
          instagram_handle?: string | null
          intro_video_url?: string | null
          is_verified?: boolean | null
          profile_photos?: string[] | null
          provider_type?: string | null
          qualifications?: string | null
          specialization_category_ids?: string[] | null
          specializations?: string[] | null
          updated_at?: string | null
          upi_id?: string | null
          upi_qr_image_url?: string | null
          user_id?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          bio: string | null
          created_at: string | null
          experience_years: number | null
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          provider_id: string
          qualifications: string | null
          specializations: string[] | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          provider_id: string
          qualifications?: string | null
          specializations?: string[] | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          provider_id?: string
          qualifications?: string | null
          specializations?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_apartment_admin: boolean | null
          is_platform_admin: boolean | null
          is_provider: boolean | null
          is_verified: boolean | null
          last_active_persona: string | null
          mobile_number: string | null
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_apartment_admin?: boolean | null
          is_platform_admin?: boolean | null
          is_provider?: boolean | null
          is_verified?: boolean | null
          last_active_persona?: string | null
          mobile_number?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_apartment_admin?: boolean | null
          is_platform_admin?: boolean | null
          is_provider?: boolean | null
          is_verified?: boolean | null
          last_active_persona?: string | null
          mobile_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          batch_id: string
          created_at: string | null
          family_member_id: string
          id: string
          offer_expires_at: string | null
          offered_at: string | null
          position: number
          requested_by: string
          status: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          family_member_id: string
          id?: string
          offer_expires_at?: string | null
          offered_at?: string | null
          position: number
          requested_by: string
          status?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          family_member_id?: string
          id?: string
          offer_expires_at?: string | null
          offered_at?: string | null
          position?: number
          requested_by?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_provider_terms: {
        Args: { p_accept: boolean; p_registration_id: string }
        Returns: undefined
      }
      admin_get_user_count: { Args: never; Returns: number }
      admin_get_users_growth: {
        Args: never
        Returns: {
          created_at: string
          id: string
        }[]
      }
      admin_search_users: {
        Args: { search_query: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          mobile_number: string
        }[]
      }
      admin_update_user: {
        Args: {
          set_apartment_admin?: boolean
          set_platform_admin?: boolean
          target_user_id: string
        }
        Returns: undefined
      }
      create_family_for_user: {
        Args: {
          p_apartment_id: string
          p_block_tower?: string
          p_flat_number?: string
          p_user_id: string
        }
        Returns: string
      }
      get_admin_apartment: {
        Args: never
        Returns: {
          city: string
          id: string
          locality: string
          logo_url: string
          name: string
        }[]
      }
      get_chat_partner_family_ids: { Args: never; Returns: string[] }
      get_chat_partner_family_ids_v2: { Args: never; Returns: string[] }
      get_family_co_links: {
        Args: { for_family_id: string }
        Returns: {
          family_id: string
          id: string
          linked_at: string
          linked_via: string
          role: string
          status: string
          user_id: string
        }[]
      }
      get_provider_enrolled_family_ids: { Args: never; Returns: string[] }
      get_provider_enrolled_member_ids: { Args: never; Returns: string[] }
      get_user_apartment_ids: { Args: { _auth_uid: string }; Returns: string[] }
      get_user_id: { Args: never; Returns: string }
      is_apartment_admin_for_any: {
        Args: { _auth_uid: string }
        Returns: string[]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      search_apartment_users: {
        Args: { apt_id: string; search_query: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          mobile_number: string
        }[]
      }
      send_notification: {
        Args: {
          p_body: string
          p_ref_id?: string
          p_ref_type?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      transfer_family_primary: {
        Args: { current_primary_link_id: string; new_primary_link_id: string }
        Returns: undefined
      }
      unlink_family_member: { Args: { link_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

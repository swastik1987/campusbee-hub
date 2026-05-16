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
      announcements: {
        Row: {
          announcement_type: string
          author_id: string | null
          batch_id: string | null
          body: string
          class_id: string | null
          created_at: string
          id: string
          is_pinned: boolean
          priority: string
          provider_id: string
          target_audience: string | null
          title: string
        }
        Insert: {
          announcement_type?: string
          author_id?: string | null
          batch_id?: string | null
          body: string
          class_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          priority?: string
          provider_id: string
          target_audience?: string | null
          title: string
        }
        Update: {
          announcement_type?: string
          author_id?: string | null
          batch_id?: string | null
          body?: string
          class_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          priority?: string
          provider_id?: string
          target_audience?: string | null
          title?: string
        }
        Relationships: [
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
          {
            foreignKeyName: "announcements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          batch_id: string
          created_at: string
          enrollment_id: string
          id: string
          marked_by: string
          notes: string | null
          session_date: string
          status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          marked_by: string
          notes?: string | null
          session_date: string
          status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          marked_by?: string
          notes?: string | null
          session_date?: string
          status?: string
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
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          location: string | null
          start_time: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          location?: string | null
          start_time: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          location?: string | null
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
          auto_waitlist: boolean
          batch_name: string
          batch_type: string | null
          class_id: string
          created_at: string
          current_enrollment_count: number
          end_date: string | null
          fee_amount: number
          fee_frequency: string
          grades: string[]
          id: string
          max_batch_size: number
          notes: string | null
          registration_fee: number
          registration_mode: string
          skill_level: string | null
          start_date: string | null
          status: string
          total_sessions: number | null
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          age_group_max?: number | null
          age_group_min?: number | null
          auto_waitlist?: boolean
          batch_name: string
          batch_type?: string | null
          class_id: string
          created_at?: string
          current_enrollment_count?: number
          end_date?: string | null
          fee_amount?: number
          fee_frequency?: string
          grades?: string[]
          id?: string
          max_batch_size?: number
          notes?: string | null
          registration_fee?: number
          registration_mode?: string
          skill_level?: string | null
          start_date?: string | null
          status?: string
          total_sessions?: number | null
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          age_group_max?: number | null
          age_group_min?: number | null
          auto_waitlist?: boolean
          batch_name?: string
          batch_type?: string | null
          class_id?: string
          created_at?: string
          current_enrollment_count?: number
          end_date?: string | null
          fee_amount?: number
          fee_frequency?: string
          grades?: string[]
          id?: string
          max_batch_size?: number
          notes?: string | null
          registration_fee?: number
          registration_mode?: string
          skill_level?: string | null
          start_date?: string | null
          status?: string
          total_sessions?: number | null
          trainer_id?: string | null
          updated_at?: string
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
      category_requests: {
        Row: {
          admin_modified_icon: string | null
          admin_modified_name: string | null
          admin_notes: string | null
          created_category_id: string | null
          description: string | null
          dismissed_at: string | null
          id: string
          parent_category_id: string | null
          provider_id: string
          request_type: string
          requested_at: string | null
          requested_icon: string | null
          requested_name: string
          requested_subcategories: string[] | null
          retag_category_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_modified_icon?: string | null
          admin_modified_name?: string | null
          admin_notes?: string | null
          created_category_id?: string | null
          description?: string | null
          dismissed_at?: string | null
          id?: string
          parent_category_id?: string | null
          provider_id: string
          request_type: string
          requested_at?: string | null
          requested_icon?: string | null
          requested_name: string
          requested_subcategories?: string[] | null
          retag_category_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_modified_icon?: string | null
          admin_modified_name?: string | null
          admin_notes?: string | null
          created_category_id?: string | null
          description?: string | null
          dismissed_at?: string | null
          id?: string
          parent_category_id?: string | null
          provider_id?: string
          request_type?: string
          requested_at?: string | null
          requested_icon?: string | null
          requested_name?: string
          requested_subcategories?: string[] | null
          retag_category_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_requests_created_category_id_fkey"
            columns: ["created_category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_requests_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_requests_retag_category_id_fkey"
            columns: ["retag_category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          coach_id: string | null
          created_at: string
          id: string
          image_url: string
          issuing_authority: string | null
          moderation_notes: string | null
          moderation_status: string
          name: string
          owner_type: string
          provider_id: string | null
          trainer_id: string | null
          year_obtained: number | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          issuing_authority?: string | null
          moderation_notes?: string | null
          moderation_status?: string
          name: string
          owner_type: string
          provider_id?: string | null
          trainer_id?: string | null
          year_obtained?: number | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          issuing_authority?: string | null
          moderation_notes?: string | null
          moderation_status?: string
          name?: string
          owner_type?: string
          provider_id?: string | null
          trainer_id?: string | null
          year_obtained?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          batch_id: string | null
          class_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          participant_1: string | null
          participant_2: string | null
          participant_ids: string[]
          type: string
        }
        Insert: {
          batch_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1?: string | null
          participant_2?: string | null
          participant_ids: string[]
          type?: string
        }
        Update: {
          batch_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1?: string | null
          participant_2?: string | null
          participant_ids?: string[]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
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
          attachment_url: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
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
          created_at: string
          description: string | null
          fee_amount: number
          fee_type: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          fee_amount?: number
          fee_type?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          fee_amount?: number
          fee_type?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
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
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_categories_parent_id_fkey"
            columns: ["parent_id"]
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
          created_at: string
          description: string | null
          external_url: string | null
          file_url: string | null
          id: string
          is_active: boolean
          material_type: string
          title: string
          uploaded_by: string
        }
        Insert: {
          batch_id?: string | null
          class_id: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          material_type?: string
          title: string
          uploaded_by: string
        }
        Update: {
          batch_id?: string | null
          class_id?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
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
          address: string | null
          age_group_max: number | null
          age_group_min: number | null
          category_id: string | null
          class_type: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          facebook_url: string | null
          gallery_urls: string[]
          home_radius_km: number
          id: string
          images: string[]
          instagram_url: string | null
          is_home_based: boolean
          location: unknown
          location_lat: number | null
          location_lng: number | null
          moderation_notes: string | null
          moderation_status: string
          pending_category_request_id: string | null
          promo_video_url: string | null
          provider_id: string
          rating_count: number
          short_description: string | null
          skill_level: string[] | null
          status: string
          tags: string[]
          title: string
          total_rating: number
          trial_available: boolean
          trial_fee: number | null
          twitter_url: string | null
          updated_at: string
          venue_details: string | null
          what_to_bring: string | null
        }
        Insert: {
          address?: string | null
          age_group_max?: number | null
          age_group_min?: number | null
          category_id?: string | null
          class_type?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          gallery_urls?: string[]
          home_radius_km?: number
          id?: string
          images?: string[]
          instagram_url?: string | null
          is_home_based?: boolean
          location?: unknown
          location_lat?: number | null
          location_lng?: number | null
          moderation_notes?: string | null
          moderation_status?: string
          pending_category_request_id?: string | null
          promo_video_url?: string | null
          provider_id: string
          rating_count?: number
          short_description?: string | null
          skill_level?: string[] | null
          status?: string
          tags?: string[]
          title: string
          total_rating?: number
          trial_available?: boolean
          trial_fee?: number | null
          twitter_url?: string | null
          updated_at?: string
          venue_details?: string | null
          what_to_bring?: string | null
        }
        Update: {
          address?: string | null
          age_group_max?: number | null
          age_group_min?: number | null
          category_id?: string | null
          class_type?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          gallery_urls?: string[]
          home_radius_km?: number
          id?: string
          images?: string[]
          instagram_url?: string | null
          is_home_based?: boolean
          location?: unknown
          location_lat?: number | null
          location_lng?: number | null
          moderation_notes?: string | null
          moderation_status?: string
          pending_category_request_id?: string | null
          promo_video_url?: string | null
          provider_id?: string
          rating_count?: number
          short_description?: string | null
          skill_level?: string[] | null
          status?: string
          tags?: string[]
          title?: string
          total_rating?: number
          trial_available?: boolean
          trial_fee?: number | null
          twitter_url?: string | null
          updated_at?: string
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
            foreignKeyName: "classes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_assignments: {
        Row: {
          coach_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_temporary: boolean
          original_coach_id: string | null
          scope_id: string
          scope_type: string
          status: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_temporary?: boolean
          original_coach_id?: string | null
          scope_id: string
          scope_type: string
          status?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_temporary?: boolean
          original_coach_id?: string | null
          scope_id?: string
          scope_type?: string
          status?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_original_coach_id_fkey"
            columns: ["original_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          academy_provider_id: string
          accepted_at: string | null
          bio: string | null
          created_at: string | null
          email: string
          experience_years: number | null
          full_name: string
          id: string
          invited_at: string | null
          invited_by: string | null
          linked_user_id: string | null
          phone: string | null
          photo_url: string | null
          qualifications: string | null
          removed_at: string | null
          specializations: string[] | null
          status: string
          updated_at: string | null
        }
        Insert: {
          academy_provider_id: string
          accepted_at?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          experience_years?: number | null
          full_name: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          linked_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          qualifications?: string | null
          removed_at?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          academy_provider_id?: string
          accepted_at?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          experience_years?: number | null
          full_name?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          linked_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          qualifications?: string | null
          removed_at?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_academy_provider_id_fkey"
            columns: ["academy_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_registrations: {
        Row: {
          created_at: string
          demo_session_id: string
          family_member_id: string
          feedback: string | null
          id: string
          registered_by: string
          status: string
        }
        Insert: {
          created_at?: string
          demo_session_id: string
          family_member_id: string
          feedback?: string | null
          id?: string
          registered_by: string
          status?: string
        }
        Update: {
          created_at?: string
          demo_session_id?: string
          family_member_id?: string
          feedback?: string | null
          id?: string
          registered_by?: string
          status?: string
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
          created_at: string
          current_count: number
          end_time: string
          fee: number
          id: string
          is_active: boolean
          location_text: string | null
          max_participants: number
          notes: string | null
          session_date: string
          start_time: string
          status: string
        }
        Insert: {
          class_id: string
          created_at?: string
          current_count?: number
          end_time: string
          fee?: number
          id?: string
          is_active?: boolean
          location_text?: string | null
          max_participants?: number
          notes?: string | null
          session_date: string
          start_time: string
          status?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          current_count?: number
          end_time?: string
          fee?: number
          id?: string
          is_active?: boolean
          location_text?: string | null
          max_participants?: number
          notes?: string | null
          session_date?: string
          start_time?: string
          status?: string
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
          created_at: string
          drop_reason: string | null
          dropped_at: string | null
          enrolled_at: string
          enrolled_by: string
          family_member_id: string
          id: string
          notes: string | null
          pending_switch_to_batch_id: string | null
          selected_addon_ids: string[]
          status: string
          switch_requested_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          batch_id: string
          created_at?: string
          drop_reason?: string | null
          dropped_at?: string | null
          enrolled_at?: string
          enrolled_by: string
          family_member_id: string
          id?: string
          notes?: string | null
          pending_switch_to_batch_id?: string | null
          selected_addon_ids?: string[]
          status?: string
          switch_requested_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          batch_id?: string
          created_at?: string
          drop_reason?: string | null
          dropped_at?: string | null
          enrolled_at?: string
          enrolled_by?: string
          family_member_id?: string
          id?: string
          notes?: string | null
          pending_switch_to_batch_id?: string | null
          selected_addon_ids?: string[]
          status?: string
          switch_requested_at?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "enrollments_pending_switch_to_batch_id_fkey"
            columns: ["pending_switch_to_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          primary_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          primary_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          primary_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          family_id: string
          id: string
          invite_code: string
          invited_by: string
          invited_email: string | null
          invited_phone: string | null
          invited_user_id: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          family_id: string
          id?: string
          invite_code: string
          invited_by: string
          invited_email?: string | null
          invited_phone?: string | null
          invited_user_id?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          family_id?: string
          id?: string
          invite_code?: string
          invited_by?: string
          invited_email?: string | null
          invited_phone?: string | null
          invited_user_id?: string | null
          status?: string
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
          accepted_at: string | null
          created_at: string
          family_id: string
          id: string
          invited_by: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          family_id: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
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
            foreignKeyName: "family_links_invited_by_fkey"
            columns: ["invited_by"]
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
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          family_id: string
          full_name: string
          gender: string | null
          id: string
          is_active: boolean
          linked_user_id: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          family_id: string
          full_name: string
          gender?: string | null
          id?: string
          is_active?: boolean
          linked_user_id?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          family_id?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          linked_user_id?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_banners: {
        Row: {
          center_address: string | null
          center_location: unknown
          class_id: string | null
          click_count: number
          id: string
          image_url: string
          impression_count: number
          moderation_status: string
          off_app_payment_ref: string | null
          provider_id: string
          radius_km: number | null
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          surface: string
          target_url: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          center_address?: string | null
          center_location?: unknown
          class_id?: string | null
          click_count?: number
          id?: string
          image_url: string
          impression_count?: number
          moderation_status?: string
          off_app_payment_ref?: string | null
          provider_id: string
          radius_km?: number | null
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          surface?: string
          target_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          center_address?: string | null
          center_location?: unknown
          class_id?: string | null
          click_count?: number
          id?: string
          image_url?: string
          impression_count?: number
          moderation_status?: string
          off_app_payment_ref?: string | null
          provider_id?: string
          radius_km?: number | null
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          surface?: string
          target_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_banners_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_banners_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_banners_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          device_fingerprint: string | null
          doc_type: string
          document_version_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          device_fingerprint?: string | null
          doc_type: string
          document_version_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          device_fingerprint?: string | null
          doc_type?: string
          document_version_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          doc_type: string
          html_content: string
          id: string
          is_active: boolean
          original_file_path: string | null
          title: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          doc_type: string
          html_content: string
          id?: string
          is_active?: boolean
          original_file_path?: string | null
          title: string
          uploaded_at?: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          doc_type?: string
          html_content?: string
          id?: string
          is_active?: boolean
          original_file_path?: string | null
          title?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_flags: {
        Row: {
          action_notes: string | null
          ai_categories: Json | null
          ai_provider: string | null
          ai_score: number | null
          content_snapshot: string | null
          created_at: string
          id: string
          image_url: string | null
          owner_user_id: string | null
          ref_id: string
          ref_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          action_notes?: string | null
          ai_categories?: Json | null
          ai_provider?: string | null
          ai_score?: number | null
          content_snapshot?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          owner_user_id?: string | null
          ref_id: string
          ref_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          action_notes?: string | null
          ai_categories?: Json | null
          ai_provider?: string | null
          ai_score?: number | null
          content_snapshot?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          owner_user_id?: string | null
          ref_id?: string
          ref_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_flags_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          ref_id: string | null
          ref_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_type?: string | null
          title?: string
          type?: string
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
      payment_reminder_log: {
        Row: {
          channel: string
          enrollment_id: string | null
          id: string
          notes: string | null
          payment_id: string | null
          sent_at: string | null
          sent_by: string
        }
        Insert: {
          channel?: string
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          sent_at?: string | null
          sent_by: string
        }
        Update: {
          channel?: string
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          sent_at?: string | null
          sent_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          batch_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          due_date: string | null
          enrollment_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payer_user_id: string
          payment_date: string | null
          payment_method: string | null
          payment_mode: string | null
          payment_period_end: string | null
          payment_period_start: string | null
          payment_type: string
          provider_id: string
          receipt_url: string | null
          reference_number: string | null
          screenshot_url: string | null
          status: string
          updated_at: string
          upi_transaction_id: string | null
        }
        Insert: {
          amount: number
          batch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payer_user_id: string
          payment_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_period_end?: string | null
          payment_period_start?: string | null
          payment_type?: string
          provider_id: string
          receipt_url?: string | null
          reference_number?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          upi_transaction_id?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payer_user_id?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_period_end?: string | null
          payment_period_start?: string | null
          payment_type?: string
          provider_id?: string
          receipt_url?: string | null
          reference_number?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          upi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
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
      platform_payment_details: {
        Row: {
          account_holder: string | null
          bank_account: string | null
          bank_name: string | null
          id: string
          ifsc: string | null
          singleton: boolean
          updated_at: string
          updated_by: string | null
          upi_id: string | null
          upi_qr_url: string | null
        }
        Insert: {
          account_holder?: string | null
          bank_account?: string | null
          bank_name?: string | null
          id?: string
          ifsc?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
        }
        Update: {
          account_holder?: string | null
          bank_account?: string | null
          bank_name?: string | null
          id?: string
          ifsc?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_payment_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_subscription_requests: {
        Row: {
          amount_paid: number | null
          billing_period: string | null
          granted_until: string | null
          id: string
          notes: string | null
          off_app_payment_ref: string | null
          provider_id: string
          rejection_reason: string | null
          requested_at: string
          requested_tier: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          amount_paid?: number | null
          billing_period?: string | null
          granted_until?: string | null
          id?: string
          notes?: string | null
          off_app_payment_ref?: string | null
          provider_id: string
          rejection_reason?: string | null
          requested_at?: string
          requested_tier?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          amount_paid?: number | null
          billing_period?: string | null
          granted_until?: string | null
          id?: string
          notes?: string | null
          off_app_payment_ref?: string | null
          provider_id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_tier?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_subscription_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_subscription_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_id: string
          reward_type: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_id: string
          reward_type?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_id?: string
          reward_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          batch_id: string | null
          class_id: string
          created_at: string
          enrollment_id: string | null
          family_member_id: string | null
          id: string
          is_verified: boolean
          is_visible: boolean
          provider_replied_at: string | null
          provider_reply: string | null
          rating: number
          review_text: string | null
          reviewer_user_id: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          class_id: string
          created_at?: string
          enrollment_id?: string | null
          family_member_id?: string | null
          id?: string
          is_verified?: boolean
          is_visible?: boolean
          provider_replied_at?: string | null
          provider_reply?: string | null
          rating: number
          review_text?: string | null
          reviewer_user_id: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          class_id?: string
          created_at?: string
          enrollment_id?: string | null
          family_member_id?: string | null
          id?: string
          is_verified?: boolean
          is_visible?: boolean
          provider_replied_at?: string | null
          provider_reply?: string | null
          rating?: number
          review_text?: string | null
          reviewer_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "reviews_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
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
          business_name: string
          created_at: string
          experience_years: number | null
          home_address: string | null
          home_location: unknown
          id: string
          intro_video_url: string | null
          is_verified: boolean
          logo_url: string | null
          provider_type: string
          qualifications: string | null
          specialization_category_ids: string[] | null
          specializations: string[] | null
          subscription_tier: string
          subscription_valid_until: string | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
          upi_id: string | null
          upi_qr_image_url: string | null
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          bio?: string | null
          business_name: string
          created_at?: string
          experience_years?: number | null
          home_address?: string | null
          home_location?: unknown
          id?: string
          intro_video_url?: string | null
          is_verified?: boolean
          logo_url?: string | null
          provider_type?: string
          qualifications?: string | null
          specialization_category_ids?: string[] | null
          specializations?: string[] | null
          subscription_tier?: string
          subscription_valid_until?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          upi_id?: string | null
          upi_qr_image_url?: string | null
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          bio?: string | null
          business_name?: string
          created_at?: string
          experience_years?: number | null
          home_address?: string | null
          home_location?: unknown
          id?: string
          intro_video_url?: string | null
          is_verified?: boolean
          logo_url?: string | null
          provider_type?: string
          qualifications?: string | null
          specialization_category_ids?: string[] | null
          specializations?: string[] | null
          subscription_tier?: string
          subscription_valid_until?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          upi_id?: string | null
          upi_qr_image_url?: string | null
          user_id?: string
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sponsored_listings: {
        Row: {
          category_id: string | null
          class_id: string
          click_count: number
          id: string
          impression_count: number
          off_app_payment_ref: string | null
          provider_id: string
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          slot_position: number | null
          status: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          category_id?: string | null
          class_id: string
          click_count?: number
          id?: string
          impression_count?: number
          off_app_payment_ref?: string | null
          provider_id: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slot_position?: number | null
          status?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          category_id?: string | null
          class_id?: string
          click_count?: number
          id?: string
          impression_count?: number
          off_app_payment_ref?: string | null
          provider_id?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slot_position?: number | null
          status?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_listings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_listings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_listings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          duration_days: number
          id: string
          is_active: boolean
          mrp: number
          price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_period: string
          created_at?: string
          currency?: string
          duration_days: number
          id?: string
          is_active?: boolean
          mrp?: number
          price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          mrp?: number
          price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_request_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string
          size_bytes: number
          support_request_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          size_bytes: number
          support_request_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          support_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_request_attachments_support_request_id_fkey"
            columns: ["support_request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          body: string
          created_at: string
          id: string
          resolution_comment: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          experience_years: number | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          photo_url: string | null
          provider_id: string
          qualifications: string | null
          specialization: string | null
          specializations: string[] | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          provider_id: string
          qualifications?: string | null
          specialization?: string | null
          specializations?: string[] | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          provider_id?: string
          qualifications?: string | null
          specialization?: string | null
          specializations?: string[] | null
          updated_at?: string
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
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_platform_admin: boolean
          is_provider: boolean
          is_verified: boolean
          last_active_persona: string
          mobile_number: string | null
          seeker_home_address: string | null
          seeker_home_lat: number | null
          seeker_home_lng: number | null
          seeker_home_location: unknown
          updated_at: string
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_platform_admin?: boolean
          is_provider?: boolean
          is_verified?: boolean
          last_active_persona?: string
          mobile_number?: string | null
          seeker_home_address?: string | null
          seeker_home_lat?: number | null
          seeker_home_lng?: number | null
          seeker_home_location?: unknown
          updated_at?: string
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_platform_admin?: boolean
          is_provider?: boolean
          is_verified?: boolean
          last_active_persona?: string
          mobile_number?: string | null
          seeker_home_address?: string | null
          seeker_home_lat?: number | null
          seeker_home_lng?: number | null
          seeker_home_location?: unknown
          updated_at?: string
        }
        Relationships: []
      }
      v_caller_id: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          batch_id: string
          created_at: string
          expires_at: string | null
          family_member_id: string
          id: string
          offered_at: string | null
          position: number
          status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          expires_at?: string | null
          family_member_id: string
          id?: string
          offered_at?: string | null
          position: number
          status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          expires_at?: string | null
          family_member_id?: string
          id?: string
          offered_at?: string | null
          position?: number
          status?: string
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
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cat_notify: {
        Args: {
          p_body: string
          p_ref_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      _mirror_moderation_status: {
        Args: { p_ref_id: string; p_ref_type: string; p_status: string }
        Returns: undefined
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _sponsored_slot_count: {
        Args: { p_category_id: string }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_coach_invites: { Args: never; Returns: number }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      approve_category_request: {
        Args: {
          p_admin_user_id: string
          p_final_icon?: string
          p_final_name: string
          p_parent_id?: string
          p_request_id: string
        }
        Returns: string
      }
      approve_subscription_request: {
        Args: { p_request_id: string; p_valid_until?: string }
        Returns: undefined
      }
      assign_coach: {
        Args: {
          p_coach_id: string
          p_is_temporary?: boolean
          p_scope_id: string
          p_scope_type: string
          p_valid_from?: string
          p_valid_until?: string
        }
        Returns: {
          coach_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_temporary: boolean
          original_coach_id: string | null
          scope_id: string
          scope_type: string
          status: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "coach_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_approve_certifications: {
        Args: { p_cert_ids: string[]; p_notes?: string; p_provider_id: string }
        Returns: {
          approved_count: number
          skipped_count: number
        }[]
      }
      create_own_family: { Args: never; Returns: string }
      current_academy_provider_ids: { Args: never; Returns: string[] }
      current_coach_ids: { Args: never; Returns: string[] }
      current_user_id: { Args: never; Returns: string }
      delete_family_member: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      disablelongtransactions: { Args: never; Returns: string }
      distance_to_class: {
        Args: { p_class_id: string; p_lat: number; p_lng: number }
        Returns: number
      }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      effective_class_location: {
        Args: { p_class_id: string }
        Returns: unknown
      }
      enablelongtransactions: { Args: never; Returns: string }
      end_coach_assignment: {
        Args: { p_assignment_id: string }
        Returns: {
          coach_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_temporary: boolean
          original_coach_id: string | null
          scope_id: string
          scope_type: string
          status: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "coach_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_self_family_member: {
        Args: { p_family_id: string; p_full_name: string }
        Returns: string
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_premium_subscriptions: { Args: never; Returns: number }
      featured_banners_for_location: {
        Args: { p_lat: number; p_lng: number; p_surface: string }
        Returns: {
          class_id: string
          distance_km: number
          id: string
          image_url: string
          provider_id: string
          surface: string
          target_url: string
          valid_until: string
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_legal_document: {
        Args: { p_doc_type: string }
        Returns: {
          doc_type: string
          html_content: string
          id: string
          title: string
          uploaded_at: string
          version: number
        }[]
      }
      get_pending_moderation_count: { Args: never; Returns: number }
      get_provider_student_names: {
        Args: { p_batch_ids: string[] }
        Returns: {
          enrollment_id: string
          seeker_avatar: string
          seeker_id: string
          seeker_name: string
          student_age_grp: string
          student_dob: string
          student_name: string
          student_relation: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increment_banner_click: { Args: { p_id: string }; Returns: undefined }
      increment_banner_impression: {
        Args: { p_id: string }
        Returns: undefined
      }
      increment_sponsored_click: { Args: { p_id: string }; Returns: undefined }
      increment_sponsored_impression: {
        Args: { p_id: string }
        Returns: undefined
      }
      invite_coach: {
        Args: {
          p_academy_provider_id: string
          p_bio?: string
          p_email: string
          p_experience_years?: number
          p_full_name: string
          p_phone?: string
          p_photo_url?: string
          p_qualifications?: string
          p_specializations?: string[]
        }
        Returns: {
          academy_provider_id: string
          accepted_at: string | null
          bio: string | null
          created_at: string | null
          email: string
          experience_years: number | null
          full_name: string
          id: string
          invited_at: string | null
          invited_by: string | null
          linked_user_id: string | null
          phone: string | null
          photo_url: string | null
          qualifications: string | null
          removed_at: string | null
          specializations: string[] | null
          status: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "coaches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_academy_member: { Args: { p_provider_id: string }; Returns: boolean }
      is_chat_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_class_owner: { Args: { p_class_id: string }; Returns: boolean }
      is_coach_of_batch: { Args: { p_batch_id: string }; Returns: boolean }
      is_coach_of_class: { Args: { p_class_id: string }; Returns: boolean }
      is_enrolled_by_my_provider: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_in_family: { Args: { p_family_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_premium: { Args: { p_provider_id: string }; Returns: boolean }
      is_provider_owner: { Args: { p_provider_id: string }; Returns: boolean }
      learner_cancel_batch_switch: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      learner_drop_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      learner_request_batch_switch: {
        Args: {
          p_enrollment_id: string
          p_reason?: string
          p_to_batch_id: string
        }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      nearby_classes: {
        Args: {
          p_category_id?: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_offset?: number
          p_radius_km?: number
        }
        Returns: {
          distance_km: number
          id: string
        }[]
      }
      nearby_sponsored: {
        Args: {
          p_category_id?: string
          p_lat: number
          p_limit?: number
          p_lng: number
        }
        Returns: {
          class_id: string
          distance_km: number
          provider_id: string
          slot_position: number
          sponsored_id: string
        }[]
      }
      owns_enrollment: { Args: { p_enrollment_id: string }; Returns: boolean }
      owns_family_member: { Args: { p_member_id: string }; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      provider_approve_batch_switch: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      provider_of_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: boolean
      }
      provider_reject_batch_switch: {
        Args: { p_enrollment_id: string; p_reason?: string }
        Returns: undefined
      }
      publish_legal_document: {
        Args: {
          p_doc_type: string
          p_file_path?: string
          p_html: string
          p_title: string
        }
        Returns: string
      }
      record_legal_acceptance: {
        Args: {
          p_doc_type: string
          p_fingerprint?: string
          p_ip?: string
          p_user_agent?: string
        }
        Returns: string
      }
      refresh_sponsored_lifecycle: {
        Args: never
        Returns: {
          banners_activated: number
          banners_expired: number
          sponsored_activated: number
          sponsored_expired: number
        }[]
      }
      reject_category_request: {
        Args: {
          p_admin_user_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: undefined
      }
      reject_subscription_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: undefined
      }
      remove_coach: {
        Args: { p_coach_id: string }
        Returns: {
          academy_provider_id: string
          accepted_at: string | null
          bio: string | null
          created_at: string | null
          email: string
          experience_years: number | null
          full_name: string
          id: string
          invited_at: string | null
          invited_by: string | null
          linked_user_id: string | null
          phone: string | null
          photo_url: string | null
          qualifications: string | null
          removed_at: string | null
          specializations: string[] | null
          status: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "coaches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_premium_upgrade: {
        Args: {
          p_amount_paid?: number
          p_billing_period?: string
          p_notes?: string
          p_off_app_payment_ref?: string
          p_provider_id: string
        }
        Returns: string
      }
      resolve_moderation_flag: {
        Args: { p_flag_id: string; p_notes?: string; p_status: string }
        Returns: undefined
      }
      resolve_support_request: {
        Args: { p_comment?: string; p_request_id: string }
        Returns: undefined
      }
      respond_to_category_retag: {
        Args: { p_accepted: boolean; p_request_id: string }
        Returns: undefined
      }
      retag_category_request: {
        Args: {
          p_admin_user_id: string
          p_notes?: string
          p_request_id: string
          p_retag_cat_id: string
        }
        Returns: undefined
      }
      revert_expired_coach_assignments: { Args: never; Returns: number }
      send_notification: {
        Args: {
          p_body: string
          p_ref_id?: string
          p_ref_type?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      send_payment_reminder: {
        Args: { p_notes?: string; p_payment_id: string }
        Returns: {
          channel: string
          enrollment_id: string | null
          id: string
          notes: string | null
          payment_id: string | null
          sent_at: string | null
          sent_by: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_reminder_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sponsored_for_location: {
        Args: { p_category_id?: string; p_lat: number; p_lng: number }
        Returns: {
          category_id: string
          class_id: string
          id: string
          provider_id: string
          slot_position: number
          valid_until: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_for_moderation: {
        Args: {
          p_ai_categories?: Json
          p_ai_provider: string
          p_ai_score?: number
          p_content_snapshot?: string
          p_image_url?: string
          p_initial_status?: string
          p_owner_user_id: string
          p_ref_id: string
          p_ref_type: string
        }
        Returns: string
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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

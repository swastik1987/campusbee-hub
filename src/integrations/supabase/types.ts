export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string | null
          mobile_number: string | null
          full_name: string
          email: string | null
          avatar_url: string | null
          is_provider: boolean | null
          is_apartment_admin: boolean | null
          is_platform_admin: boolean | null
          is_verified: boolean | null
          last_active_persona: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          auth_id?: string | null
          mobile_number?: string | null
          full_name?: string
          email?: string | null
          avatar_url?: string | null
          is_provider?: boolean | null
          is_apartment_admin?: boolean | null
          is_platform_admin?: boolean | null
          is_verified?: boolean | null
          last_active_persona?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          auth_id?: string | null
          mobile_number?: string | null
          full_name?: string
          email?: string | null
          avatar_url?: string | null
          is_provider?: boolean | null
          is_apartment_admin?: boolean | null
          is_platform_admin?: boolean | null
          is_verified?: boolean | null
          last_active_persona?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      apartment_complexes: {
        Row: {
          id: string
          name: string
          city: string
          locality: string
          full_address: string | null
          pin_code: string | null
          total_units: number | null
          logo_url: string | null
          is_active: boolean | null
          status: string | null
          registered_by: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          city: string
          locality: string
          full_address?: string | null
          pin_code?: string | null
          total_units?: number | null
          logo_url?: string | null
          is_active?: boolean | null
          status?: string | null
          registered_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          city?: string
          locality?: string
          full_address?: string | null
          pin_code?: string | null
          total_units?: number | null
          logo_url?: string | null
          is_active?: boolean | null
          status?: string | null
          registered_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string | null
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
      apartment_admins: {
        Row: {
          id: string
          user_id: string
          apartment_id: string
          is_active: boolean | null
          fee_type: string | null
          fee_amount: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          apartment_id: string
          is_active?: boolean | null
          fee_type?: string | null
          fee_amount?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          apartment_id?: string
          is_active?: boolean | null
          fee_type?: string | null
          fee_amount?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartment_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_admins_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: true
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          id: string
          primary_user_id: string
          apartment_id: string
          flat_number: string | null
          block_tower: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          primary_user_id: string
          apartment_id: string
          flat_number?: string | null
          block_tower?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          primary_user_id?: string
          apartment_id?: string
          flat_number?: string | null
          block_tower?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          id: string
          family_id: string
          name: string
          date_of_birth: string | null
          age_group: string | null
          gender: string | null
          relationship: string | null
          avatar_url: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          date_of_birth?: string | null
          age_group?: string | null
          gender?: string | null
          relationship?: string | null
          avatar_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          date_of_birth?: string | null
          age_group?: string | null
          gender?: string | null
          relationship?: string | null
          avatar_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
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
      service_providers: {
        Row: {
          id: string
          user_id: string
          provider_type: string | null
          business_name: string | null
          bio: string | null
          experience_years: number | null
          qualifications: string | null
          specializations: string[] | null
          profile_photos: string[] | null
          intro_video_url: string | null
          whatsapp_number: string | null
          upi_id: string | null
          upi_qr_image_url: string | null
          website_url: string | null
          instagram_handle: string | null
          is_verified: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          provider_type?: string | null
          business_name?: string | null
          bio?: string | null
          experience_years?: number | null
          qualifications?: string | null
          specializations?: string[] | null
          profile_photos?: string[] | null
          intro_video_url?: string | null
          whatsapp_number?: string | null
          upi_id?: string | null
          upi_qr_image_url?: string | null
          website_url?: string | null
          instagram_handle?: string | null
          is_verified?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          provider_type?: string | null
          business_name?: string | null
          bio?: string | null
          experience_years?: number | null
          qualifications?: string | null
          specializations?: string[] | null
          profile_photos?: string[] | null
          intro_video_url?: string | null
          whatsapp_number?: string | null
          upi_id?: string | null
          upi_qr_image_url?: string | null
          website_url?: string | null
          instagram_handle?: string | null
          is_verified?: boolean | null
          created_at?: string | null
          updated_at?: string | null
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
          id: string
          provider_id: string
          name: string
          bio: string | null
          qualifications: string | null
          experience_years: number | null
          specializations: string[] | null
          photo_url: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          provider_id: string
          name: string
          bio?: string | null
          qualifications?: string | null
          experience_years?: number | null
          specializations?: string[] | null
          photo_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          provider_id?: string
          name?: string
          bio?: string | null
          qualifications?: string | null
          experience_years?: number | null
          specializations?: string[] | null
          photo_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
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
      provider_apartment_registrations: {
        Row: {
          id: string
          provider_id: string
          apartment_id: string
          status: string | null
          admin_fee_type: string | null
          admin_fee_amount: number | null
          approved_by: string | null
          approved_at: string | null
          suspended_at: string | null
          suspension_reason: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          provider_id: string
          apartment_id: string
          status?: string | null
          admin_fee_type?: string | null
          admin_fee_amount?: number | null
          approved_by?: string | null
          approved_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          provider_id?: string
          apartment_id?: string
          status?: string | null
          admin_fee_type?: string | null
          admin_fee_amount?: number | null
          approved_by?: string | null
          approved_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_apartment_registrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
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
        ]
      }
      class_categories: {
        Row: {
          id: string
          name: string
          slug: string
          icon_name: string | null
          parent_category_id: string | null
          display_order: number | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          icon_name?: string | null
          parent_category_id?: string | null
          display_order?: number | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          icon_name?: string | null
          parent_category_id?: string | null
          display_order?: number | null
          is_active?: boolean | null
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
      classes: {
        Row: {
          id: string
          provider_registration_id: string
          category_id: string
          title: string
          description: string | null
          short_description: string | null
          cover_image_url: string | null
          gallery_urls: string[] | null
          promo_video_url: string | null
          class_type: string | null
          skill_level: string[] | null
          age_group_min: number | null
          age_group_max: number | null
          venue_details: string | null
          what_to_bring: string | null
          trial_available: boolean | null
          trial_fee: number | null
          status: string | null
          is_featured: boolean | null
          total_rating: number | null
          rating_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          provider_registration_id: string
          category_id: string
          title: string
          description?: string | null
          short_description?: string | null
          cover_image_url?: string | null
          gallery_urls?: string[] | null
          promo_video_url?: string | null
          class_type?: string | null
          skill_level?: string[] | null
          age_group_min?: number | null
          age_group_max?: number | null
          venue_details?: string | null
          what_to_bring?: string | null
          trial_available?: boolean | null
          trial_fee?: number | null
          status?: string | null
          is_featured?: boolean | null
          total_rating?: number | null
          rating_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          provider_registration_id?: string
          category_id?: string
          title?: string
          description?: string | null
          short_description?: string | null
          cover_image_url?: string | null
          gallery_urls?: string[] | null
          promo_video_url?: string | null
          class_type?: string | null
          skill_level?: string[] | null
          age_group_min?: number | null
          age_group_max?: number | null
          venue_details?: string | null
          what_to_bring?: string | null
          trial_available?: boolean | null
          trial_fee?: number | null
          status?: string | null
          is_featured?: boolean | null
          total_rating?: number | null
          rating_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_provider_registration_id_fkey"
            columns: ["provider_registration_id"]
            isOneToOne: false
            referencedRelation: "provider_apartment_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "class_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          id: string
          class_id: string
          trainer_id: string | null
          batch_name: string
          batch_type: string | null
          skill_level: string | null
          age_group_min: number | null
          age_group_max: number | null
          max_batch_size: number
          current_enrollment_count: number | null
          fee_amount: number
          fee_frequency: string
          start_date: string | null
          end_date: string | null
          total_sessions: number | null
          status: string | null
          registration_mode: string | null
          auto_waitlist: boolean | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          class_id: string
          trainer_id?: string | null
          batch_name: string
          batch_type?: string | null
          skill_level?: string | null
          age_group_min?: number | null
          age_group_max?: number | null
          max_batch_size: number
          current_enrollment_count?: number | null
          fee_amount: number
          fee_frequency: string
          start_date?: string | null
          end_date?: string | null
          total_sessions?: number | null
          status?: string | null
          registration_mode?: string | null
          auto_waitlist?: boolean | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          class_id?: string
          trainer_id?: string | null
          batch_name?: string
          batch_type?: string | null
          skill_level?: string | null
          age_group_min?: number | null
          age_group_max?: number | null
          max_batch_size?: number
          current_enrollment_count?: number | null
          fee_amount?: number
          fee_frequency?: string
          start_date?: string | null
          end_date?: string | null
          total_sessions?: number | null
          status?: string | null
          registration_mode?: string | null
          auto_waitlist?: boolean | null
          notes?: string | null
          created_at?: string | null
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
      batch_schedules: {
        Row: {
          id: string
          batch_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active: boolean | null
        }
        Insert: {
          id?: string
          batch_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active?: boolean | null
        }
        Update: {
          id?: string
          batch_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_active?: boolean | null
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
      class_addons: {
        Row: {
          id: string
          class_id: string
          name: string
          description: string | null
          fee_amount: number
          fee_type: string | null
          is_mandatory: boolean | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          class_id: string
          name: string
          description?: string | null
          fee_amount: number
          fee_type?: string | null
          is_mandatory?: boolean | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          class_id?: string
          name?: string
          description?: string | null
          fee_amount?: number
          fee_type?: string | null
          is_mandatory?: boolean | null
          is_active?: boolean | null
          created_at?: string | null
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
      demo_sessions: {
        Row: {
          id: string
          class_id: string
          session_date: string
          start_time: string
          end_time: string
          max_participants: number | null
          current_count: number | null
          fee: number | null
          status: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          class_id: string
          session_date: string
          start_time: string
          end_time: string
          max_participants?: number | null
          current_count?: number | null
          fee?: number | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          class_id?: string
          session_date?: string
          start_time?: string
          end_time?: string
          max_participants?: number | null
          current_count?: number | null
          fee?: number | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
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
      demo_registrations: {
        Row: {
          id: string
          demo_session_id: string
          family_member_id: string
          registered_by: string
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          demo_session_id: string
          family_member_id: string
          registered_by: string
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          demo_session_id?: string
          family_member_id?: string
          registered_by?: string
          status?: string | null
          created_at?: string | null
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
      enrollments: {
        Row: {
          id: string
          batch_id: string
          family_member_id: string
          enrolled_by: string
          status: string | null
          enrolled_at: string | null
          approved_at: string | null
          dropped_at: string | null
          drop_reason: string | null
          selected_addon_ids: string[] | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          batch_id: string
          family_member_id: string
          enrolled_by: string
          status?: string | null
          enrolled_at?: string | null
          approved_at?: string | null
          dropped_at?: string | null
          drop_reason?: string | null
          selected_addon_ids?: string[] | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          batch_id?: string
          family_member_id?: string
          enrolled_by?: string
          status?: string | null
          enrolled_at?: string | null
          approved_at?: string | null
          dropped_at?: string | null
          drop_reason?: string | null
          selected_addon_ids?: string[] | null
          notes?: string | null
          created_at?: string | null
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
            foreignKeyName: "enrollments_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          id: string
          batch_id: string
          family_member_id: string
          requested_by: string
          position: number
          status: string | null
          offered_at: string | null
          offer_expires_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          batch_id: string
          family_member_id: string
          requested_by: string
          position: number
          status?: string | null
          offered_at?: string | null
          offer_expires_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          batch_id?: string
          family_member_id?: string
          requested_by?: string
          position?: number
          status?: string | null
          offered_at?: string | null
          offer_expires_at?: string | null
          created_at?: string | null
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
      attendance_records: {
        Row: {
          id: string
          enrollment_id: string
          batch_id: string
          session_date: string
          status: string | null
          marked_by: string
          marked_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          batch_id: string
          session_date: string
          status?: string | null
          marked_by: string
          marked_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          batch_id?: string
          session_date?: string
          status?: string | null
          marked_by?: string
          marked_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
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
      payments: {
        Row: {
          id: string
          enrollment_id: string | null
          payer_user_id: string
          provider_id: string
          amount: number
          payment_type: string
          payment_method: string | null
          upi_transaction_id: string | null
          payment_period_start: string | null
          payment_period_end: string | null
          status: string | null
          due_date: string | null
          paid_at: string | null
          confirmed_by: string | null
          confirmed_at: string | null
          notes: string | null
          receipt_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          enrollment_id?: string | null
          payer_user_id: string
          provider_id: string
          amount: number
          payment_type: string
          payment_method?: string | null
          upi_transaction_id?: string | null
          payment_period_start?: string | null
          payment_period_end?: string | null
          status?: string | null
          due_date?: string | null
          paid_at?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          notes?: string | null
          receipt_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          enrollment_id?: string | null
          payer_user_id?: string
          provider_id?: string
          amount?: number
          payment_type?: string
          payment_method?: string | null
          upi_transaction_id?: string | null
          payment_period_start?: string | null
          payment_period_end?: string | null
          status?: string | null
          due_date?: string | null
          paid_at?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          notes?: string | null
          receipt_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_fee_payments: {
        Row: {
          id: string
          provider_registration_id: string
          amount: number
          period_month: number
          period_year: number
          total_provider_revenue: number | null
          total_enrollments: number | null
          commission_type: string | null
          commission_rate: number | null
          calculated_from_revenue: number | null
          status: string | null
          payment_method: string | null
          upi_transaction_id: string | null
          invoice_url: string | null
          paid_at: string | null
          confirmed_at: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          provider_registration_id: string
          amount: number
          period_month: number
          period_year: number
          total_provider_revenue?: number | null
          total_enrollments?: number | null
          commission_type?: string | null
          commission_rate?: number | null
          calculated_from_revenue?: number | null
          status?: string | null
          payment_method?: string | null
          upi_transaction_id?: string | null
          invoice_url?: string | null
          paid_at?: string | null
          confirmed_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          provider_registration_id?: string
          amount?: number
          period_month?: number
          period_year?: number
          total_provider_revenue?: number | null
          total_enrollments?: number | null
          commission_type?: string | null
          commission_rate?: number | null
          calculated_from_revenue?: number | null
          status?: string | null
          payment_method?: string | null
          upi_transaction_id?: string | null
          invoice_url?: string | null
          paid_at?: string | null
          confirmed_at?: string | null
          notes?: string | null
          created_at?: string | null
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
      platform_fee_config: {
        Row: {
          id: string
          fee_type: string | null
          fee_value: number | null
          applies_to: string | null
          is_active: boolean | null
          effective_from: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          fee_type?: string | null
          fee_value?: number | null
          applies_to?: string | null
          is_active?: boolean | null
          effective_from?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          fee_type?: string | null
          fee_value?: number | null
          applies_to?: string | null
          is_active?: boolean | null
          effective_from?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          class_id: string
          reviewer_user_id: string
          enrollment_id: string | null
          rating: number
          review_text: string | null
          is_verified: boolean | null
          provider_reply: string | null
          provider_replied_at: string | null
          is_visible: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          class_id: string
          reviewer_user_id: string
          enrollment_id?: string | null
          rating: number
          review_text?: string | null
          is_verified?: boolean | null
          provider_reply?: string | null
          provider_replied_at?: string | null
          is_visible?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          class_id?: string
          reviewer_user_id?: string
          enrollment_id?: string | null
          rating?: number
          review_text?: string | null
          is_verified?: boolean | null
          provider_reply?: string | null
          provider_replied_at?: string | null
          is_visible?: boolean | null
          created_at?: string | null
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
            foreignKeyName: "reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          id: string
          author_id: string
          apartment_id: string | null
          class_id: string | null
          batch_id: string | null
          target_audience: string
          title: string
          body: string
          announcement_type: string | null
          is_pinned: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          author_id: string
          apartment_id?: string | null
          class_id?: string | null
          batch_id?: string | null
          target_audience: string
          title: string
          body: string
          announcement_type?: string | null
          is_pinned?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          author_id?: string
          apartment_id?: string | null
          class_id?: string | null
          batch_id?: string | null
          target_audience?: string
          title?: string
          body?: string
          announcement_type?: string | null
          is_pinned?: boolean | null
          created_at?: string | null
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
            foreignKeyName: "announcements_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
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
            foreignKeyName: "announcements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          id: string
          participant_1: string
          participant_2: string
          last_message_at: string | null
          last_message_preview: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          participant_1: string
          participant_2: string
          last_message_at?: string | null
          last_message_preview?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          participant_1?: string
          participant_2?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          created_at?: string | null
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
          id: string
          conversation_id: string
          sender_id: string
          message_text: string
          message_type: string | null
          is_read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          message_text: string
          message_type?: string | null
          is_read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          message_text?: string
          message_type?: string | null
          is_read?: boolean | null
          created_at?: string | null
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
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          notification_type: string
          reference_type: string | null
          reference_id: string | null
          is_read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body: string
          notification_type: string
          reference_type?: string | null
          reference_id?: string | null
          is_read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          notification_type?: string
          reference_type?: string | null
          reference_id?: string | null
          is_read?: boolean | null
          created_at?: string | null
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
      class_materials: {
        Row: {
          id: string
          class_id: string
          batch_id: string | null
          uploaded_by: string
          title: string
          description: string | null
          material_type: string
          file_url: string | null
          external_url: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          class_id: string
          batch_id?: string | null
          uploaded_by: string
          title: string
          description?: string | null
          material_type: string
          file_url?: string | null
          external_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          class_id?: string
          batch_id?: string | null
          uploaded_by?: string
          title?: string
          description?: string | null
          material_type?: string
          file_url?: string | null
          external_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
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
      referrals: {
        Row: {
          id: string
          referrer_user_id: string
          referred_user_id: string | null
          apartment_id: string
          referral_code: string
          status: string | null
          reward_type: string | null
          reward_value: number | null
          created_at: string | null
          converted_at: string | null
        }
        Insert: {
          id?: string
          referrer_user_id: string
          referred_user_id?: string | null
          apartment_id: string
          referral_code: string
          status?: string | null
          reward_type?: string | null
          reward_value?: number | null
          created_at?: string | null
          converted_at?: string | null
        }
        Update: {
          id?: string
          referrer_user_id?: string
          referred_user_id?: string | null
          apartment_id?: string
          referral_code?: string
          status?: string | null
          reward_type?: string | null
          reward_value?: number | null
          created_at?: string | null
          converted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
            foreignKeyName: "referrals_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_platform_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
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

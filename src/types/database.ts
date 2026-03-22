// ============================================================
// CampusBee Application-Level TypeScript Interfaces
// Matches the complete database schema (28 tables)
// ============================================================

// ---- Users & Auth ----

export interface User {
  id: string;
  auth_id: string | null;
  mobile_number: string | null;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  is_provider: boolean;
  is_apartment_admin: boolean;
  is_platform_admin: boolean;
  last_active_persona: 'seeker' | 'provider' | 'apartment_admin' | 'platform_admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Apartments ----

export interface ApartmentComplex {
  id: string;
  name: string;
  city: string;
  locality: string;
  full_address: string | null;
  pin_code: string | null;
  total_units: number | null;
  logo_url: string | null;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  registered_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApartmentAdmin {
  id: string;
  user_id: string;
  apartment_id: string;
  is_active: boolean;
  fee_type: 'flat' | 'percentage';
  fee_amount: number;
  created_at: string;
}

// ---- Families ----

export interface Family {
  id: string;
  primary_user_id: string;
  apartment_id: string;
  flat_number: string | null;
  block_tower: string | null;
  created_at: string;
  updated_at: string;
}

export type AgeGroup = 'toddler' | 'child' | 'teen' | 'adult' | 'senior';

export interface FamilyMember {
  id: string;
  family_id: string;
  name: string;
  date_of_birth: string | null;
  age_group: AgeGroup | null;
  gender: string | null;
  relationship: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Providers & Trainers ----

export type ProviderType = 'individual' | 'academy';

export interface ServiceProvider {
  id: string;
  user_id: string;
  provider_type: ProviderType;
  business_name: string | null;
  bio: string | null;
  experience_years: number | null;
  qualifications: string | null;
  specializations: string[];
  profile_photos: string[];
  intro_video_url: string | null;
  whatsapp_number: string | null;
  upi_id: string | null;
  upi_qr_image_url: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  provider_id: string;
  name: string;
  bio: string | null;
  qualifications: string | null;
  experience_years: number | null;
  specializations: string[];
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Provider <-> Apartment Link ----

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface ProviderApartmentRegistration {
  id: string;
  provider_id: string;
  apartment_id: string;
  status: RegistrationStatus;
  admin_fee_type: 'flat' | 'percentage' | 'custom' | null;
  admin_fee_amount: number | null;
  approved_by: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Categories ----

export interface ClassCategory {
  id: string;
  name: string;
  slug: string;
  icon_name: string | null;
  parent_category_id: string | null;
  display_order: number;
  is_active: boolean;
}

// ---- Classes ----

export type ClassType = 'recurring' | 'fixed_duration' | 'one_time';
export type ClassStatus = 'draft' | 'published' | 'paused' | 'archived';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export interface Class {
  id: string;
  provider_registration_id: string;
  category_id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  promo_video_url: string | null;
  class_type: ClassType;
  skill_level: string[];
  age_group_min: number | null;
  age_group_max: number | null;
  venue_details: string | null;
  what_to_bring: string | null;
  trial_available: boolean;
  trial_fee: number;
  status: ClassStatus;
  is_featured: boolean;
  total_rating: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

// ---- Batches & Schedules ----

export type BatchType = 'level' | 'age_group' | 'time_slot' | 'custom';
export type BatchStatus = 'draft' | 'active' | 'full' | 'paused' | 'completed' | 'cancelled';
export type FeeFrequency = 'per_session' | 'monthly' | 'quarterly' | 'for_duration' | 'one_time';

export interface Batch {
  id: string;
  class_id: string;
  trainer_id: string | null;
  batch_name: string;
  batch_type: BatchType;
  skill_level: SkillLevel | null;
  age_group_min: number | null;
  age_group_max: number | null;
  max_batch_size: number;
  current_enrollment_count: number;
  fee_amount: number;
  fee_frequency: FeeFrequency;
  start_date: string | null;
  end_date: string | null;
  total_sessions: number | null;
  status: BatchStatus;
  registration_mode: 'auto' | 'manual';
  auto_waitlist: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchSchedule {
  id: string;
  batch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ---- Class Addons ----

export interface ClassAddon {
  id: string;
  class_id: string;
  name: string;
  description: string | null;
  fee_amount: number;
  fee_type: 'one_time' | 'monthly' | 'per_event';
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
}

// ---- Demo / Trial Sessions ----

export type DemoStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface DemoSession {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  current_count: number;
  fee: number;
  status: DemoStatus;
  notes: string | null;
  created_at: string;
}

export type DemoRegistrationStatus = 'registered' | 'attended' | 'no_show' | 'cancelled';

export interface DemoRegistration {
  id: string;
  demo_session_id: string;
  family_member_id: string;
  registered_by: string;
  status: DemoRegistrationStatus;
  created_at: string;
}

// ---- Enrollments & Waitlist ----

export type EnrollmentStatus = 'pending' | 'active' | 'paused' | 'completed' | 'dropped' | 'rejected';

export interface Enrollment {
  id: string;
  batch_id: string;
  family_member_id: string;
  enrolled_by: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  approved_at: string | null;
  dropped_at: string | null;
  drop_reason: string | null;
  selected_addon_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WaitlistStatus = 'waiting' | 'offered' | 'enrolled' | 'expired' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  batch_id: string;
  family_member_id: string;
  requested_by: string;
  position: number;
  status: WaitlistStatus;
  offered_at: string | null;
  offer_expires_at: string | null;
  created_at: string;
}

// ---- Attendance ----

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  enrollment_id: string;
  batch_id: string;
  session_date: string;
  status: AttendanceStatus;
  marked_by: string;
  marked_at: string;
  notes: string | null;
}

// ---- Payments ----

export type PaymentType = 'class_fee' | 'addon_fee' | 'demo_fee' | 'admin_fee';
export type PaymentMethod = 'upi' | 'cash' | 'bank_transfer' | 'other';
export type PaymentStatus = 'pending' | 'recorded' | 'confirmed' | 'disputed' | 'refunded';

export interface Payment {
  id: string;
  enrollment_id: string | null;
  payer_user_id: string;
  provider_id: string;
  amount: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  upi_transaction_id: string | null;
  payment_period_start: string | null;
  payment_period_end: string | null;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Admin Fee / Commission ----

export type AdminFeeStatus = 'pending' | 'paid' | 'confirmed' | 'waived' | 'disputed';

export interface AdminFeePayment {
  id: string;
  provider_registration_id: string;
  amount: number;
  period_month: number;
  period_year: number;
  total_provider_revenue: number | null;
  total_enrollments: number | null;
  commission_type: string | null;
  commission_rate: number | null;
  calculated_from_revenue: number | null;
  status: AdminFeeStatus;
  payment_method: string | null;
  upi_transaction_id: string | null;
  invoice_url: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
}

// ---- Platform Fee Config ----

export interface PlatformFeeConfig {
  id: string;
  fee_type: 'flat_per_transaction' | 'percentage' | 'monthly_subscription' | null;
  fee_value: number | null;
  applies_to: 'provider' | 'apartment_admin' | 'both' | null;
  is_active: boolean;
  effective_from: string | null;
  created_at: string;
}

// ---- Reviews ----

export interface Review {
  id: string;
  class_id: string;
  reviewer_user_id: string;
  enrollment_id: string | null;
  rating: number;
  review_text: string | null;
  is_verified: boolean;
  provider_reply: string | null;
  provider_replied_at: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Announcements ----

export type AnnouncementType = 'general' | 'schedule_change' | 'cancellation' | 'new_batch' | 'event' | 'urgent';
export type TargetAudience = 'all_apartment' | 'class_students' | 'batch_students';

export interface Announcement {
  id: string;
  author_id: string;
  apartment_id: string | null;
  class_id: string | null;
  batch_id: string | null;
  target_audience: TargetAudience;
  title: string;
  body: string;
  announcement_type: AnnouncementType;
  is_pinned: boolean;
  created_at: string;
}

// ---- Chat ----

export interface ChatConversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
}

export type MessageType = 'text' | 'image' | 'system';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  message_type: MessageType;
  is_read: boolean;
  created_at: string;
}

// ---- Notifications ----

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ---- Class Materials ----

export type MaterialType = 'document' | 'video' | 'link' | 'image' | 'note';

export interface ClassMaterial {
  id: string;
  class_id: string;
  batch_id: string | null;
  uploaded_by: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  file_url: string | null;
  external_url: string | null;
  is_active: boolean;
  created_at: string;
}

// ---- Referrals ----

export type ReferralStatus = 'pending' | 'signed_up' | 'enrolled' | 'rewarded';

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  apartment_id: string;
  referral_code: string;
  status: ReferralStatus;
  reward_type: string | null;
  reward_value: number | null;
  created_at: string;
  converted_at: string | null;
}

// Hand-authored types mirroring supabase/migrations/*.sql
// Regenerate with `supabase gen types typescript` once a live project exists.

export type OrgRole = "owner" | "admin" | "manager" | "cashier" | "trainer" | "coach" | "receptionist" | "staff";
export type BusinessType = "gym_fitness_center" | "yoga_studio" | "pilates_studio" | "martial_arts_dojo" | "boxing_club" | "muay_thai_club" | "mma_gym" | "cross_training" | "calisthenics_studio" | "personal_training_studio" | "dance_fitness_studio" | "running_club" | "sports_academy" | "sports_club" | "other";
export type MemberStatus = "active" | "expiring_soon" | "expired" | "suspended" | "visitor" | "archived";
export type DurationUnit = "day" | "month" | "year" | "visit";
export type BranchAccessType = "single" | "selected" | "all";
export type MembershipStatus = "pending" | "active" | "expiring_soon" | "expired" | "frozen" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";
export type CheckinMethod = "search" | "member_id" | "qr" | "manual";
export type CheckinStatus = "success" | "denied";
export type ProductType = "membership" | "day_pass" | "personal_training" | "class" | "merchandise" | "supplement" | "other";
export type TransactionType = "sale" | "membership_purchase" | "renewal" | "other";
export type TransactionStatus = "pending" | "paid" | "cancelled" | "refunded";
export type PaymentMethod = "cash" | "transfer" | "qris" | "other";
export type EmploymentType = "employee" | "freelance";
export type EquipmentCondition = "excellent" | "good" | "fair" | "poor";
export type EquipmentStatus = "available" | "maintenance" | "unavailable" | "retired";
export type ClassStatus = "scheduled" | "ongoing" | "completed" | "cancelled";
export type PtClientStatus = "active" | "expired" | "cancelled";
export type PtSessionStatus = "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled";
export type StaffRole = "COACH" | "TRAINER";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  is_demo_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  owner_id: string;
  billing_email: string | null;
  onboarding_step: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  business_type: BusinessType;
  timezone: string;
  currency: string;
  is_demo: boolean;
}

export interface OrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_email: string | null;
  status: string;
  created_at: string;
}

export interface Gym {
  id: string;
  organization_id: string;
  name: string;
  logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Branch {
  id: string;
  organization_id: string;
  gym_id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  opening_hours: Record<string, unknown>;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface BranchUser {
  id: string;
  branch_id: string;
  organization_id: string;
  user_id: string;
  created_at: string;
}

export interface Member {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string;
  member_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  gender: string | null;
  birth_date: string | null;
  join_date: string;
  status: MemberStatus;
  notes: string | null;
  repup_account_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface MembershipPlan {
  id: string;
  organization_id: string;
  gym_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_value: number;
  duration_unit: DurationUnit;
  visit_limit: number | null;
  branch_access: BranchAccessType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Membership {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string;
  member_id: string;
  membership_plan_id: string;
  start_date: string;
  end_date: string | null;
  status: MembershipStatus;
  remaining_visits: number | null;
  payment_status: PaymentStatus;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CheckIn {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string;
  member_id: string;
  membership_id: string | null;
  occurred_at: string;
  method: CheckinMethod;
  status: CheckinStatus;
  denial_reason: string | null;
  validated_by: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  gym_id: string;
  category_id: string | null;
  product_type: ProductType;
  name: string;
  sku: string | null;
  price: number;
  membership_plan_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Transaction {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string;
  member_id: string | null;
  invoice_number: string;
  transaction_type: TransactionType;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  cashier_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  membership_plan_id: string | null;
  created_at: string;
}

export interface Trainer {
  id: string;
  organization_id: string;
  gym_id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  specialization: string | null;
  employment_type: EmploymentType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface PtClientAssignment {
  id: string;
  organization_id: string;
  location_id: string;
  member_id: string;
  trainer_id: string;
  package_plan_id: string | null;
  membership_id: string | null;
  start_date: string;
  end_date: string | null;
  sessions_total: number;
  sessions_used: number;
  status: PtClientStatus;
  goal: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PtSession {
  id: string;
  organization_id: string;
  location_id: string;
  pt_client_assignment_id: string;
  member_id: string;
  trainer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: PtSessionStatus;
  session_credit_consumed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymClass {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string;
  trainer_id: string | null;
  name: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  price: number;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
  is_demo_user: boolean;
}

export interface EquipmentCategory {
  id: string;
  slug: string;
  name: string;
}

export interface Equipment {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  quantity: number;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  purchase_date: string | null;
  maintenance_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface AuditLog {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T> };

export interface Database {
  public: {
    Tables: {
      profiles: Row<Profile>;
      organizations: Row<Organization>;
      organization_users: Row<OrganizationUser>;
      gyms: Row<Gym>;
      branches: Row<Branch>;
      branch_users: Row<BranchUser>;
      members: Row<Member>;
      membership_plans: Row<MembershipPlan>;
      memberships: Row<Membership>;
      check_ins: Row<CheckIn>;
      products: Row<Product>;
      transactions: Row<Transaction>;
      transaction_items: Row<TransactionItem>;
      trainers: Row<Trainer>;
      pt_client_assignments: Row<PtClientAssignment>;
      pt_sessions: Row<PtSession>;
      trainer_roles: Row<{ trainer_id: string; role: StaffRole }>;
      classes: Row<GymClass>;
      equipment: Row<Equipment>;
      equipment_categories: Row<EquipmentCategory>;
      audit_logs: Row<AuditLog>;
    };
    Functions: {
      onboard_create_business: {
        Args: {
          p_org_name: string;
          p_gym_name: string;
          p_branch_name: string;
          p_branch_address?: string | null;
          p_branch_phone?: string | null;
          p_currency?: string;
          p_timezone?: string;
        };
        Returns: { organization_id: string; gym_id: string; branch_id: string }[];
      };
      complete_onboarding: { Args: { p_organization_id: string }; Returns: void };
      next_member_code: { Args: { p_organization_id: string }; Returns: string };
      pos_checkout: {
        Args: {
          p_organization_id: string;
          p_gym_id: string;
          p_branch_id: string;
          p_member_id: string | null;
          p_items: unknown;
          p_discount: number;
          p_tax: number;
          p_payment_method: PaymentMethod;
        };
        Returns: { transaction_id: string; invoice_number: string }[];
      };
      perform_check_in: {
        Args: {
          p_member_id: string;
          p_branch_id: string;
          p_method?: CheckinMethod;
          p_duplicate_window_minutes?: number;
        };
        Returns: {
          result_status: CheckinStatus;
          denial_reason: string | null;
          membership_id: string | null;
          member_name: string;
          plan_name: string | null;
          valid_until: string | null;
          branch_name: string;
        }[];
      };
    };
  };
}

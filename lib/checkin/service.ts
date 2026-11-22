import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authorization";

export type CheckInSource = "camera_qr" | "usb_qr" | "rfid" | "nfc" | "manual" | "staff" | "auto" | "mobile" | "gate";
export type AttendanceDirection = "IN" | "OUT" | "AUTO";

export type CheckInServiceResult = {
  error?: string;
  result_status?: "success" | "denied";
  denial_reason?: string | null;
  member_name?: string;
  plan_name?: string | null;
  valid_until?: string | null;
  branch_name?: string;
  source?: CheckInSource;
  duplicate?: boolean;
  checkInTime?: string;
  allowAccess?: boolean;
  action?: string;
  attendanceStatus?: string | null;
  attendanceId?: string | null;
  memberId?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  durationSeconds?: number | null;
};

function normalizeIdentifier(value: string) {
  const identifier = value.trim();
  const tokenMatch = identifier.match(/^repup-(?:member:\/\/checkin|checkin:\/\/token|member:\/\/token)\/(.+)$/i);
  return { value: tokenMatch?.[1] ?? identifier, isToken: Boolean(tokenMatch) };
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkIn({
  identifier,
  source,
  deviceId,
  branchId,
  direction = "IN",
}: {
  identifier: string;
  source: CheckInSource;
  deviceId?: string;
  branchId: string;
  direction?: AttendanceDirection;
}): Promise<CheckInServiceResult> {
  const ctx = await requirePermission("checkin.manage");
  if (ctx.isDemo || !ctx.branches.some(branch => branch.id === branchId)) return { error: "Cabang tidak tersedia untuk check-in." };
  const supabase = await createClient();
  const normalized = normalizeIdentifier(identifier);
  if (!normalized.value) return { error: "Identifier check-in kosong." };

  let memberId: string | null = null;
  if (normalized.isToken) {
    const { data: token } = await (supabase as any)
      .from("member_checkin_tokens")
      .select("member_id, expires_at")
      .eq("organization_id", ctx.organization.id)
      .eq("token_hash", hashIdentifier(normalized.value))
      .eq("status", "active")
      .maybeSingle();
    if (token && (!token.expires_at || new Date(token.expires_at).getTime() > Date.now())) memberId = token.member_id;
  } else {
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized.value);
    const memberQuery = supabase.from("members").select("id").eq("organization_id", ctx.organization.id).eq("branch_id", branchId).limit(1);
    const { data } = looksLikeUuid
      ? await memberQuery.eq("id", normalized.value)
      : source === "rfid"
        ? await (supabase as any).from("rfid_cards").select("member_id").eq("organization_id", ctx.organization.id).eq("uid_hash", hashIdentifier(normalized.value)).eq("status", "active").maybeSingle()
        : await memberQuery.or(`member_code.eq.${normalized.value},phone.eq.${normalized.value}`);
    memberId = (Array.isArray(data) ? data[0]?.id : data?.id ?? data?.member_id) ?? null;
  }
  if (!memberId) return { result_status: "denied", denial_reason: source === "rfid" ? "RFID tidak terdaftar." : "Kartu / QR tidak dikenali.", source, allowAccess: false };

  const { data, error } = await (supabase as any).rpc("process_attendance", {
    p_member_id: memberId,
    p_branch_id: branchId,
    p_direction: direction,
    p_method: (source === "camera_qr" || source === "usb_qr" ? "qr" : "manual") as any,
    p_source: source,
    p_device_id: deviceId ?? null,
  });
  if (error) return { error: error.message, source, allowAccess: false };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "Layanan attendance tidak mengembalikan hasil.", source, allowAccess: false };
  return { result_status: row.result_status, denial_reason: row.denial_reason, member_name: row.member_name, plan_name: row.plan_name, valid_until: row.valid_until, branch_name: row.branch_name, source, action: row.result_action, attendanceStatus: row.attendance_status, attendanceId: row.attendance_id, memberId, checkInAt: row.check_in_at, checkOutAt: row.check_out_at, durationSeconds: row.duration_seconds, checkInTime: row.check_in_at, allowAccess: row.result_status === "success" && row.result_action !== "no_active_visit" };
}

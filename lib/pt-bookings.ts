export interface PtSettings {
  confirmation: "auto" | "approval";
  approvalMinutes: number;
  intervalMinutes: number;
  bufferMinutes: number;
  noticeMinutes: number;
  advanceDays: number;
  lateCancelHours: number;
  chargeLateCancel: boolean;
  chargeNoShow: boolean;
}

export const defaultPtSettings: PtSettings = {
  confirmation: "auto", approvalMinutes: 120, intervalMinutes: 30, bufferMinutes: 0, noticeMinutes: 60,
  advanceDays: 30, lateCancelHours: 12, chargeLateCancel: false, chargeNoShow: false,
};

export interface PtAssignment {
  id: string; memberName: string; trainerId: string; trainerName: string; trainerPhoto: string | null;
  trainerSpecialty: string | null; trainerExperience: number; trainerStatus: string; packageName: string;
  total: number; completed: number; reserved: number; available: number; expiresOn: string | null; duration: number; timezone: string;
  earliestBookingDate?: string; latestBookingDate?: string;
  assignmentHistory?: { time: string; reason: string; previousTrainer?: string | null; newTrainer?: string | null; actorName?: string | null }[];
}

export interface PtBooking {
  id: string; reference: string; assignmentId: string; memberName: string; trainerId: string; trainerName: string;
  assignedTrainerName: string; packageName: string; date: string; start: string; end: string; duration: number;
  status: string; createdBy: string; reason?: string; scheduledAt?: string; timezone?: string; approvalExpiresAt?: string | null;
  history?: { action: string; time: string; reason: string; previousStart?: string; newStart?: string;
    previousTrainer?: string | null; newTrainer?: string | null; actorName?: string | null }[];
}

export interface PtChangeRequest {
  id: string; assignmentId: string; status: string; reason: string; notes: string | null; trainerName: string;
  preferredTrainerName: string | null; createdAt: string;
  memberName?: string; packageName?: string; preferredTrainerId?: string | null; reviewReason?: string | null;
}
export interface PtTrainer { id: string; name: string }
export interface PtPortal {
  assignments: PtAssignment[];
  bookings: PtBooking[];
  requests: PtChangeRequest[];
  trainers: PtTrainer[];
  canManage?: boolean;
  assignmentHistory?: { id: string; assignmentId: string; memberName: string; packageName: string; changeType: string;
    time: string; reason: string; timezone?: string; previousTrainer?: string | null; newTrainer?: string | null; actorName?: string | null }[];
  error?: string;
}
export type PtBookingOperation = "reschedule" | "cancel" | "approve" | "reject" | "complete" | "no_show";

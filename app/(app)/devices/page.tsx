import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { Cable, Camera, CreditCard, Radio, ScanLine } from "lucide-react";

const DEVICE_LABELS: Record<string, string> = { camera: "Camera", qr_hid: "QR Scanner", barcode_hid: "Barcode Scanner", rfid_hid: "RFID Reader", rfid_serial: "RFID Serial", nfc: "NFC Reader", turnstile: "Turnstile", door_controller: "Door Controller" };
const CONNECTION_LABELS: Record<string, string> = { browser_camera: "Browser Camera", keyboard_hid: "Keyboard / HID", web_serial: "Web Serial", web_usb: "WebUSB", local_connector: "Local Connector", network: "Network API" };

function DeviceIcon({ type }: { type: string }) {
  if (type === "camera") return <Camera size={18} />;
  if (type.includes("rfid") || type === "nfc") return <Radio size={18} />;
  if (type.includes("door") || type === "turnstile") return <Cable size={18} />;
  if (type.includes("qr") || type.includes("barcode")) return <ScanLine size={18} />;
  return <CreditCard size={18} />;
}

export default async function DevicesPage() {
  const ctx = await getTenantContext();
  if (ctx.isDemo) {
    return (
      <div>
        <PageHeader title="Devices" description="Pantau kamera, scanner, RFID, NFC, dan connector per cabang." />
        <Card>
          <EmptyState title="Data tersedia di akun gym" />
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: devices } = await (supabase as any).from("gym_devices").select("*, branches(name)").eq("organization_id", ctx.organization.id).order("created_at", { ascending: false });
  const visibleDevices = ctx.branch ? (devices ?? []).filter((device: any) => device.branch_id === ctx.branch?.id) : devices ?? [];

  return <div className="mx-auto w-full max-w-[1200px]"><PageHeader title="Devices" description="Pantau kamera, scanner, RFID, NFC, dan connector per cabang." /><div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Card className="p-4"><p className="text-xs text-ink-faint">Total device</p><p className="mt-2 text-2xl font-semibold text-ink">{visibleDevices.length}</p></Card><Card className="p-4"><p className="text-xs text-ink-faint">Online</p><p className="mt-2 text-2xl font-semibold text-success">{visibleDevices.filter((device: any) => device.status === "online").length}</p></Card><Card className="p-4"><p className="text-xs text-ink-faint">Offline</p><p className="mt-2 text-2xl font-semibold text-danger">{visibleDevices.filter((device: any) => device.status === "offline").length}</p></Card><Card className="p-4"><p className="text-xs text-ink-faint">Connector</p><p className="mt-2 text-2xl font-semibold text-ink">{visibleDevices.filter((device: any) => device.connection_type === "local_connector").length}</p></Card></div><Card className="overflow-hidden">{visibleDevices.length === 0 ? <EmptyState title="Belum ada device terdaftar" description="Camera browser dan scanner HID dapat langsung digunakan dari halaman Check-in. Device RFID/NFC/gate membutuhkan RepUp Device Connector." /> : <div className="divide-y divide-line">{visibleDevices.map((device: any) => <div key={device.id} className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-tint text-primary"><DeviceIcon type={device.type} /></div><div className="min-w-48 flex-1"><p className="font-medium text-ink">{device.name}</p><p className="mt-1 text-xs text-ink-muted">{DEVICE_LABELS[device.type] ?? device.type} · {CONNECTION_LABELS[device.connection_type] ?? device.connection_type}</p></div><div className="text-sm text-ink-muted">{device.branches?.name ?? "-"}<p className="mt-1 text-xs text-ink-faint">{device.last_seen_at ? `Last seen ${formatDateTime(device.last_seen_at)}` : "Belum pernah online"}</p></div><Badge tone={device.status === "online" ? "success" : device.status === "offline" ? "danger" : "neutral"}>{device.status}</Badge></div>)}</div>}</Card></div>;
}

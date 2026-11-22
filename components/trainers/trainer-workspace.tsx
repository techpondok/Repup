"use client";

import { useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  loadTrainerDetail, loadTrainerWorkspace, saveManagedTrainer, saveTrainerAvailability,
} from "@/app/actions/trainer-management";
import { changePtBooking } from "@/app/actions/pt-bookings";
import { Button, LinkButton } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, LoadingSkeleton, PageHeader, Stat } from "@/components/ui/layout-bits";
import { formatCurrency } from "@/lib/format";
import type { Availability, ManagedTrainer, TrainerDetail } from "@/lib/trainer-management";
import {
  cancelDemoSession, rescheduleDemoSession, saveDemoAvailability, saveDemoTrainer,
} from "@/lib/trainer-management-demo";
import { ManagedTrainerForm, TrainerPhoto } from "./managed-trainer-form";
import { employmentLabels, TrainerDetailPanel, TrainerStatus, trainerStatusLabels, type TrainerSessionOperation } from "./trainer-detail";
import { TrainerDrawer } from "./trainer-drawer";
import { useTrainerDemo } from "./trainer-demo-provider";

const pageSize = 10;
type SortKey = "name" | "experience" | "members" | "rate";
const sorts: Record<SortKey, (left: ManagedTrainer, right: ManagedTrainer) => number> = {
  name: (left, right) => left.name.localeCompare(right.name),
  experience: (left, right) => right.experience - left.experience,
  members: (left, right) => right.activeMembers - left.activeMembers,
  rate: (left, right) => right.rate - left.rate,
};

type TrainerWorkspaceProps = {
  trainers: ManagedTrainer[];
  canManage: boolean;
  canEditSessions: boolean;
  actorName: string;
  demo: boolean;
  error?: string;
};

export function TrainerWorkspace({ trainers, canManage, canEditSessions, actorName, demo, error }: TrainerWorkspaceProps) {
  const [liveRows, setLiveRows] = useState(trainers);
  const { details: sharedDetails, setDetails: setLocalDetails } = useTrainerDemo();
  const localDetails = !demo || error ? [] : !canManage && canEditSessions ? sharedDetails.slice(0, 1) : sharedDetails;
  const [loadError, setLoadError] = useState(error ?? "");
  const [permissions, setPermissions] = useState({ canManage, canEditSessions });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ManagedTrainer | null>(null);
  const [detail, setDetail] = useState<TrainerDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState<ManagedTrainer | "new" | null>(null);
  const [savingTrainer, setSavingTrainer] = useState(false);
  const [notice, setNotice] = useState("");
  const detailRequest = useRef(0);
  const rows = demo ? localDetails.map(item => item.trainer) : liveRows;
  const specialties = [...new Set(rows.flatMap(trainer => trainer.specializations))].sort();
  const lookup = query.trim().toLowerCase();
  const matching = rows.filter(trainer =>
    (!lookup || `${trainer.name} ${trainer.code ?? ""} ${trainer.phone ?? ""} ${trainer.email ?? ""}`.toLowerCase().includes(lookup))
    && (!status || trainer.status === status) && (!specialty || trainer.specializations.includes(specialty)),
  ).sort((left, right) => sorts[sort](left, right) || sorts.name(left, right));
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pages);
  const displayed = matching.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function refreshRoster() {
    setRefreshing(true);
    try {
      const result = await loadTrainerWorkspace();
      setLoadError(result.error ?? "");
      if (!result.error) {
        setLiveRows(result.trainers);
        setPermissions({ canManage: result.canManage, canEditSessions: result.canEditSessions });
      }
    } catch {
      setLoadError("Could not load trainers. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshDetail(id: string) {
    const request = ++detailRequest.current;
    try {
      const result = await loadTrainerDetail(id);
      if (request !== detailRequest.current) return;
      if ("trainer" in result && result.trainer && !result.error) {
        setDetail(result);
        setDetailError("");
      } else setDetailError(result.error ?? "Could not load trainer details.");
    } catch {
      if (request === detailRequest.current) setDetailError("Could not load trainer details.");
    }
  }

  function openTrainer(trainer: ManagedTrainer) {
    setSelected(trainer);
    setDetailError("");
    setDetail(null);
    if (!demo) void refreshDetail(trainer.id);
  }

  async function saveTrainer(data: FormData) {
    const editingId = editing && editing !== "new" ? editing.id : null;
    if (demo) {
      const result = await saveDemoTrainer(sharedDetails, editingId, data);
      if (result.error) return result;
      setLocalDetails(result.data);
    } else {
      const result = await saveManagedTrainer(editingId, data);
      if (result.error) return result;
      const refreshes = [refreshRoster()];
      if (editingId) refreshes.push(refreshDetail(editingId));
      await Promise.all(refreshes);
    }
    setEditing(null);
    setNotice(editingId ? "Trainer updated." : "Trainer added.");
    return {};
  }

  async function updateAvailability(value: Availability) {
    if (!selected) return { error: "Select a trainer." };
    if (demo) {
      const result = await saveDemoAvailability(sharedDetails, selected.id, value);
      if (!result.error) setLocalDetails(result.data);
      return result;
    }
    const result = await saveTrainerAvailability(selected.id, value);
    if (!result.error) await refreshDetail(selected.id);
    return result;
  }

  async function updateSession(operation: TrainerSessionOperation, id: string, date: string, start: string, end: string, reason: string) {
    if (demo) {
      if (operation === "approve" || operation === "reject") return { error: "Approval is available for live bookings." };
      const result = operation === "reschedule"
        ? await rescheduleDemoSession(sharedDetails, id, date, start, end, reason)
        : await cancelDemoSession(sharedDetails, id, reason);
      if (!result.error) setLocalDetails(result.data);
      return result;
    }
    const result = await changePtBooking(id, operation, operation === "reschedule" ? date : undefined, operation === "reschedule" ? start : undefined, reason);
    if (!result.error && selected) await refreshDetail(selected.id);
    return result;
  }

  const selectedDetail = demo ? localDetails.find(item => item.trainer.id === selected?.id) : detail;
  const selectedName = selectedDetail?.trainer.name ?? selected?.name;
  return <div>
    <p className="mb-2 text-xs text-ink-muted">Personal Training / Trainers</p>
    <PageHeader title="Trainer Management" description="Manage your personal trainers, availability, and schedules."
      actions={<><LinkButton href="/pt-clients" variant="secondary">PT Clients</LinkButton>{permissions.canManage && <Button type="button" onClick={() => { setNotice(""); setEditing("new"); }}><Plus size={17} /> Add Trainer</Button>}</>} />
    {demo && <p className="mb-4 text-xs text-ink-muted">Demo workspace. Changes last for this visit.</p>}
    {notice && <p role="status" className="mb-4 text-sm text-ink-muted">{notice}</p>}
    {refreshing && <p role="status" className="mb-4 text-sm text-ink-muted">Loading trainers…</p>}
    {loadError && <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4"><p role="alert" className="text-sm text-danger">{loadError}</p>
      <Button type="button" variant="secondary" disabled={refreshing} onClick={refreshRoster}>Retry</Button></Card>}
    {(!loadError || rows.length > 0) && <div className="space-y-4">
      <Card statGroup className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-y-0">
        <Stat label="Total Trainers" value={String(rows.length)} />
        <Stat label="Active Trainers" value={String(rows.filter(trainer => trainer.status === "active").length)} />
        <Stat label="On Leave" value={String(rows.filter(trainer => trainer.status === "on_leave").length)} />
      </Card>
      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-sm">Search Trainer
          <span className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-2.5 text-ink-muted" size={16} /><Input type="search" className="pl-9" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Name, code, phone, or email" /></span>
        </label>
        <label className="min-w-0 text-sm">Filter Status<Select className="mt-1" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>{Object.entries(trainerStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select></label>
        <label className="min-w-0 text-sm">Filter Specialization<Select className="mt-1" value={specialty} onChange={event => { setSpecialty(event.target.value); setPage(1); }}>
          <option value="">All specializations</option>{specialties.map(item => <option key={item}>{item}</option>)}
        </Select></label>
        <label className="min-w-0 text-sm">Sort by<Select className="mt-1" value={sort} onChange={event => { setSort(event.target.value as SortKey); setPage(1); }}>
          <option value="name">Name (A–Z)</option><option value="experience">Most experience</option><option value="members">Most active members</option><option value="rate">Highest session rate</option>
        </Select></label>
      </Card>
      <Card>
        {displayed.length === 0 ? <EmptyState title={rows.length ? "No matching trainers" : "No trainers yet"}
          description={rows.length ? "Try another search or filter." : "Trainers will appear here once added."} /> : <>
          <div className="hidden overflow-x-auto md:block"><DataTable className="w-full min-w-[50rem] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-ink-muted">
              {["Trainer", "Specialization", "Experience", "Active Members", "Session Rate", "Employment", "Status", "Action"].map(label => <th scope="col" key={label} className="px-3 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{displayed.map(trainer => <tr key={trainer.id} className="border-b border-line last:border-0">
              <th scope="row" className="px-3 py-3 text-left"><div className="flex items-center gap-2"><TrainerPhoto name={trainer.name} photo={trainer.photo} /><div><p className="font-medium">{trainer.name}</p><p className="text-xs font-normal text-ink-muted">{trainer.code || "—"}</p></div></div></th>
              <td className="px-3 py-3">{trainer.specializations.join(", ") || "—"}</td>
              <td className="px-3 py-3 text-ink-muted">{trainer.experience} yrs</td>
              <td className="num px-3 py-3">{trainer.activeMembers}</td>
              <td className="num whitespace-nowrap px-3 py-3">{formatCurrency(trainer.rate, "IDR")}</td>
              <td className="px-3 py-3 text-ink-muted">{employmentLabels[trainer.employment]}</td>
              <td className="whitespace-nowrap px-3 py-3"><TrainerStatus status={trainer.status} /></td>
              <td className="px-3 py-3"><Button type="button" size="sm" variant="secondary" onClick={() => openTrainer(trainer)}>View Details</Button></td>
            </tr>)}</tbody>
          </DataTable></div>
          <ul className="divide-y divide-line md:hidden">
            {displayed.map(trainer => <li key={trainer.id} className="space-y-2 p-3">
              <div className="flex items-center gap-2"><TrainerPhoto name={trainer.name} photo={trainer.photo} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{trainer.name}</p><p className="text-xs text-ink-muted">{trainer.code || "—"}</p></div><TrainerStatus status={trainer.status} /></div>
              <p className="break-words text-xs text-ink-muted">{trainer.specializations.join(", ") || "—"}</p>
              <p className="text-xs text-ink-muted">{trainer.experience} yrs · {trainer.activeMembers} active · {employmentLabels[trainer.employment]}</p>
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="num text-sm font-medium">{formatCurrency(trainer.rate, "IDR")}</p><Button type="button" size="sm" variant="secondary" onClick={() => openTrainer(trainer)}>View Details</Button></div>
            </li>)}
          </ul>
        </>}
        {pages > 1 && <nav aria-label="Trainer pages" className="flex flex-wrap items-center justify-end gap-3 border-t border-line p-3 text-sm">
          <Button type="button" variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <span>Page {currentPage} of {pages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </nav>}
      </Card>
    </div>}
    {selected && <TrainerDrawer title={selectedName ?? "Trainer details"} onClose={() => { detailRequest.current++; setSelected(null); setDetail(null); }}>
      {detailError ? <div className="space-y-3"><p role="alert" className="text-sm text-danger">{detailError}</p><Button type="button" variant="secondary" onClick={() => { setDetailError(""); void refreshDetail(selected.id); }}>Retry</Button></div>
        : selectedDetail ? <TrainerDetailPanel key={selected.id} detail={selectedDetail} actor={actorName} canManage={permissions.canManage} canEditSessions={permissions.canEditSessions} demo={demo}
          onEdit={() => setEditing(selectedDetail.trainer)} onSaveAvailability={updateAvailability} onSessionChange={updateSession} />
          : <div role="status" className="space-y-3"><p className="text-sm text-ink-muted">Loading trainer details…</p><LoadingSkeleton /><LoadingSkeleton /></div>}
    </TrainerDrawer>}
    {editing && <TrainerDrawer title={editing === "new" ? "Add Trainer" : "Edit Trainer"} onClose={() => { if (!savingTrainer) setEditing(null); }}>
      <ManagedTrainerForm key={editing === "new" ? "new" : editing.id} trainer={editing === "new" ? undefined : editing}
        sessions={editing === "new" ? undefined : selectedDetail?.sessions}
        packageNames={editing === "new" ? [] : selectedDetail?.packages?.map(plan => plan.name)}
        onSave={saveTrainer} onClose={() => setEditing(null)} onPendingChange={setSavingTrainer} />
    </TrainerDrawer>}
  </div>;
}

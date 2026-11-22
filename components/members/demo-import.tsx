"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { TrainerDrawer } from "@/components/trainers/trainer-drawer";
import { blankProfile, csvFields, csvLabels, newMember, parseCsv, phoneKey, profileError, type Profile } from "@/lib/demo/member-management";
import { Field, newId, type Save } from "./demo-forms";
import { useMemberDemo } from "./demo-provider";
import { MemberTable } from "./demo-ui";

const steps = ["Upload CSV", "Preview Data", "Column Mapping", "Validation", "Import Confirmation"];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = [["fullname", "name"], ["phonenumber", "phone", "mobile"], ["email"], ["dateofbirth", "birth", "dob"], ["gender"], ["address"], ["emergencycontact", "emergency"]];

export function ImportMembers({ branchId, close, saved }: { branchId: string; close: () => void; saved: Save }) {
  const demo = useMemberDemo();
  const [step, setStep] = useState(0);
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const seen = new Set(demo.members.map(member => phoneKey(member.phone)));
  const validation = step < 3 ? [] : rows.map((row, index) => {
    const profile = { ...blankProfile };
    csvFields.forEach((field, column) => { profile[field] = (row[mapping[column]] ?? "").trim(); });
    profile.phone = profile.phone.replace(/^\x27(?=\+\d)/, "");
    const key = phoneKey(profile.phone);
    let issue = row.length === header.length ? profileError(profile) : "Column count differs from the header.";
    if (!issue && profile.birth && (!/^\d{4}-\d{2}-\d{2}$/.test(profile.birth) || new Date(profile.birth).toJSON()?.slice(0, 10) !== profile.birth || profile.birth > demo.today)) issue = "Use a valid birth date in YYYY-MM-DD format.";
    if (!issue && seen.has(key)) issue = "Phone number is already registered or duplicated in this file.";
    if (!issue) seen.add(key);
    return { index: index + 2, profile, issue };
  });
  const invalid = validation.filter(row => row.issue);
  const validMapping = mapping[0] >= 0 && mapping[1] >= 0 && new Set(mapping.filter(i => i >= 0)).size === mapping.filter(i => i >= 0).length;

  function confirm() {
    if (!validation.length || invalid.length) return;
    const result: Profile[] = validation.map(row => row.profile);
    demo.update(items => [...items, ...result.map(profile => newMember(profile, newId(), branchId, demo.today))]);
    saved(`${result.length} members imported into this demo session.`);
  }

  return <TrainerDrawer title="Import Members" onClose={close} centered>
    <div className="space-y-4">
      <p className="text-xs font-medium text-ink-muted">Step {step + 1} of {steps.length}</p>
      <h3 className="font-semibold">{steps[step]}</h3>
      {step === 0 && <>
        <p className="text-sm text-ink-muted">Upload a comma-separated CSV with a header, full names and phone numbers. Imported profiles start without a membership.</p>
        <Field label="CSV file"><Input type="file" accept=".csv,text/csv" disabled={loading} onChange={async event => {
          const file = event.target.files?.[0];
          setRows([]);
          setError("");
          if (!file) return;
          if (file.size > 1_000_000) return setError("Choose a CSV under 1 MB.");
          setLoading(true);
          try {
            const [columns, ...records] = parseCsv(await file.text());
            setHeader(columns);
            setRows(records);
            setMapping(aliases.map(names => columns.findIndex(column => names.includes(normalize(column)))));
          } catch (problem) {
            setError(problem instanceof Error ? problem.message : "Could not read the CSV.");
          } finally {
            setLoading(false);
          }
        }} /></Field>
        {loading && <p role="status">Reading CSV…</p>}
        {rows.length > 0 && <p role="status">{rows.length} data rows loaded.</p>}
      </>}
      {step === 1 && <>
        <p className="text-sm text-ink-muted">Showing up to 5 of {rows.length} rows.</p>
        <MemberTable headers={header.map((name, i) => `${i + 1}. ${name}`)} rows={rows.slice(0, 5).map((row, i) => ({ id: String(i), cells: header.map((_, column) => row[column]) }))} empty="No records" />
      </>}
      {step === 2 && <>
        {csvLabels.map((label, index) => <Field key={label} label={index < 2 ? `${label} (required)` : label}>
          <Select value={mapping[index]} onChange={event => setMapping(previous => previous.map((item, i) => i === index ? Number(event.target.value) : item))}>
            <option value={-1}>Skip column</option>{header.map((column, i) => <option value={i} key={i}>{i + 1}. {column}</option>)}
          </Select>
        </Field>)}
        {!validMapping && <p className="text-sm text-ink-muted">Map Full Name and Phone Number to distinct columns. Each column can be used once.</p>}
      </>}
      {step === 3 && <>
        <p className="text-sm">{validation.length - invalid.length} valid · {invalid.length} with errors</p>
        {invalid.length > 0 && <div role="alert" className="space-y-2 text-sm text-danger">
          <p>Correct the CSV or adjust your column mapping to continue.</p>
          <ul className="list-disc space-y-1 pl-5">{invalid.slice(0, 10).map(row => <li key={row.index}>Record {row.index - 1}: {row.issue}</li>)}</ul>
          {invalid.length > 10 && <p>{invalid.length - 10} additional records need corrections.</p>}
        </div>}
      </>}
      {step === 4 && <p className="text-sm">Add {validation.length} member profiles to this demo session?</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={step === 0 ? close : () => setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</Button>
        {step === 4 ? <Button disabled={invalid.length > 0} onClick={confirm}>Confirm Import</Button> : <Button disabled={loading || !rows.length || (step === 2 && !validMapping) || (step === 3 && invalid.length > 0)} onClick={() => setStep(step + 1)}>Continue</Button>}
      </div>
    </div>
  </TrainerDrawer>;
}

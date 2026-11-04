"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Modal } from "@/shared/components/modal";
import {
  ApiClientError,
  createWorkspaceCall,
  deleteWorkspaceCall,
  getCurrentUser,
  getProjects,
  getWorkspaceCalls,
  getWorkspaceMembers,
  respondToWorkspaceCall,
  updateWorkspaceCall,
} from "@/shared/lib/api-client";
import type { ProjectSummary, WorkspaceCall, WorkspaceMember } from "@devflow/shared";

import styles from "./workspace-calls.module.css";

type CallDraft = {
  attendeeUserIds: string[];
  description: string;
  endsAt: string;
  location: string;
  meetingUrl: string;
  projectId: string;
  startsAt: string;
  timezone: string;
  title: string;
};

export function WorkspaceCalls({ workspaceId }: { workspaceId: string }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [calls, setCalls] = useState<WorkspaceCall[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<WorkspaceCall>();
  const [editingCall, setEditingCall] = useState<WorkspaceCall>();

  const range = useMemo(() => monthRange(month), [month]);
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [callsResponse, projectsResponse, membersResponse, currentUserResponse] = await Promise.all([
        getWorkspaceCalls(workspaceId, {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        }),
        getProjects(workspaceId),
        getWorkspaceMembers(workspaceId),
        getCurrentUser(),
      ]);
      setCalls(callsResponse.calls);
      setProjects(projectsResponse.projects);
      setMembers(membersResponse.members);
      setCurrentUserId(currentUserResponse.user.id);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to load calendar events."));
    } finally {
      setIsLoading(false);
    }
  }, [range.from, range.to, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const upcomingCalls = calls.filter(
    (call) => call.status === "scheduled" && new Date(call.endsAt) >= new Date(),
  );

  async function saveCall(draft: CallDraft) {
    const input = {
      attendeeUserIds: draft.attendeeUserIds,
      description: draft.description || null,
      endsAt: localInputToIso(draft.endsAt),
      location: draft.location || null,
      meetingUrl: draft.meetingUrl || null,
      projectId: draft.projectId || null,
      startsAt: localInputToIso(draft.startsAt),
      timezone: draft.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      title: draft.title,
    };

    try {
      if (editingCall) {
        const response = await updateWorkspaceCall(workspaceId, editingCall.id, input);
        setCalls((current) => current.map((call) => call.id === response.call.id ? response.call : call));
        setSelectedCall(response.call);
      } else {
        const response = await createWorkspaceCall(workspaceId, input);
        setCalls((current) => [...current, response.call].sort(byStartTime));
        setSelectedCall(response.call);
      }
      setEditorOpen(false);
      setEditingCall(undefined);
    } catch (caughtError) {
      throw new Error(messageFor(caughtError, "Unable to save the call."));
    }
  }

  async function changeStatus(call: WorkspaceCall, status: "cancelled" | "completed") {
    try {
      const response = await updateWorkspaceCall(workspaceId, call.id, { status });
      replaceCall(response.call);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update the call."));
    }
  }

  async function answerCall(call: WorkspaceCall, responseStatus: "accepted" | "declined") {
    try {
      const response = await respondToWorkspaceCall(workspaceId, call.id, { responseStatus });
      replaceCall(response.call);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update your attendance."));
    }
  }

  async function removeCall(call: WorkspaceCall) {
    if (!window.confirm(`Delete “${call.title}”? This cannot be undone.`)) return;
    try {
      await deleteWorkspaceCall(workspaceId, call.id);
      setCalls((current) => current.filter((item) => item.id !== call.id));
      setSelectedCall(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete the call."));
    }
  }

  function replaceCall(nextCall: WorkspaceCall) {
    setCalls((current) => current.map((call) => call.id === nextCall.id ? nextCall : call));
    setSelectedCall(nextCall);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}><CalendarDays aria-hidden="true" size={21} /></span>
          <div>
            <h1>Calls</h1>
            <p>Schedule meetings, invite workspace members, and keep project conversations in one calendar.</p>
          </div>
        </div>
        <button className={styles.primaryAction} onClick={() => { setEditingCall(undefined); setEditorOpen(true); }} type="button">
          <Plus aria-hidden="true" size={17} />
          Schedule call
        </button>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <section className={styles.calendarLayout} aria-label="Calls calendar">
        <div className={styles.calendarPanel}>
          <div className={styles.calendarToolbar}>
            <div>
              <h2>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month)}</h2>
              <p>{calls.length} {calls.length === 1 ? "call" : "calls"} in this view</p>
            </div>
            <div className={styles.calendarActions}>
              <button onClick={() => setMonth(startOfMonth(new Date()))} type="button">Today</button>
              <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
              <button aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
            </div>
          </div>
          {isLoading ? <p className={styles.loading}>Loading calendar…</p> : null}
          {!isLoading ? (
            <CalendarGrid
              calls={calls}
              month={month}
              onOpenCall={setSelectedCall}
              onSchedule={(day) => { setEditingCall({ ...emptyCall(day), attendees: [], createdAt: "", createdByUserId: null, id: "", projectId: null, status: "scheduled", updatedAt: "", workspaceId }); setEditorOpen(true); }}
              today={new Date()}
            />
          ) : null}
        </div>

        <aside className={styles.upcomingPanel}>
          <div className={styles.upcomingHeading}>
            <div><h2>Upcoming</h2><p>Scheduled calls in this month.</p></div>
            <Video aria-hidden="true" size={19} />
          </div>
          {upcomingCalls.length ? (
            <ol className={styles.upcomingList}>
              {upcomingCalls.map((call) => (
                <li key={call.id}>
                  <button onClick={() => setSelectedCall(call)} type="button">
                    <time dateTime={call.startsAt}>{formatCallDate(call.startsAt)}</time>
                    <strong>{call.title}</strong>
                    <span>{formatCallTime(call.startsAt, call.endsAt)} · {call.attendees.length} attendees</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className={styles.emptyUpcoming}>No calls scheduled in this view.</p>}
        </aside>
      </section>

      <CallEditorModal
        call={editingCall}
        isOpen={isEditorOpen}
        members={members}
        onClose={() => { setEditorOpen(false); setEditingCall(undefined); }}
        onSave={saveCall}
        projects={projects}
      />
      <CallDetailsModal
        call={selectedCall}
        currentUserId={currentUserId}
        isOpen={Boolean(selectedCall)}
        onClose={() => setSelectedCall(undefined)}
        onDelete={removeCall}
        onEdit={(call) => { setSelectedCall(undefined); setEditingCall(call); setEditorOpen(true); }}
        onRespond={answerCall}
        onStatus={changeStatus}
        project={selectedCall?.projectId ? projectById.get(selectedCall.projectId) : undefined}
      />
    </main>
  );
}

function CalendarGrid({ calls, month, onOpenCall, onSchedule, today }: {
  calls: WorkspaceCall[];
  month: Date;
  onOpenCall: (call: WorkspaceCall) => void;
  onSchedule: (day: Date) => void;
  today: Date;
}) {
  const days = calendarDays(month);
  return (
    <div className={styles.calendar}>
      {weekdayLabels.map((label) => <span className={styles.weekday} key={label}>{label}</span>)}
      {days.map((day) => {
        const dayCalls = calls.filter((call) => isSameDay(new Date(call.startsAt), day));
        const inMonth = day.getMonth() === month.getMonth();
        return (
          <div className={`${styles.day} ${!inMonth ? styles.dayOutside : ""} ${isSameDay(day, today) ? styles.dayToday : ""}`} key={day.toISOString()}>
            <div className={styles.dayHeading}><time dateTime={day.toISOString().slice(0, 10)}>{day.getDate()}</time><button aria-label={`Schedule call on ${formatCalendarDay(day)}`} onClick={() => onSchedule(day)} type="button"><Plus aria-hidden="true" size={15} /></button></div>
            <div className={styles.dayCalls}>
              {dayCalls.slice(0, 3).map((call) => <button className={`${styles.calendarEvent} ${call.status === "cancelled" ? styles.cancelledEvent : ""}`} key={call.id} onClick={() => onOpenCall(call)} type="button"><time>{formatShortTime(call.startsAt)}</time><span>{call.title}</span></button>)}
              {dayCalls.length > 3 ? <span className={styles.moreCalls}>+{dayCalls.length - 3} more</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CallEditorModal({ call, isOpen, members, onClose, onSave, projects }: {
  call?: WorkspaceCall;
  isOpen: boolean;
  members: WorkspaceMember[];
  onClose: () => void;
  onSave: (draft: CallDraft) => Promise<void>;
  projects: ProjectSummary[];
}) {
  const [draft, setDraft] = useState<CallDraft>(() => draftFromCall(call));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (isOpen) { setDraft(draftFromCall(call)); setError(undefined); }
  }, [call, isOpen]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try { await onSave(draft); } catch (caughtError) { setError(messageFor(caughtError, "Unable to save the call.")); } finally { setSaving(false); }
  }

  return <Modal isOpen={isOpen} onClose={onClose} title={call?.id ? "Edit call" : "Schedule a call"} width="wide">
    <form className={styles.callForm} onSubmit={submit}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <label className={styles.fullField}><span>Title</span><input autoFocus maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
      <div className={styles.formGrid}>
        <label><span>Start</span><input onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} required type="datetime-local" value={draft.startsAt} /></label>
        <label><span>End</span><input onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} required type="datetime-local" value={draft.endsAt} /></label>
        <label><span>Project</span><select onChange={(event) => setDraft({ ...draft, projectId: event.target.value })} value={draft.projectId}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label><span>Timezone</span><input maxLength={80} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} value={draft.timezone} /></label>
        <label><span>Location</span><input maxLength={300} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Office, room, or address" value={draft.location} /></label>
        <label><span>Meeting link</span><input onChange={(event) => setDraft({ ...draft, meetingUrl: event.target.value })} placeholder="https://meet.google.com/..." type="url" value={draft.meetingUrl} /></label>
      </div>
      <label className={styles.fullField}><span>Agenda or notes</span><textarea maxLength={10000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What should participants prepare or decide?" rows={4} value={draft.description} /></label>
      <fieldset className={styles.attendees}><legend><Users aria-hidden="true" size={17} /> Invite workspace members</legend><div>{members.map((member) => <label key={member.userId}><input checked={draft.attendeeUserIds.includes(member.userId)} onChange={() => setDraft((current) => ({ ...current, attendeeUserIds: toggle(current.attendeeUserIds, member.userId) }))} type="checkbox" /><span>{initials(member.user.displayName)}</span>{member.user.displayName}</label>)}</div></fieldset>
      <div className={styles.formActions}><button onClick={onClose} type="button">Cancel</button><button className={styles.primaryAction} disabled={isSaving} type="submit">{isSaving ? "Saving…" : call?.id ? "Save changes" : "Schedule call"}</button></div>
    </form>
  </Modal>;
}

function CallDetailsModal({ call, currentUserId, isOpen, onClose, onDelete, onEdit, onRespond, onStatus, project }: {
  call?: WorkspaceCall;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (call: WorkspaceCall) => Promise<void>;
  onEdit: (call: WorkspaceCall) => void;
  onRespond: (call: WorkspaceCall, status: "accepted" | "declined") => Promise<void>;
  onStatus: (call: WorkspaceCall, status: "cancelled" | "completed") => Promise<void>;
  project?: ProjectSummary;
}) {
  if (!call) return null;
  const currentAttendee = call.attendees.find((attendee) => attendee.userId === currentUserId);
  return <Modal isOpen={isOpen} onClose={onClose} title="Call details" width="wide">
    <article className={styles.callDetails}>
      <div className={styles.detailHeader}><div><span className={`${styles.status} ${styles[`status${capitalize(call.status)}`]}`}>{call.status}</span><h3>{call.title}</h3><p><Clock3 aria-hidden="true" size={16} /> {formatLongDateTime(call.startsAt)} – {formatTime(call.endsAt)}</p></div><div className={styles.detailActions}>{call.meetingUrl ? <a className={styles.joinButton} href={call.meetingUrl} rel="noreferrer" target="_blank"><Video aria-hidden="true" size={16} /> Join call</a> : null}<button aria-label="Edit call" onClick={() => onEdit(call)} type="button"><Pencil aria-hidden="true" size={17} /></button></div></div>
      {call.description ? <section><h4>Agenda</h4><p className={styles.description}>{call.description}</p></section> : null}
      <div className={styles.detailMeta}>{project ? <span>Project <b>{project.name}</b></span> : null}{call.location ? <span><MapPin aria-hidden="true" size={16} /> {call.location}</span> : null}{call.meetingUrl ? <a href={call.meetingUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={15} /> Open meeting link</a> : null}</div>
      <section><h4>Attendees <span>{call.attendees.length}</span></h4><ul className={styles.attendeeList}>{call.attendees.map((attendee) => <li key={attendee.userId}><span>{initials(attendee.user.displayName)}</span><strong>{attendee.user.displayName}</strong><small>{attendee.responseStatus}</small></li>)}</ul></section>
      {currentAttendee && call.status === "scheduled" ? <div className={styles.responseActions}><span>Your response</span><button className={currentAttendee.responseStatus === "accepted" ? styles.selectedResponse : ""} onClick={() => void onRespond(call, "accepted")} type="button"><Check aria-hidden="true" size={16} /> Accept</button><button className={currentAttendee.responseStatus === "declined" ? styles.selectedDecline : ""} onClick={() => void onRespond(call, "declined")} type="button"><X aria-hidden="true" size={16} /> Decline</button></div> : null}
      <footer className={styles.detailFooter}>{call.status === "scheduled" ? <><button onClick={() => void onStatus(call, "completed")} type="button">Mark completed</button><button className={styles.cancelAction} onClick={() => void onStatus(call, "cancelled")} type="button">Cancel call</button></> : null}<button className={styles.deleteAction} onClick={() => void onDelete(call)} type="button"><Trash2 aria-hidden="true" size={16} /> Delete</button></footer>
    </article>
  </Modal>;
}

function emptyCall(day = new Date()) {
  const startsAt = new Date(day); startsAt.setHours(10, 0, 0, 0);
  const endsAt = new Date(startsAt); endsAt.setHours(10, 30, 0, 0);
  return { attendees: [], createdAt: "", createdByUserId: null, description: null, endsAt: endsAt.toISOString(), id: "", location: null, meetingUrl: null, projectId: null, startsAt: startsAt.toISOString(), status: "scheduled" as const, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", title: "", updatedAt: "", workspaceId: "" };
}
function draftFromCall(call?: WorkspaceCall): CallDraft { const value = call ?? emptyCall(); return { attendeeUserIds: value.attendees.map((attendee) => attendee.userId), description: value.description ?? "", endsAt: isoToLocalInput(value.endsAt), location: value.location ?? "", meetingUrl: value.meetingUrl ?? "", projectId: value.projectId ?? "", startsAt: isoToLocalInput(value.startsAt), timezone: value.timezone, title: value.title }; }
function monthRange(month: Date) { const from = new Date(month.getFullYear(), month.getMonth(), 1); from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); const to = new Date(from); to.setDate(to.getDate() + 41); to.setHours(23, 59, 59, 999); return { from, to }; }
function calendarDays(month: Date) { const { from } = monthRange(month); return Array.from({ length: 42 }, (_, index) => { const day = new Date(from); day.setDate(from.getDate() + index); return day; }); }
function startOfMonth(value: Date) { return new Date(value.getFullYear(), value.getMonth(), 1); }
function addMonths(value: Date, amount: number) { return new Date(value.getFullYear(), value.getMonth() + amount, 1); }
function isSameDay(left: Date, right: Date) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
function localInputToIso(value: string) { return new Date(value).toISOString(); }
function isoToLocalInput(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function formatCallDate(value: string) { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value)); }
function formatCallTime(start: string, end: string) { return `${formatShortTime(start)} – ${formatShortTime(end)}`; }
function formatShortTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatLongDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", hour: "numeric", minute: "2-digit", month: "long" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatCalendarDay(value: Date) { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long" }).format(value); }
function byStartTime(left: WorkspaceCall, right: WorkspaceCall) { return left.startsAt.localeCompare(right.startsAt); }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function capitalize(value: string) { return value.slice(0, 1).toUpperCase() + value.slice(1); }
function messageFor(error: unknown, fallback: string) { return error instanceof ApiClientError || error instanceof Error ? error.message : fallback; }
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

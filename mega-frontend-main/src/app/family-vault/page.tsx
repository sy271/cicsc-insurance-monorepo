"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Users, Share2, Upload, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ───────────────────────────────────────────────────────────────────

type InsuranceType = "life" | "medical" | "motor" | "travel" | "other";
type SharePermission = "view" | "claim_support" | "manage";

interface FamilySubProfile {
  id: string;
  owner_supabase_uid: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
}

interface PolicyDocument {
  id: string;
  sub_profile: string;
  title: string;
  insurance_type: InsuranceType;
  provider: string;
  storage_url: string;
  metadata: Record<string, unknown>;
  uploaded_by_supabase_uid: string;
  created_at: string;
}

interface PolicyShare {
  id: string;
  policy: string;
  shared_with_supabase_uid: string;
  shared_by_supabase_uid: string;
  permission: SharePermission;
  created_at: string;
}

interface FamilySubProfileManager {
  id: string;
  sub_profile: string;
  manager_supabase_uid: string;
  granted_by_supabase_uid: string;
  permission: SharePermission;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function DateOfBirthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  // Parse initial value
  useEffect(() => {
    if (!value) return;
    const [y, m, d] = value.split("-");
    if (y) setYear(y);
    if (m) setMonth(String(parseInt(m)));
    if (d) setDay(String(parseInt(d)));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (y: string, m: string, d: string) => {
    if (y && m && d) {
      const mm = m.padStart(2, "0");
      const dd = d.padStart(2, "0");
      onChange(`${y}-${mm}-${dd}`);
    } else {
      onChange("");
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);
  const daysInMonth = year && month
    ? new Date(Number(year), Number(month), 0).getDate()
    : 31;

  const select = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        className={select}
        value={day}
        onChange={(e) => { setDay(e.target.value); emit(year, month, e.target.value); }}
      >
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d)}>{d}</option>
        ))}
      </select>
      <select
        className={select}
        value={month}
        onChange={(e) => { setMonth(e.target.value); emit(year, e.target.value, day); }}
      >
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1)}>{m}</option>
        ))}
      </select>
      <select
        className={select}
        value={year}
        onChange={(e) => { setYear(e.target.value); emit(e.target.value, month, day); }}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

const SELECT_CLS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FamilyVaultPage() {
  const router = useRouter();
  const { session, user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [subProfiles, setSubProfiles] = useState<FamilySubProfile[]>([]);
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [shares, setShares] = useState<PolicyShare[]>([]);
  const [managers, setManagers] = useState<FamilySubProfileManager[]>([]);

  // ── Sub-profile form ──────────────────────────────────────────────────────
  const [spForm, setSpForm] = useState({ fullName: "", relationship: "", dateOfBirth: "" });

  // ── Policy upload form ───────────────────────────────────────────────────
  const [polForm, setPolForm] = useState({
    subProfileId: "",
    title: "",
    insuranceType: "other" as InsuranceType,
    provider: "",
  });
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [uploadingPolicy, setUploadingPolicy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Manager grant form ───────────────────────────────────────────────────
  const [mgrForm, setMgrForm] = useState({
    subProfileId: "",
    email: "",
    resolvedUid: "",
    permission: "manage" as SharePermission,
  });
  const [lookingUpEmail, setLookingUpEmail] = useState(false);

  // ── Share form ────────────────────────────────────────────────────────────
  const [shareForm, setShareForm] = useState({
    policyId: "",
    email: "",
    resolvedUid: "",
    permission: "claim_support" as SharePermission,
  });
  const [lookingUpShareEmail, setLookingUpShareEmail] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const ownSubProfileIds = useMemo(() => new Set(subProfiles.map((p) => p.id)), [subProfiles]);
  const delegatedPolicies = useMemo(
    () => policies.filter((p) => !ownSubProfileIds.has(p.sub_profile)),
    [ownSubProfileIds, policies],
  );
  const profileNameById = useMemo(() => {
    const m = new Map<string, string>();
    subProfiles.forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [subProfiles]);

  // ── Auth headers ──────────────────────────────────────────────────────────
  const authHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) throw new Error("Not signed in. Please sign in again.");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, [session?.access_token]);

  const bearerHeader = useCallback(() => {
    const token = session?.access_token;
    if (!token) throw new Error("Not signed in.");
    return { Authorization: `Bearer ${token}` };
  }, [session?.access_token]);

  // ── Load vault data ───────────────────────────────────────────────────────
  const loadVaultData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const h = { Authorization: `Bearer ${session.access_token}` };
      const [r1, r2, r3, r4] = await Promise.all([
        fetch(`${API_BASE_URL}/api/family-vault/subprofiles/`, { headers: h }),
        fetch(`${API_BASE_URL}/api/family-vault/policies/`, { headers: h }),
        fetch(`${API_BASE_URL}/api/family-vault/shares/`, { headers: h }),
        fetch(`${API_BASE_URL}/api/family-vault/managers/`, { headers: h }),
      ]);
      if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) {
        const errText = await (!r1.ok ? r1 : !r2.ok ? r2 : !r3.ok ? r3 : r4).text();
        let msg = "Failed to load Family Vault.";
        try { msg = (JSON.parse(errText) as { error?: string }).error || msg; } catch {}
        throw new Error(msg);
      }
      const [sp, pol, sh, mgr] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()]) as [
        FamilySubProfile[], PolicyDocument[], PolicyShare[], FamilySubProfileManager[]
      ];
      setSubProfiles(sp);
      setPolicies(pol);
      setShares(sh);
      setManagers(mgr);
      if (sp.length > 0) {
        setPolForm((prev) => prev.subProfileId ? prev : { ...prev, subProfileId: sp[0].id });
        setMgrForm((prev) => prev.subProfileId ? prev : { ...prev, subProfileId: sp[0].id });
      }
      if (pol.length > 0) {
        setShareForm((prev) => prev.policyId ? prev : { ...prev, policyId: pol[0].id });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { void loadVaultData(); }, [loadVaultData]);

  // ── Create sub-profile ────────────────────────────────────────────────────
  const createSubProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/family-vault/subprofiles/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          full_name: spForm.fullName.trim(),
          relationship: spForm.relationship.trim(),
          date_of_birth: spForm.dateOfBirth || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `Server ${res.status}`);
      }
      setSpForm({ fullName: "", relationship: "", dateOfBirth: "" });
      setSuccess("Sub-profile created.");
      await loadVaultData();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  // ── Upload policy (PDF) ───────────────────────────────────────────────────
  const uploadPolicy = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!polForm.subProfileId) { setError("Select a sub-profile."); return; }
    setUploadingPolicy(true);
    try {
      const fd = new FormData();
      fd.append("sub_profile", polForm.subProfileId);
      fd.append("insurance_type", polForm.insuranceType);
      if (polForm.title.trim()) fd.append("title", polForm.title.trim());
      if (polForm.provider.trim()) fd.append("provider", polForm.provider.trim());
      if (policyFile) fd.append("file", policyFile);

      const res = await fetch(`${API_BASE_URL}/api/family-vault/policies/`, {
        method: "POST",
        headers: bearerHeader(),
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `Server ${res.status}`);
      }
      setPolForm((prev) => ({ ...prev, title: "", provider: "" }));
      setPolicyFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(policyFile ? "Policy uploaded and indexed for RAG." : "Policy saved.");
      await loadVaultData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingPolicy(false);
    }
  };

  // ── Email lookup helper ───────────────────────────────────────────────────
  const lookupEmail = async (
    email: string,
    setLooking: (b: boolean) => void,
    onFound: (uid: string) => void,
  ) => {
    if (!email.trim()) { setError("Enter an email to look up."); return; }
    setLooking(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/family-vault/lookup-user/?email=${encodeURIComponent(email)}`,
        { headers: authHeaders() },
      );
      const d = await res.json() as { uid?: string; error?: string };
      if (!res.ok) throw new Error(d.error || "User not found");
      onFound(d.uid!);
      setSuccess(`Found user: ${email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLooking(false);
    }
  };

  // ── Grant manager access ──────────────────────────────────────────────────
  const grantManager = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!mgrForm.resolvedUid) { setError("Look up the sibling's email first."); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/family-vault/managers/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sub_profile: mgrForm.subProfileId,
          manager_supabase_uid: mgrForm.resolvedUid,
          permission: mgrForm.permission,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `Server ${res.status}`);
      }
      setMgrForm((prev) => ({ ...prev, email: "", resolvedUid: "" }));
      setSuccess("Family manager access granted.");
      await loadVaultData();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  // ── Revoke manager ────────────────────────────────────────────────────────
  const revokeManager = async (managerId: string) => {
    setError(null); setSuccess(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/family-vault/managers/${managerId}/revoke/`,
        { method: "DELETE", headers: authHeaders() },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `Server ${res.status}`);
      }
      setSuccess("Manager access revoked.");
      await loadVaultData();
    } catch (e) { setError(e instanceof Error ? e.message : "Revoke failed"); }
  };

  // ── Share policy ──────────────────────────────────────────────────────────
  const sharePolicy = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!shareForm.resolvedUid) { setError("Look up the sibling's email first."); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/family-vault/shares/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          policy: shareForm.policyId,
          shared_with_supabase_uid: shareForm.resolvedUid,
          permission: shareForm.permission,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `Server ${res.status}`);
      }
      setShareForm((prev) => ({ ...prev, email: "", resolvedUid: "" }));
      setSuccess("Policy access shared.");
      await loadVaultData();
    } catch (e) { setError(e instanceof Error ? e.message : "Share failed"); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-2">Hybrid Family Vault</h1>
      <p className="text-muted-foreground mb-6">
        Centralized insurance dashboard for your whole family with secure sharing controls.
        Manage parents and dependents, then delegate secure access to siblings so everyone can help.
      </p>

      {authLoading && <p className="text-sm text-muted-foreground mb-4">Checking session…</p>}
      {!authLoading && !session && (
        <p className="text-sm text-red-600 mb-4">Please sign in to use Family Vault.</p>
      )}
      {loading && <p className="text-sm text-muted-foreground mb-4">Loading…</p>}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subProfiles.length}</div>
            <p className="text-xs text-muted-foreground">Parents / dependents you manage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delegated Access</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{delegatedPolicies.length}</div>
            <p className="text-xs text-muted-foreground">Policies shared with your account</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Access Security</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RBAC</div>
            <p className="text-xs text-muted-foreground">Role-based policy permissions</p>
            <p className="text-xs text-muted-foreground">
              {managers.length} manager grants · {shares.length} policy shares
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="manage">Manage Sub-Profiles</TabsTrigger>
          <TabsTrigger value="share">Policy Sharing (RBAC)</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Sub-Profiles ─────────────────────────────────────────── */}
        <TabsContent value="manage">
          <div className="space-y-6">

            {/* Existing sub-profiles */}
            {subProfiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Family Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subProfiles.map((profile) => {
                      const pCount = policies.filter((p) => p.sub_profile === profile.id).length;
                      return (
                        <div key={profile.id} className="flex items-center justify-between border rounded-lg p-4">
                          <div>
                            <p className="font-medium">{profile.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {profile.relationship}
                              {profile.date_of_birth ? ` · DOB: ${profile.date_of_birth}` : ""}
                              {" · "}
                              {pCount} {pCount === 1 ? "policy" : "policies"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(profile.updated_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Create sub-profile */}
            <Card>
              <CardHeader>
                <CardTitle>Create New Sub-Profile</CardTitle>
                <CardDescription>
                  Add your father, mother, or any dependent who doesn&apos;t use the app directly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createSubProfile} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Full name (e.g. Chen Yoke San)"
                      value={spForm.fullName}
                      onChange={(e) => setSpForm((p) => ({ ...p, fullName: e.target.value }))}
                      required
                    />
                    <Input
                      placeholder="Relationship (father, mother, sibling…)"
                      value={spForm.relationship}
                      onChange={(e) => setSpForm((p) => ({ ...p, relationship: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Date of Birth</p>
                    <DateOfBirthPicker
                      value={spForm.dateOfBirth}
                      onChange={(iso) => setSpForm((p) => ({ ...p, dateOfBirth: iso }))}
                    />
                  </div>
                  <Button className="w-full" disabled={!session}>
                    Create Sub-Profile
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Upload policy PDF */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Policy for a Parent / Dependent</CardTitle>
                <CardDescription>
                  Drop a PDF — AI extracts key details automatically and indexes it for Emergency RAG.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={uploadPolicy} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <select
                      className={SELECT_CLS}
                      value={polForm.subProfileId}
                      onChange={(e) => setPolForm((p) => ({ ...p, subProfileId: e.target.value }))}
                      required
                    >
                      <option value="">Select family member</option>
                      {subProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name} ({profile.relationship})
                        </option>
                      ))}
                    </select>
                    <select
                      className={SELECT_CLS}
                      value={polForm.insuranceType}
                      onChange={(e) => setPolForm((p) => ({ ...p, insuranceType: e.target.value as InsuranceType }))}
                    >
                      <option value="life">Life</option>
                      <option value="medical">Medical</option>
                      <option value="motor">Motor</option>
                      <option value="travel">Travel</option>
                      <option value="other">Other</option>
                    </select>
                    <Input
                      placeholder="Policy title (auto-filled from PDF if left blank)"
                      value={polForm.title}
                      onChange={(e) => setPolForm((p) => ({ ...p, title: e.target.value }))}
                    />
                    <Input
                      placeholder="Provider (auto-filled from PDF if left blank)"
                      value={polForm.provider}
                      onChange={(e) => setPolForm((p) => ({ ...p, provider: e.target.value }))}
                    />
                  </div>

                  {/* PDF drop zone */}
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) setPolicyFile(f);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) setPolicyFile(e.target.files[0]); }}
                    />
                    {policyFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <Upload className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{policyFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPolicyFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Drag &amp; drop a PDF here, or click to browse
                      </p>
                    )}
                  </div>

                  <Button className="w-full" disabled={!session || uploadingPolicy || subProfiles.length === 0}>
                    {uploadingPolicy ? "Uploading & Extracting…" : "Upload Policy"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Grant manager access */}
            <Card>
              <CardHeader>
                <CardTitle>Family Managers (Sub-Profile Level)</CardTitle>
                <CardDescription>
                  Grant a sibling access to an entire parent profile. All existing and future policies
                  under that profile become accessible automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={grantManager} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <select
                      className={SELECT_CLS}
                      value={mgrForm.subProfileId}
                      onChange={(e) => setMgrForm((p) => ({ ...p, subProfileId: e.target.value }))}
                      required
                    >
                      <option value="">Select family member</option>
                      {subProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name} ({profile.relationship})
                        </option>
                      ))}
                    </select>
                    <select
                      className={SELECT_CLS}
                      value={mgrForm.permission}
                      onChange={(e) => setMgrForm((p) => ({ ...p, permission: e.target.value as SharePermission }))}
                    >
                      <option value="view">View only</option>
                      <option value="claim_support">View + claim support</option>
                      <option value="manage">Full manage</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Sibling's email address"
                      value={mgrForm.email}
                      onChange={(e) => setMgrForm((p) => ({ ...p, email: e.target.value, resolvedUid: "" }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={lookingUpEmail || !mgrForm.email}
                      onClick={() =>
                        lookupEmail(mgrForm.email, setLookingUpEmail, (uid) =>
                          setMgrForm((p) => ({ ...p, resolvedUid: uid }))
                        )
                      }
                    >
                      {lookingUpEmail ? "Looking up…" : "Look up"}
                    </Button>
                  </div>
                  {mgrForm.resolvedUid && (
                    <p className="text-xs text-green-700">
                      ✓ Found: {mgrForm.email} — ready to grant
                    </p>
                  )}

                  <Button
                    className="w-full"
                    disabled={!session || !mgrForm.resolvedUid || subProfiles.length === 0}
                  >
                    Grant Family Manager Access
                  </Button>
                </form>

                {/* Existing manager grants */}
                {managers.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Current Manager Grants</p>
                    {managers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <p className="text-sm font-medium">
                            {profileNameById.get(m.sub_profile) || "Unknown profile"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            UID: {m.manager_supabase_uid} · {m.permission}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => void revokeManager(m.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2: Policy Sharing (RBAC) ────────────────────────────────── */}
        <TabsContent value="share">
          <div className="space-y-6">

            {/* Policies you can access */}
            <Card>
              <CardHeader>
                <CardTitle>Policies You Can Access</CardTitle>
              </CardHeader>
              <CardContent>
                {policies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No policies yet. Upload a PDF in the first tab.</p>
                ) : (
                  <div className="space-y-2">
                    {policies.map((policy) => (
                      <div key={policy.id} className="border rounded-md p-3">
                        <p className="font-medium">{policy.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {profileNameById.get(policy.sub_profile) || "Shared"} · {policy.insurance_type}
                          {policy.provider ? ` · ${policy.provider}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added {formatRelativeTime(policy.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Share individual policy */}
            <Card>
              <CardHeader>
                <CardTitle>Share Individual Policy</CardTitle>
                <CardDescription>
                  Give a sibling access to a specific policy. Use sub-profile managers (tab 1) to share
                  all policies at once.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={sharePolicy} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <select
                      className={SELECT_CLS}
                      value={shareForm.policyId}
                      onChange={(e) => setShareForm((p) => ({ ...p, policyId: e.target.value }))}
                      required
                    >
                      <option value="">Select policy</option>
                      {policies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.title}
                        </option>
                      ))}
                    </select>
                    <select
                      className={SELECT_CLS}
                      value={shareForm.permission}
                      onChange={(e) => setShareForm((p) => ({ ...p, permission: e.target.value as SharePermission }))}
                    >
                      <option value="view">View only</option>
                      <option value="claim_support">View + claim support</option>
                      <option value="manage">Full manage</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Sibling's email address"
                      value={shareForm.email}
                      onChange={(e) => setShareForm((p) => ({ ...p, email: e.target.value, resolvedUid: "" }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={lookingUpShareEmail || !shareForm.email}
                      onClick={() =>
                        lookupEmail(shareForm.email, setLookingUpShareEmail, (uid) =>
                          setShareForm((p) => ({ ...p, resolvedUid: uid }))
                        )
                      }
                    >
                      {lookingUpShareEmail ? "Looking up…" : "Look up"}
                    </Button>
                  </div>
                  {shareForm.resolvedUid && (
                    <p className="text-xs text-green-700">
                      ✓ Found: {shareForm.email} — ready to share
                    </p>
                  )}

                  <Button
                    className="w-full"
                    disabled={!session || !shareForm.resolvedUid || policies.length === 0}
                  >
                    Share Policy Access
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* RBAC activity log */}
            <Card>
              <CardHeader>
                <CardTitle>RBAC Share Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {shares.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No share activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {shares.map((s) => (
                      <div key={s.id} className="border rounded-md p-3">
                        <p className="text-sm font-medium">
                          {policies.find((p) => p.id === s.policy)?.title || "Unknown policy"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Shared {formatRelativeTime(s.created_at)} · permission: {s.permission}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => void loadVaultData()}>Refresh</Button>
              <Button variant="outline" onClick={() => router.push("/analysis")}>
                Analyze Coverage
              </Button>
            </div>

            {user && (
              <p className="text-xs text-muted-foreground">Signed in as: {user.email || user.id}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


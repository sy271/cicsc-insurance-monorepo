"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Users, Share2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

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

const relationshipExamples = "father, mother, sister, brother, spouse, child";

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export default function FamilyVaultPage() {
  const router = useRouter();
  const { session, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subProfiles, setSubProfiles] = useState<FamilySubProfile[]>([]);
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [shares, setShares] = useState<PolicyShare[]>([]);
  const [subProfileManagers, setSubProfileManagers] = useState<FamilySubProfileManager[]>([]);

  const [subProfileForm, setSubProfileForm] = useState({
    fullName: "",
    relationship: "",
    dateOfBirth: "",
  });
  const [policyForm, setPolicyForm] = useState({
    subProfileId: "",
    title: "",
    insuranceType: "other" as InsuranceType,
    provider: "",
    storageUrl: "",
    metadataJson: "",
  });
  const [shareForm, setShareForm] = useState({
    policyId: "",
    sharedWithUid: "",
    permission: "claim_support" as SharePermission,
  });
  const [managerForm, setManagerForm] = useState({
    subProfileId: "",
    managerUid: "",
    permission: "manage" as SharePermission,
  });

  const ownSubProfileIds = useMemo(() => new Set(subProfiles.map((item) => item.id)), [subProfiles]);
  const ownPolicies = useMemo(
    () => policies.filter((policy) => ownSubProfileIds.has(policy.sub_profile)),
    [ownSubProfileIds, policies]
  );
  const delegatedPolicies = useMemo(
    () => policies.filter((policy) => !ownSubProfileIds.has(policy.sub_profile)),
    [ownSubProfileIds, policies]
  );
  const managedShareCount = useMemo(
    () => shares.filter((share) => share.permission === "manage").length,
    [shares]
  );
  const subProfileManagerCount = useMemo(
    () => subProfileManagers.length,
    [subProfileManagers]
  );

  const authHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) {
      throw new Error("You are not signed in. Please sign in again.");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [session?.access_token]);

  const loadVaultData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };
      const [subProfilesResponse, policiesResponse, sharesResponse, managersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/family-vault/subprofiles/`, { headers }),
        fetch(`${API_BASE_URL}/api/family-vault/policies/`, { headers }),
        fetch(`${API_BASE_URL}/api/family-vault/shares/`, { headers }),
        fetch(`${API_BASE_URL}/api/family-vault/managers/`, { headers }),
      ]);

      if (!subProfilesResponse.ok || !policiesResponse.ok || !sharesResponse.ok || !managersResponse.ok) {
        throw new Error("Failed to load family vault data.");
      }

      const subProfilesData = (await subProfilesResponse.json()) as FamilySubProfile[];
      const policiesData = (await policiesResponse.json()) as PolicyDocument[];
      const sharesData = (await sharesResponse.json()) as PolicyShare[];
      const managersData = (await managersResponse.json()) as FamilySubProfileManager[];

      setSubProfiles(subProfilesData);
      setPolicies(policiesData);
      setShares(sharesData);
      setSubProfileManagers(managersData);

      if (subProfilesData.length > 0) {
        setPolicyForm((prev) =>
          prev.subProfileId ? prev : { ...prev, subProfileId: subProfilesData[0].id }
        );
        setManagerForm((prev) =>
          prev.subProfileId ? prev : { ...prev, subProfileId: subProfilesData[0].id }
        );
      }
      if (policiesData.length > 0) {
        setShareForm((prev) =>
          prev.policyId ? prev : { ...prev, policyId: policiesData[0].id }
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load family vault.");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadVaultData();
  }, [loadVaultData]);

  const createSubProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/family-vault/subprofiles/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          full_name: subProfileForm.fullName.trim(),
          relationship: subProfileForm.relationship.trim(),
          date_of_birth: subProfileForm.dateOfBirth || null,
        }),
      });
      if (!response.ok) {
        throw new Error("Could not create sub-profile.");
      }
      setSubProfileForm({ fullName: "", relationship: "", dateOfBirth: "" });
      setSuccess("Sub-profile created.");
      await loadVaultData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create sub-profile.");
    }
  };

  const createPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    let metadata: Record<string, unknown> = {};
    if (policyForm.metadataJson.trim()) {
      try {
        metadata = JSON.parse(policyForm.metadataJson) as Record<string, unknown>;
      } catch {
        setError("Metadata must be valid JSON.");
        return;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/family-vault/policies/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sub_profile: policyForm.subProfileId,
          title: policyForm.title.trim(),
          insurance_type: policyForm.insuranceType,
          provider: policyForm.provider.trim(),
          storage_url: policyForm.storageUrl.trim(),
          metadata,
        }),
      });
      if (!response.ok) {
        throw new Error("Could not create policy. Make sure you have manage access.");
      }
      setPolicyForm((prev) => ({
        ...prev,
        title: "",
        provider: "",
        storageUrl: "",
        metadataJson: "",
      }));
      setSuccess("Policy added to family vault.");
      await loadVaultData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create policy.");
    }
  };

  const sharePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/family-vault/shares/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          policy: shareForm.policyId,
          shared_with_supabase_uid: shareForm.sharedWithUid.trim(),
          permission: shareForm.permission,
        }),
      });
      if (!response.ok) {
        throw new Error("Could not share policy. You need owner/manager access.");
      }
      setShareForm((prev) => ({ ...prev, sharedWithUid: "" }));
      setSuccess("Policy access shared.");
      await loadVaultData();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Could not share policy.");
    }
  };

  const grantSubProfileManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/family-vault/managers/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sub_profile: managerForm.subProfileId,
          manager_supabase_uid: managerForm.managerUid.trim(),
          permission: managerForm.permission,
        }),
      });
      if (!response.ok) {
        throw new Error("Could not grant sub-profile manager access.");
      }
      setManagerForm((prev) => ({ ...prev, managerUid: "" }));
      setSuccess("Family manager access granted at sub-profile level.");
      await loadVaultData();
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : "Could not grant manager access.");
    }
  };

  const profileNameById = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const profile of subProfiles) {
      lookup.set(profile.id, profile.full_name);
    }
    return lookup;
  }, [subProfiles]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-2">Hybrid Family Vault</h1>
      <p className="text-muted-foreground mb-6">
        Manage parents and dependents, then delegate secure access to siblings so everyone can help with claims.
      </p>

      {authLoading ? <p className="text-sm text-muted-foreground mb-4">Checking session...</p> : null}
      {!authLoading && !session ? (
        <p className="text-sm text-red-600 mb-4">Please sign in to use Family Vault RBAC.</p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground mb-4">Loading family vault...</p> : null}
      {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
      {success ? <p className="text-sm text-green-700 mb-4">{success}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subProfiles.length}</div>
            <p className="text-xs text-muted-foreground">Parents/dependents you directly manage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Shared Policies</CardTitle>
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
            <p className="text-xs text-muted-foreground">
              {subProfileManagerCount} family manager grants, {managedShareCount} policy-manage shares
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="manage">Manage Sub-Profiles</TabsTrigger>
          <TabsTrigger value="share">Policy Sharing (RBAC)</TabsTrigger>
        </TabsList>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Family Sub-Profiles</CardTitle>
              <CardDescription>
                Add your parents once, then your siblings can collaborate via policy-level permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subProfiles.map((profile) => {
                  const policyCount = ownPolicies.filter((policy) => policy.sub_profile === profile.id).length;
                  return (
                    <div key={profile.id} className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <p className="font-medium">{profile.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Relationship: {profile.relationship} - {policyCount} policies
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Updated {formatRelativeTime(profile.updated_at)}</p>
                      </div>
                    </div>
                  );
                })}

                <form onSubmit={createSubProfile} className="space-y-3 border rounded-lg p-4">
                  <p className="font-medium">Create New Sub-Profile</p>
                  <div className="grid md:grid-cols-3 gap-3">
                    <Input
                      placeholder="Full name (e.g. Chen Yoke San)"
                      value={subProfileForm.fullName}
                      onChange={(event) =>
                        setSubProfileForm((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                      required
                    />
                    <Input
                      placeholder={`Relationship (${relationshipExamples})`}
                      value={subProfileForm.relationship}
                      onChange={(event) =>
                        setSubProfileForm((prev) => ({ ...prev, relationship: event.target.value }))
                      }
                      required
                    />
                    <Input
                      type="date"
                      value={subProfileForm.dateOfBirth}
                      onChange={(event) =>
                        setSubProfileForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                      }
                    />
                  </div>
                  <Button className="w-full" disabled={!session}>
                    Create New Sub-Profile
                  </Button>
                </form>

                <form onSubmit={createPolicy} className="space-y-3 border rounded-lg p-4">
                  <p className="font-medium">Add Policy for a Parent/Dependent</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={policyForm.subProfileId}
                      onChange={(event) =>
                        setPolicyForm((prev) => ({ ...prev, subProfileId: event.target.value }))
                      }
                      required
                    >
                      <option value="">Select sub-profile</option>
                      {subProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name} ({profile.relationship})
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Policy title"
                      value={policyForm.title}
                      onChange={(event) =>
                        setPolicyForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={policyForm.insuranceType}
                      onChange={(event) =>
                        setPolicyForm((prev) => ({
                          ...prev,
                          insuranceType: event.target.value as InsuranceType,
                        }))
                      }
                    >
                      <option value="life">Life</option>
                      <option value="medical">Medical</option>
                      <option value="motor">Motor</option>
                      <option value="travel">Travel</option>
                      <option value="other">Other</option>
                    </select>
                    <Input
                      placeholder="Insurance provider"
                      value={policyForm.provider}
                      onChange={(event) =>
                        setPolicyForm((prev) => ({ ...prev, provider: event.target.value }))
                      }
                    />
                    <Input
                      className="md:col-span-2"
                      placeholder="Policy file URL or secure storage URL"
                      value={policyForm.storageUrl}
                      onChange={(event) =>
                        setPolicyForm((prev) => ({ ...prev, storageUrl: event.target.value }))
                      }
                      required
                    />
                    <Textarea
                      className="md:col-span-2"
                      placeholder='Optional metadata JSON. Example: {"coverage": 500000, "premium": 350}'
                      value={policyForm.metadataJson}
                      onChange={(event) =>
                        setPolicyForm((prev) => ({ ...prev, metadataJson: event.target.value }))
                      }
                    />
                  </div>
                  <Button className="w-full" disabled={!session || subProfiles.length === 0}>
                    Add Policy
                  </Button>
                </form>

                <form onSubmit={grantSubProfileManager} className="space-y-3 border rounded-lg p-4">
                  <p className="font-medium">Family Managers (Sub-Profile Level)</p>
                  <p className="text-xs text-muted-foreground">
                    Grant sibling access once at parent profile level. New policies under that profile are automatically accessible.
                  </p>
                  <div className="grid md:grid-cols-3 gap-3">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={managerForm.subProfileId}
                      onChange={(event) =>
                        setManagerForm((prev) => ({ ...prev, subProfileId: event.target.value }))
                      }
                      required
                    >
                      <option value="">Select sub-profile</option>
                      {subProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name} ({profile.relationship})
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Sibling Supabase UID"
                      value={managerForm.managerUid}
                      onChange={(event) =>
                        setManagerForm((prev) => ({ ...prev, managerUid: event.target.value }))
                      }
                      required
                    />
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={managerForm.permission}
                      onChange={(event) =>
                        setManagerForm((prev) => ({
                          ...prev,
                          permission: event.target.value as SharePermission,
                        }))
                      }
                    >
                      <option value="view">View only</option>
                      <option value="claim_support">View + claim support</option>
                      <option value="manage">Full manage</option>
                    </select>
                  </div>
                  <Button className="w-full" disabled={!session || subProfiles.length === 0}>
                    Grant Family Manager Access
                  </Button>
                </form>

                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Current Family Manager Grants</p>
                  {subProfileManagers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No family manager grants yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {subProfileManagers.map((manager) => (
                        <div key={manager.id} className="border rounded-md p-3">
                          <p className="text-sm">
                            {profileNameById.get(manager.sub_profile) || "Unknown profile"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Manager: {manager.manager_supabase_uid}
                          </p>
                          <p className="text-xs">
                            Permission: {manager.permission}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="share">
          <Card>
            <CardHeader>
              <CardTitle>Secure Policy Sharing</CardTitle>
              <CardDescription>
                Share policy access with siblings: `view`, `claim_support`, or full `manage`.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Policies You Can Access</p>
                  {policies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No policies yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {policies.map((policy) => (
                        <div key={policy.id} className="border rounded-md p-3">
                          <p className="font-medium">{policy.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {profileNameById.get(policy.sub_profile) || "Shared from another manager"} - {policy.insurance_type}
                          </p>
                          <p className="text-xs text-muted-foreground">Provider: {policy.provider || "N/A"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={sharePolicy} className="space-y-3 border rounded-lg p-4">
                  <p className="font-medium">Share Policy With Sibling</p>
                  <div className="grid md:grid-cols-3 gap-3">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={shareForm.policyId}
                      onChange={(event) =>
                        setShareForm((prev) => ({ ...prev, policyId: event.target.value }))
                      }
                      required
                    >
                      <option value="">Select policy</option>
                      {policies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.title}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Sibling Supabase UID"
                      value={shareForm.sharedWithUid}
                      onChange={(event) =>
                        setShareForm((prev) => ({ ...prev, sharedWithUid: event.target.value }))
                      }
                      required
                    />
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={shareForm.permission}
                      onChange={(event) =>
                        setShareForm((prev) => ({
                          ...prev,
                          permission: event.target.value as SharePermission,
                        }))
                      }
                    >
                      <option value="view">View only</option>
                      <option value="claim_support">View + claim support</option>
                      <option value="manage">Full manage</option>
                    </select>
                  </div>
                  <Button className="w-full" disabled={!session || policies.length === 0}>
                    Share Policy Access
                  </Button>
                </form>

                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-2">RBAC Share Activity</p>
                  {shares.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No share activity yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {shares.map((item) => (
                        <div key={item.id} className="border rounded-md p-3">
                          <p className="text-sm">
                            Policy ID: {item.policy}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            From: {item.shared_by_supabase_uid} - To: {item.shared_with_supabase_uid}
                          </p>
                          <p className="text-xs">Permission: {item.permission}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => void loadVaultData()}>
                    Refresh Vault Data
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/analysis")}>
                    Analyze Coverage
                  </Button>
                </div>

                {user ? (
                  <div className="text-xs text-muted-foreground">
                    Signed in as: {user.id}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


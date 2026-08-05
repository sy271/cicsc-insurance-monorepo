"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Users, Share2 } from "lucide-react";

const subProfiles = [
  { name: "Father - Tan Ah Seng", role: "Primary Dependent", policies: 3, lastUpdated: "2 days ago" },
  { name: "Mother - Lim Siew Mei", role: "Primary Dependent", policies: 2, lastUpdated: "Yesterday" },
  { name: "Daughter - Anna Tan", role: "Child", policies: 1, lastUpdated: "5 days ago" },
];

const sharedPolicies = [
  {
    policy: "Dad's Medical Policy",
    owner: "Sibling A",
    sharedWith: "Sibling B",
    access: "View + Claim Support",
  },
  {
    policy: "Family Motor Policy",
    owner: "You",
    sharedWith: "Sibling A",
    access: "View Only",
  },
];

export default function FamilyVaultPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-2">Hybrid Family Vault</h1>
      <p className="text-muted-foreground mb-6">
        Centralized insurance dashboard for your whole family with secure sharing controls.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">Including managed dependents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Shared Policies</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Cross-sibling policy visibility</p>
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
                Upload and manage policies for parents or children who do not use the app directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subProfiles.map((profile) => (
                  <div
                    key={profile.name}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.role} - {profile.policies} policies
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Updated {profile.lastUpdated}</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Manage Profile
                      </Button>
                    </div>
                  </div>
                ))}
                <Button className="w-full">Create New Sub-Profile</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="share">
          <Card>
            <CardHeader>
              <CardTitle>Secure Policy Sharing</CardTitle>
              <CardDescription>
                Share selected policies with siblings using role-based access controls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sharedPolicies.map((item) => (
                  <div key={item.policy} className="border rounded-lg p-4">
                    <p className="font-medium">{item.policy}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Owner: {item.owner} - Shared with: {item.sharedWith}
                    </p>
                    <p className="text-sm mt-1">Permission: {item.access}</p>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline">Share a Policy</Button>
                  <Button variant="outline">Manage Access Roles</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


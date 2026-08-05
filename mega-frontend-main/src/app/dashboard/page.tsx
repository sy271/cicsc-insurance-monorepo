import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PieChart, BarChart, Activity, AlertCircle } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Insurance Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">Active policies</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Premium</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM 2,450</div>
            <p className="text-xs text-muted-foreground">Per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Coverage Gaps</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Areas need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Claims</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Policies</CardTitle>
            <CardDescription>Overview of your insurance coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { type: "Medical Insurance", provider: "AIA", premium: "RM 850" },
                { type: "Life Insurance", provider: "Prudential", premium: "RM 750" },
                { type: "Auto Insurance", provider: "Allianz", premium: "RM 450" },
                { type: "Home Insurance", provider: "Zurich", premium: "RM 400" },
              ].map((policy, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{policy.type}</div>
                    <div className="text-sm text-muted-foreground">{policy.provider}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{policy.premium}</div>
                    <div className="text-sm text-muted-foreground">Monthly</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button className="w-full" variant="outline">Add New Policy</Button>
              <Button className="w-full" variant="outline">File a Claim</Button>
              <Button className="w-full" variant="outline">View Analysis</Button>
              <Button className="w-full" variant="outline">Contact Support</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Core Module Coverage</CardTitle>
          <CardDescription>Status of the 4-module architecture in this build</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <p className="font-medium">Module 1: Hybrid Family Vault</p>
              <p className="text-sm text-muted-foreground mt-1">Sub-profiles + RBAC sharing (UI ready)</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="font-medium">Module 2: Smart Document Classifier</p>
              <p className="text-sm text-muted-foreground mt-1">AI PDF classification + extraction flow active</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="font-medium">Module 3: Gap & Premium Optimization</p>
              <p className="text-sm text-muted-foreground mt-1">Overlap engine + family gap alerts with upselling mock</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="font-medium">Module 4: Emergency RAG + Claims UI</p>
              <p className="text-sm text-muted-foreground mt-1">Claims assistant with automation mock wizard</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

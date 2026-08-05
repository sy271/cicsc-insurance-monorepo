import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Clock, ShieldCheck } from "lucide-react"

export default function ClaimsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Claims Assistant</h1>

      <Tabs defaultValue="report" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="report">Report Incident</TabsTrigger>
          <TabsTrigger value="verify">Coverage Check</TabsTrigger>
          <TabsTrigger value="track">Track Claims</TabsTrigger>
          <TabsTrigger value="automation">AI Automation (Mock)</TabsTrigger>
        </TabsList>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>Report an Incident</CardTitle>
              <CardDescription>Tell us what happened in your own words</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg flex items-start gap-4">
                  <MessageSquare className="h-5 w-5 mt-1" />
                  <textarea 
                    className="w-full p-2 border rounded-md h-24" 
                    placeholder="Describe what happened... (e.g., 'I had a car accident' or 'I was admitted to the hospital')"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Incident</label>
                    <input type="date" className="w-full p-2 border rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time of Incident</label>
                    <input type="time" className="w-full p-2 border rounded-md" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <input type="text" className="w-full p-2 border rounded-md" placeholder="Where did it happen?" />
                </div>

                <Button className="w-full">Submit Report</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Verification</CardTitle>
              <CardDescription>Check if your incident is covered by your policies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Relevant Policies</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <span>Medical Insurance (AIA)</span>
                      <span className="text-green-600">Covered</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <span>Personal Accident (Prudential)</span>
                      <span className="text-yellow-600">Partial Coverage</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Estimated Coverage</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Maximum Claim Amount:</span>
                      <span className="font-medium">RM 50,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deductible:</span>
                      <span className="font-medium">RM 1,000</span>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full">Download Coverage Report</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="track">
          <Card>
            <CardHeader>
              <CardTitle>Claims Tracking</CardTitle>
              <CardDescription>Monitor the status of your claims</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg divide-y">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <h3 className="font-medium">Hospital Admission Claim</h3>
                      </div>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">In Progress</span>
                    </div>
                    <p className="text-sm text-gray-600">Claim #12345 - Submitted on April 15, 2025</p>
                    <div className="mt-4">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 w-1/2"></div>
                      </div>
                      <div className="flex justify-between mt-2 text-sm text-gray-500">
                        <span>Submitted</span>
                        <span>Processing</span>
                        <span>Payment</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <h3 className="font-medium">Car Accident Claim</h3>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Completed</span>
                    </div>
                    <p className="text-sm text-gray-600">Claim #12344 - Completed on March 30, 2025</p>
                  </div>
                </div>

                <Button variant="outline" className="w-full">View All Claims</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation">
          <Card>
            <CardHeader>
              <CardTitle>Emergency RAG + Claims Automation</CardTitle>
              <CardDescription>
                Mock flow: AI reads family policies, verifies eligibility, and prepares settlement checklist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Emergency Prompt</h3>
                  <p className="text-sm text-gray-600">
                    &quot;My dad got into a car crash.&quot; {"->"} AI reads Dad&apos;s Motor + Medical policies, then explains
                    towing, hospital admission limits, and next claim steps.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4">
                    <p className="font-medium">1) Document Verification</p>
                    <p className="text-sm text-gray-600 mt-1">IC, police report, photos, workshop invoice</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="font-medium">2) Eligibility Checks</p>
                    <p className="text-sm text-gray-600 mt-1">Coverage period, exclusions, deductible review</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="font-medium">3) Settlement Preparation</p>
                    <p className="text-sm text-gray-600 mt-1">Estimate payout and route to insurer workflow</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <ShieldCheck className="h-5 w-5 mt-0.5 text-blue-600" />
                  <p className="text-sm text-blue-900">
                    This is a mock automation UI for demo. Production mode would run live insurer integrations.
                  </p>
                </div>

                <Button className="w-full">Start Guided Claim Wizard</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

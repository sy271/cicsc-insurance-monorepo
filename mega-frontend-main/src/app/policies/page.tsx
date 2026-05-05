'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, Database } from "lucide-react"
import { analyzeDocument } from '@/lib/api'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function PoliciesPage() {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Policy Management</h1>
        <Button>Add New Policy</Button>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="upload">Document Upload</TabsTrigger>
          <TabsTrigger value="api" disabled>API Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Manual Policy Entry</CardTitle>
              <CardDescription>Enter your policy details manually</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Insurance Type</label>
                    <select className="w-full p-2 border rounded-md">
                      <option>Medical Insurance</option>
                      <option>Life Insurance</option>
                      <option>Auto Insurance</option>
                      <option>Home Insurance</option>
                      <option>Travel Insurance</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Insurance Provider</label>
                    <select className="w-full p-2 border rounded-md">
                      <option>AIA</option>
                      <option>Prudential</option>
                      <option>Allianz</option>
                      <option>Zurich</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Policy Number</label>
                    <input type="text" className="w-full p-2 border rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Premium Amount (RM)</label>
                    <input type="number" className="w-full p-2 border rounded-md" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Coverage Details</label>
                  <textarea className="w-full p-2 border rounded-md h-24"></textarea>
                </div>
                <Button className="w-full">Save Policy</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Document Upload</CardTitle>
              <CardDescription>Upload your policy documents for automatic parsing</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  
                  const files = Array.from(e.dataTransfer.files)
                  if (files.length > 0) {
                    setAnalyzing(true)
                    try {
                      const result = await analyzeDocument(files[0])
                      setAnalysisResult(result)
                      toast.success('Analysis Complete', {
                        description: 'Your document has been analyzed successfully.',
                      })
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : 'Unknown error'
                      toast.error('Analysis Failed', {
                        description: message,
                      })
                    } finally {
                      setAnalyzing(false)
                    }
                  }
                }}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium">
                  {analyzing ? 'Analyzing...' : 'Drag and drop your files here'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">Or</p>
                <input
                  type="file"
                  className="hidden"
                  id="file-upload"
                  onChange={async (e) => {
                    const files = e.target.files
                    if (files && files.length > 0) {
                      setAnalyzing(true)
                      try {
                        const result = await analyzeDocument(files[0])
                        setAnalysisResult(result)
                        toast.success('Analysis Complete', {
                          description: 'Your document has been analyzed successfully.',
                        })
                      } catch (error) {
                        const message =
                          error instanceof Error ? error.message : 'Unknown error'
                        toast.error('Analysis Failed', {
                          description: message,
                        })
                      } finally {
                        setAnalyzing(false)
                      }
                    }
                  }}
                />
                <Button 
                  variant="outline" 
                  className="mt-2"
                  disabled={analyzing}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Browse Files
                </Button>
              </div>
              {analysisResult && (
                <Alert className="mt-4">
                  <AlertTitle>Analysis Results</AlertTitle>
                  <AlertDescription>
                    {(() => {
                      try {
                        const jsonMatch = analysisResult.response.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                          const jsonData = JSON.parse(jsonMatch[0]) as Record<string, unknown>
                          const benefits = Array.isArray(jsonData.coverage_benefits)
                            ? jsonData.coverage_benefits
                            : []
                          const details = Array.isArray(jsonData.important_details)
                            ? jsonData.important_details
                            : []
                          return (
                            <div className="space-y-2">
                              <p><b>Insurance Type:</b> {String(jsonData.insurance_type ?? '—')}</p>
                              <p><b>Provider:</b> {String(jsonData.insurance_provider ?? '—')}</p>
                              <p><b>Policy Number:</b> {String(jsonData.policy_number ?? '—')}</p>
                              <p><b>Expiry Date:</b> {String(jsonData.expiry_date ?? '—')}</p>
                              <div>
                                <b>Coverage Benefits:</b>
                                <ul className="list-disc pl-5">
                                  {benefits.map((benefit: unknown, index: number) => (
                                    <li key={index}>{String(benefit)}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <b>Important Details:</b>
                                <ul className="list-disc pl-5">
                                  {details.map((detail: unknown, index: number) => (
                                    <li key={index}>{String(detail)}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          );
                        }
                        return String(analysisResult.response ?? '');
                      } catch (error: unknown) {
                        console.error('Error parsing JSON:', error);
                        return analysisResult.response;
                      }
                    })()}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Integration</CardTitle>
              <CardDescription>Coming soon - Direct integration with insurance providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6">
                <Database className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">This feature is coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

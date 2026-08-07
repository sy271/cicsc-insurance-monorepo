'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, Database, CheckCircle2, XCircle } from "lucide-react"
import {
  analyzeDocument,
  type AnalyzeDocumentResponse,
  type StructuredPolicyExtraction,
} from '@/lib/api'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const POLICY_TYPE_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'medical', label: 'Medical / Health' },
  { value: 'life', label: 'Life' },
  { value: 'motor', label: 'Motor / Auto' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
]

function parseExtractionResult(
  result: AnalyzeDocumentResponse | null
): StructuredPolicyExtraction | null {
  if (!result?.response) return null
  if (typeof result.response === 'object') {
    return result.response
  }
  try {
    const jsonMatch = result.response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as StructuredPolicyExtraction
    }
  } catch {
    return null
  }
  return null
}

function confidenceClass(score: number) {
  if (score >= 0.75) return 'bg-primary/10 text-primary border-primary/20'
  if (score >= 0.5) return 'bg-muted text-foreground border-border'
  return 'bg-background text-muted-foreground border-border'
}

function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

function ClauseResults({ data }: { data: StructuredPolicyExtraction }) {
  const foundClauses = (data.clauses || []).filter((c) => c.found)
  const missingClauses = (data.clauses || []).filter((c) => !c.found)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Policy Type</p>
          <p className="font-medium capitalize">{data.detected_policy_type || data.insurance_type || '—'}</p>
          {typeof data.policy_type_confidence === 'number' && (
            <Tag className={confidenceClass(data.policy_type_confidence)}>
              {Math.round(data.policy_type_confidence * 100)}% confidence
            </Tag>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Provider</p>
          <p className="font-medium">{data.insurance_provider || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Policy Number</p>
          <p className="font-medium">{data.policy_number || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Expiry / Cost</p>
          <p className="font-medium">{data.expiry_date || '—'}</p>
          <p className="text-muted-foreground text-xs">{data.cost || ''}</p>
        </div>
      </div>

      {foundClauses.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Extracted Clauses ({foundClauses.length})
          </h4>
          <div className="space-y-3">
            {foundClauses.map((clause, index) => (
              <div key={`${clause.clause_type}-${index}`} className="border rounded-lg p-4 bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-medium">{clause.clause_type}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {clause.page_number != null && (
                      <Tag>Page {clause.page_number}</Tag>
                    )}
                    {typeof clause.confidence === 'number' && (
                      <Tag className={confidenceClass(clause.confidence)}>
                        {Math.round(clause.confidence * 100)}%
                      </Tag>
                    )}
                  </div>
                </div>
                {clause.value && (
                  <p className="text-sm mb-2">{clause.value}</p>
                )}
                {clause.excerpt && clause.excerpt !== clause.value && (
                  <p className="text-xs text-muted-foreground italic border-l-2 pl-3">
                    &ldquo;{clause.excerpt}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {missingClauses.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-4 w-4" />
            Not Found in Document ({missingClauses.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {missingClauses.map((clause, index) => (
              <Tag key={`${clause.clause_type}-missing-${index}`}>
                {clause.clause_type}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(data.coverage_benefits) && data.coverage_benefits.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Coverage Benefits</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {data.coverage_benefits.map((benefit, index) => (
              <li key={index}>{benefit}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(data.important_details) && data.important_details.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Important Details</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {data.important_details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function PoliciesPage() {
  const [analyzing, setAnalyzing] = useState(false)
  const [policyTypeHint, setPolicyTypeHint] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalyzeDocumentResponse | null>(null)
  const [ragStatus, setRagStatus] = useState<{ indexed: boolean; chunks: number; error?: string | null } | null>(null)

  useEffect(() => {
    try {
      const cached = localStorage.getItem("policy_analysis_result")
      if (cached) {
        setAnalysisResult(JSON.parse(cached))
      }
    } catch (error) {
      console.error("Failed to load cached policy analysis:", error)
    }
  }, [])

  useEffect(() => {
    try {
      if (analysisResult) {
        localStorage.setItem("policy_analysis_result", JSON.stringify(analysisResult))
      }
    } catch (error) {
      console.error("Failed to cache policy analysis:", error)
    }
  }, [analysisResult])

  const runAnalysis = async (file: File) => {
    setAnalyzing(true)
    try {
      const result = await analyzeDocument(file, {
        policyType: policyTypeHint || undefined,
      })
      setAnalysisResult(result)
      setRagStatus({
        indexed: Boolean(result.rag_indexed),
        chunks: result.rag_chunks ?? 0,
        error: result.rag_error,
      })
      const parsed = parseExtractionResult(result)
      const clauseCount = parsed?.clauses?.filter((c) => c.found).length ?? 0
      const ragNote = result.rag_indexed
        ? ` Indexed ${result.rag_chunks ?? 0} chunks for Emergency RAG.`
        : ' RAG indexing did not complete — check backend logs.'
      toast.success('Clause Extraction Complete', {
        description: parsed
          ? `Detected ${parsed.detected_policy_type} policy with ${clauseCount} clauses found.${ragNote}`
          : `Your document has been analyzed.${ragNote}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Analysis Failed', { description: message })
    } finally {
      setAnalyzing(false)
    }
  }

  const extracted = parseExtractionResult(analysisResult)

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
              <CardDescription>
                Upload a policy PDF for structured clause extraction — waiting periods, limits,
                exclusions, and more, with page references.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 space-y-2">
                <label className="text-sm font-medium">Policy Type (optional hint)</label>
                <select
                  className="w-full max-w-xs p-2 border rounded-md"
                  value={policyTypeHint}
                  onChange={(e) => setPolicyTypeHint(e.target.value)}
                  disabled={analyzing}
                >
                  {POLICY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Helps Gemini prioritize clause types. Leave on Auto-detect if unsure.
                </p>
              </div>

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
                    await runAnalysis(files[0])
                  }
                }}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium">
                  {analyzing ? 'Extracting clauses…' : 'Drag and drop your policy PDF here'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">Or</p>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  id="file-upload"
                  onChange={async (e) => {
                    const files = e.target.files
                    if (files && files.length > 0) {
                      await runAnalysis(files[0])
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
                  <FileText className="h-4 w-4" />
                  <AlertTitle>Structured Clause Analysis</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2">
                      {extracted ? (
                        <ClauseResults data={extracted} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">
                          {typeof analysisResult.response === 'string'
                            ? analysisResult.response
                            : JSON.stringify(analysisResult.response, null, 2)}
                        </p>
                      )}
                      {analysisResult.extraction_meta && (
                        <p className="text-xs text-muted-foreground mt-4">
                          Read {analysisResult.extraction_meta.pages_read} of{' '}
                          {analysisResult.extraction_meta.page_count} pages
                          {analysisResult.extraction_meta.truncated ? ' (truncated for token limit)' : ''}.
                        </p>
                      )}
                      {ragStatus && (
                        <p className={`text-xs mt-2 ${ragStatus.indexed ? 'text-green-700' : 'text-amber-700'}`}>
                          {ragStatus.indexed
                            ? `Linked to Emergency RAG: ${ragStatus.chunks} searchable chunk(s) indexed. Use Claims → AI Automation to query.`
                            : `Not linked to Emergency RAG${ragStatus.error ? `: ${ragStatus.error}` : '.'}`}
                        </p>
                      )}
                    </div>
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

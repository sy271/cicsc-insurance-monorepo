"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

function extractDuplicatePolicyAnalysisText(
  data: Record<string, unknown> | null
): string {
  if (!data) return "";
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  const output = data.output;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const text = (block as { text?: unknown }).text;
        if (typeof text === "string") chunks.push(text);
      }
    }
    if (chunks.length) return chunks.join("\n\n");
    const legacy = output[1] as { content?: { text?: string }[] } | undefined;
    const legacyText = legacy?.content?.[0]?.text;
    if (typeof legacyText === "string") return legacyText;
  }
  return "";
}

async function fetchDuplicatePolicyAnalysis(): Promise<{
  payload: Record<string, unknown> | null;
  error: string | null;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/duplicate-policies/`,
      { headers: { Accept: "application/json" } }
    );
    const raw = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok) {
      const msg =
        (raw && typeof raw.error === "string" && raw.error) ||
        `Request failed (${response.status})`;
      return { payload: null, error: msg };
    }
    if (raw && typeof raw.error === "string") {
      return { payload: null, error: raw.error };
    }
    return { payload: raw, error: null };
  } catch (e) {
    console.error("Error fetching analysis data:", e);
    return {
      payload: null,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

function LoadingState() {
  return (
    <div className="container mx-auto p-6">
      <div className="h-12 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-6" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Duplicate Coverage Loading */}
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-16 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Coverage Gaps Loading */}
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-20 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-20 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Data Analysis Loading */}
      <Card className="mb-6">
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-4/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* Premium Optimization Loading */}
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="text-right">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mx-auto" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mx-auto mt-1" />
              </div>
            </div>
            <div className="h-16 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalysisPage() {
  const [analysisPayload, setAnalysisPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { payload, error: err } = await fetchDuplicatePolicyAnalysis();
      setAnalysisPayload(payload);
      setError(err);
      setIsLoading(false);
    };
    run();
  }, []);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !analysisPayload) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Failed to load analysis data. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const analysisText = extractDuplicatePolicyAnalysisText(analysisPayload);

  // Format tables to ensure proper markdown rendering
  const formattedText = analysisText
    .replace(
      /\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/g,
      (match: string, p1: string, p2: string, p3: string, p4: string) => {
        // Ensure each cell has proper spacing
        return `| ${p1.trim()} | ${p2.trim()} | ${p3.trim()} | ${p4.trim()} |`;
      }
    )
    .replace(/\n\s*\n/g, "\n\n"); // Ensure proper spacing between sections

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">AI Policy Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Static Duplicate Coverage Section */}
        <Card>
          <CardHeader>
            <CardTitle>Duplicate Coverage Analysis</CardTitle>
            <CardDescription>AI-detected potential overlaps in your policies</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential Duplicate Found</AlertTitle>
              <AlertDescription>
                Your AIA medical insurance and company health benefits have overlapping coverage for outpatient treatment.
              </AlertDescription>
            </Alert>

            <Alert variant="default" className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Recommendation</AlertTitle>
              <AlertDescription>
                Consider optimizing your personal medical insurance to complement rather than duplicate your company benefits.
              </AlertDescription>
            </Alert>

            <Button variant="outline" className="w-full">View Detailed Analysis</Button>
          </CardContent>
        </Card>

        {/* Static Coverage Gaps Section */}
        <Card>
          <CardHeader>
            <CardTitle>Coverage Gaps</CardTitle>
            <CardDescription>Areas where you might need additional coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <h3 className="font-medium">Critical Illness Coverage</h3>
                </div>
                <p className="text-sm text-gray-600">Your current policies have limited critical illness coverage.</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-medium">Disability Income</h3>
                </div>
                <p className="text-sm text-gray-600">Consider adding disability income protection to your portfolio.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New API Data Analysis Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Detailed Policy Analysis</CardTitle>
          <CardDescription>Comprehensive breakdown from AI assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert prose-table:border-collapse prose-td:border prose-td:p-2 prose-th:border prose-th:p-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800">
            {formattedText.trim() ? (
              <ReactMarkdown>{formattedText}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground text-sm">
                No analysis narrative was returned. Confirm the backend OpenAI
                key and vector store configuration for duplicate policy checks.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Static Premium Optimization Section */}
      <Card>
        <CardHeader>
          <CardTitle>Premium Optimization</CardTitle>
          <CardDescription>Cost-benefit analysis and suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <h3 className="font-medium mb-2">Current Monthly Premium</h3>
                <div className="h-4 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-3/4"></div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">RM 2,450</span>
                <p className="text-sm text-gray-500">per month</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <h3 className="font-medium mb-2">Optimized Premium</h3>
                <div className="h-4 bg-green-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-1/2"></div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">RM 1,850</span>
                <p className="text-sm text-gray-500">potential</p>
              </div>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Potential Savings</AlertTitle>
              <AlertDescription>
                You could save up to RM 600 monthly by optimizing your policy portfolio while maintaining similar coverage levels.
              </AlertDescription>
            </Alert>

            <Button className="w-full">Get Detailed Optimization Plan</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
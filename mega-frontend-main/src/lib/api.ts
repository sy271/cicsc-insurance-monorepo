import { PersonalDetails } from './types';

/** Django API origin (no trailing slash). Override with NEXT_PUBLIC_API_URL. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

async function readFetchError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as {
      error?: string;
      detail?: string;
      code?: string;
      retry_after_sec?: number;
    };
    let message = data.error || data.detail || text || `Server error: ${response.status}`;
    if (response.status === 429 && data.code === 'gemini_quota_exceeded') {
      const retry =
        typeof data.retry_after_sec === 'number'
          ? ` Retry in ~${Math.ceil(data.retry_after_sec)}s.`
          : '';
      message = `${message}${retry}`;
    }
    return message;
  } catch {
    return text || `Server error: ${response.status}`;
  }
}

export interface PolicyVersion {
  version_id: string;
  effective_date: string;
  changes: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
  reason_for_change?: string;
}

export interface PolicyRecommendation {
  type: 'duplicate' | 'addon';
  policies: string[];
  reason: string;
  potentialSavings?: number;
  suggestedAction: string;
  priority: 'high' | 'medium' | 'low';
}

export async function analyzePolicies(insurances: any[]) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-policies/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ insurances }),
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return await response.json() as PolicyRecommendation[];
  } catch (error) {
    console.error('Error analyzing policies:', error);
    throw error;
  }
}

export interface ExtractedClause {
  clause_type: string;
  found: boolean;
  value: string | null;
  excerpt: string | null;
  page_number: number | null;
  char_start: number | null;
  char_end: number | null;
  confidence: number;
}

export interface StructuredPolicyExtraction {
  insurance_type: string | null;
  insurance_provider: string | null;
  policy_number: string | null;
  expiry_date: string | null;
  cost: string | null;
  coverage_benefits: string[];
  important_details: string[];
  detected_policy_type: 'medical' | 'life' | 'motor' | 'travel' | 'other';
  policy_type_confidence: number;
  clauses: ExtractedClause[];
}

export interface PolicyExtractionMeta {
  pages_read: number;
  page_count: number;
  truncated: boolean;
  policy_type_hint: string | null;
}

export interface AnalyzeDocumentResponse {
  response: StructuredPolicyExtraction | string;
  raw_response?: string;
  extraction_meta?: PolicyExtractionMeta;
  rag_indexed?: boolean;
  rag_chunks?: number;
  rag_error?: string | null;
}

export async function analyzeDocument(
  file: File,
  options?: { policyType?: string }
) {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.policyType) {
    formData.append('policy_type', options.policyType);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/openai-file/`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return (await response.json()) as AnalyzeDocumentResponse;
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  message_id?: string;
}

interface ChatResponse {
  response: string;
  session_id: string;
  thread_id: string;
  history: ChatMessage[];
}

export async function chatWithAI(message: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/openai-chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    const data = await response.json() as ChatResponse;
    // Return the last message from history which should be the assistant's response
    const lastMessage = data.history[data.history.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // Remove markdown formatting
      return {
        ...lastMessage,
        content: lastMessage.content.replace(/\*\*/g, '')
      };
    }
    throw new Error('Invalid response format from server');
  } catch (error) {
    console.error('Error chatting with AI:', error);
    throw error;
  }
}

export async function getPolicyVersionHistory(policyId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/policies/${policyId}/versions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return await response.json() as PolicyVersion[];
  } catch (error) {
    console.error('Error fetching policy versions:', error);
    throw error;
  }
}

export interface InsuranceCategoryStats {
  category: string;
  count: number;
  totalPremium: number;
  avgCoverage: number;
}

export async function getInsuranceCategoryStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/insurance/category-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return await response.json() as InsuranceCategoryStats[];
  } catch (error) {
    console.error('Error fetching insurance category stats:', error);
    throw error;
  }
}

export async function getPersonalDetails() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/personal-details`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching personal details:', error);
    throw error;
  }
}

export async function updatePersonalDetails(details: PersonalDetails) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/personal-details`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(details),
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating personal details:', error);
    throw error;
  }
}

/**
 * Upload policy documents for OpenAI extraction. Django expects multipart field name `file`
 * (one file per request); multiple files are uploaded sequentially and combined.
 */
function formatExtractionForChat(data: StructuredPolicyExtraction): string {
  const lines = [
    `Policy type: ${data.detected_policy_type || data.insurance_type || 'unknown'}`,
    `Provider: ${data.insurance_provider || '—'}`,
    `Policy number: ${data.policy_number || '—'}`,
    '',
    'Extracted clauses:',
  ]
  for (const clause of data.clauses || []) {
    if (!clause.found) continue
    const page = clause.page_number != null ? ` (p.${clause.page_number})` : ''
    lines.push(`• ${clause.clause_type}${page}: ${clause.value || clause.excerpt || '—'}`)
  }
  return lines.join('\n')
}

export async function analyzeWithAI(
  files: File[],
  options?: { policyType?: string }
): Promise<{ response: string }> {
  if (!files.length) {
    throw new Error('No files selected');
  }

  const merged: StructuredPolicyExtraction[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = await analyzeDocument(file, options);
      const payload = data.response;
      if (typeof payload === 'object' && payload !== null) {
        merged.push(payload);
      }
    }

    if (merged.length === 1) {
      return { response: formatExtractionForChat(merged[0]) }
    }

    return {
      response: merged.map((m, i) => `## Document ${i + 1}\n${formatExtractionForChat(m)}`).join('\n\n'),
    }
  } catch (error) {
    console.error('Error analyzing files with AI:', error);
    throw error;
  }
}

export interface EmergencyRagSource {
  filename: string;
  policy_owner: string;
  chunk_type?: string;
}

export interface EmergencyRagResponse {
  response: string;
  sources: EmergencyRagSource[];
}

export async function emergencyRagChat(message: string, policyOwner?: string): Promise<EmergencyRagResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emergency-rag-chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, policy_owner: policyOwner || "" }),
    });

    if (!response.ok) {
      throw new Error(await readFetchError(response));
    }

    return (await response.json()) as EmergencyRagResponse;
  } catch (error) {
    console.error("Error in emergency RAG chat:", error);
    throw error;
  }
}

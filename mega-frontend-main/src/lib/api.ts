import { PersonalDetails } from './types';

/** Django API origin (no trailing slash). Override with NEXT_PUBLIC_API_URL. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

async function readFetchError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { error?: string; detail?: string };
    return data.error || data.detail || text || `Server error: ${response.status}`;
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

export async function analyzeDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);

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

    return await response.json();
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
export async function analyzeWithAI(files: File[]): Promise<{ response: string }> {
  if (!files.length) {
    throw new Error('No files selected');
  }

  const parts: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

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

      const data = (await response.json()) as { response?: string };
      const text =
        typeof data.response === 'string'
          ? data.response
          : JSON.stringify(data);
      parts.push(files.length > 1 ? `## ${file.name}\n\n${text}` : text);
    }

    return { response: parts.join('\n\n') };
  } catch (error) {
    console.error('Error analyzing files with AI:', error);
    throw error;
  }
}

export interface EmergencyRagSource {
  filename: string;
  policy_owner: string;
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

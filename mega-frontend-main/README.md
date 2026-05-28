This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API Documentation

All API endpoints are available at `http://localhost:8000` by default or configured via `NEXT_PUBLIC_API_URL` environment variable.

### Policy Analysis

#### `POST /api/analyze-policies/`
- Input: `{ insurances: any[] }`
- Returns: `PolicyRecommendation[]`
  ```typescript
  interface PolicyRecommendation {
    type: 'duplicate' | 'addon';
    policies: string[];
    reason: string;
    potentialSavings?: number;
    suggestedAction: string;
    priority: 'high' | 'medium' | 'low';
  }
  ```

#### `POST /api/analyze-doc/`
- Input: `FormData` with file field
- Returns: Document analysis results

### Chat & AI

#### `POST /api/openai-chat/`
- Input: `{ message: string }`
- Returns: `ChatResponse`
  ```typescript
  interface ChatResponse {
    response: string;
    session_id: string;
    thread_id: string;
    history: ChatMessage[];
  }
  ```

#### `POST /api/openai-file/`
- Input: `FormData` with multiple files
- Returns: AI analysis results

### Policy Management

#### `GET /api/policies/{policyId}/versions`
- Returns: `PolicyVersion[]`
  ```typescript
  interface PolicyVersion {
    version_id: string;
    effective_date: string;
    changes: {
      field: string;
      old_value: any;
      new_value: any;
    }[];
    reason_for_change?: string;
  }
  ```

### Insurance Statistics

#### `GET /api/insurance/category-stats`
- Returns: `InsuranceCategoryStats[]`
  ```typescript
  interface InsuranceCategoryStats {
    category: string;
    count: number;
    totalPremium: number;
    avgCoverage: number;
  }
  ```

### Personal Details

#### `GET /api/personal-details`
- Returns: `PersonalDetails`

#### `PUT /api/personal-details`
- Input: `PersonalDetails`
  ```typescript
  interface PersonalDetails {
    income: number;
    familyMembers: {
      name: string;
      relationship: string;
      age: number;
    }[];
    medicalRecord: {
      condition: string;
      diagnosisDate: string;
      medications: string[];
    }[];
    address: string;
    phoneNumber: string;
    email: string;
    occupation: string;
  }
  ```
- Returns: Updated `PersonalDetails`

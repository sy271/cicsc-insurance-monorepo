'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclamationTriangleIcon, CheckCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { analyzePolicies, PolicyRecommendation } from '@/lib/api';
import { InsurancePieChart } from '@/components/insurance-pie-chart';

interface Insurance {
  id: string;
  category: string;
  type: string;
  name: string;
  coverage: number;
  premium: number;
  status: 'overlap' | 'adequate' | 'insufficient';
  expiry: string;
}

interface InsuranceGap {
  type: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export default function InsurancePage() {
  const [insurances, setInsurances] = useState<Insurance[]>([
    {
      id: '1',
      category: 'Life & Health',
      type: 'Life',
      name: 'Term Life Insurance',
      coverage: 500000,
      premium: 1200,
      status: 'adequate',
      expiry: '2025-12-31'
    },
    {
      id: '2',
      category: 'Life & Health',
      type: 'Health',
      name: 'Medical Insurance',
      coverage: 100000,
      premium: 2400,
      status: 'overlap',
      expiry: '2025-06-30'
    },
    {
      id: '3',
      category: 'Life & Health',
      type: 'Critical Illness',
      name: 'Critical Illness Cover',
      coverage: 200000,
      premium: 1800,
      status: 'adequate',
      expiry: '2025-08-31'
    },
    {
      id: '4',
      category: 'Property & Assets',
      type: 'Auto',
      name: 'Car Insurance',
      coverage: 50000,
      premium: 800,
      status: 'insufficient',
      expiry: '2025-09-30'
    },
    {
      id: '5',
      category: 'Property & Assets',
      type: 'Home',
      name: 'Home Insurance',
      coverage: 300000,
      premium: 600,
      status: 'adequate',
      expiry: '2025-11-30'
    },
    {
      id: '6',
      category: 'Income Protection',
      type: 'Disability',
      name: 'Long-term Disability',
      coverage: 150000,
      premium: 900,
      status: 'insufficient',
      expiry: '2025-10-31'
    }
  ]);

  const [recommendations, setRecommendations] = useState<PolicyRecommendation[]>([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const data = await analyzePolicies(insurances);
        setRecommendations(data);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      }
    };

    fetchRecommendations();
  }, [insurances]);

  const [gaps, setGaps] = useState<InsuranceGap[]>([
    {
      type: 'Disability Insurance',
      reason: 'No income protection in case of long-term disability',
      priority: 'high'
    },
    {
      type: 'Critical Illness',
      reason: 'Limited coverage for serious illnesses',
      priority: 'medium'
    }
  ]);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Insurance Category Overview */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Insurance Category Overview</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <InsurancePieChart />
        </div>
      </div>
      {/* Policy Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-8 space-y-4">
          <h2 className="text-2xl font-bold">Policy Recommendations</h2>
          {recommendations.map((rec, index) => (
            <Alert
              key={index}
              className={`${rec.type === 'duplicate' ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'}`}
            >
              <InfoCircledIcon className={`h-5 w-5 ${rec.type === 'duplicate' ? 'text-orange-600' : 'text-blue-600'}`} />
              <AlertTitle className={`${rec.type === 'duplicate' ? 'text-orange-800' : 'text-blue-800'}`}>
                {rec.type === 'duplicate' ? 'Potential Overlap Detected' : 'Recommended Add-on'}
              </AlertTitle>
              <AlertDescription className="mt-2">
                <div className={`${rec.type === 'duplicate' ? 'text-orange-800' : 'text-blue-800'}`}>
                  <p className="font-medium">{rec.reason}</p>
                  <p className="mt-1">Affected Policies: {rec.policies.join(', ')}</p>
                  {rec.potentialSavings && (
                    <p className="mt-1">Potential Savings: ${rec.potentialSavings.toLocaleString()}/year</p>
                  )}
                  <p className="mt-2 font-medium">Suggested Action: {rec.suggestedAction}</p>
                  <p className="mt-1 text-sm">
                    Priority: <span className="font-medium">{rec.priority.toUpperCase()}</span>
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Insurance Gaps Alert */}
      {gaps.length > 0 && (
        <Alert className="mb-8 border-yellow-500 bg-yellow-50">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Insurance Coverage Gaps Detected</AlertTitle>
          <AlertDescription className="mt-2">
            <ul className="list-disc pl-5 space-y-1">
              {gaps.map((gap, index) => (
                <li key={index} className="text-yellow-800">
                  <span className="font-medium">{gap.type}:</span> {gap.reason}
                  {gap.priority === 'high' && (
                    <span className="ml-2 text-red-600 text-sm">(High Priority)</span>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Insurance Overview */}
      {Array.from(new Set(insurances.map(i => i.category))).map(category => (
        <Card key={category} className="mb-8">
          <CardHeader>
            <CardTitle>{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Premium/Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insurances
                  .filter(insurance => insurance.category === category)
                  .map((insurance) => (
                    <TableRow key={insurance.id}>
                      <TableCell className="font-medium">{insurance.type}</TableCell>
                      <TableCell>{insurance.name}</TableCell>
                      <TableCell>${insurance.coverage.toLocaleString()}</TableCell>
                      <TableCell>${insurance.premium.toLocaleString()}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            insurance.status === 'overlap'
                              ? 'bg-red-100 text-red-700'
                              : insurance.status === 'adequate'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {insurance.status === 'overlap' && (
                            <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                          )}
                          {insurance.status === 'adequate' && (
                            <CheckCircledIcon className="mr-1 h-3 w-3" />
                          )}
                          {insurance.status.charAt(0).toUpperCase() + insurance.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(insurance.expiry).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-green-100 border border-green-700 mr-2"></span>
          <span>Adequate Coverage</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-red-100 border border-red-700 mr-2"></span>
          <span>Overlap in Coverage</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-700 mr-2"></span>
          <span>Insufficient Coverage</span>
        </div>
      </div>
    </div>
  );
}

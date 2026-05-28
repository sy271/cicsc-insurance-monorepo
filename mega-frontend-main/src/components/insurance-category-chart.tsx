import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface InsuranceData {
  category: string;
  count: number;
  totalPremium: number;
  avgCoverage: number;
}

interface InsuranceCategoryChartProps {
  data: InsuranceData[];
}

export function InsuranceCategoryChart({ data }: InsuranceCategoryChartProps) {
  const categories = data.map((item) => item.category);
  const counts = data.map((item) => item.count);
  const premiums = data.map((item) => item.totalPremium);
  const coverages = data.map((item) => item.avgCoverage);

  const pieChartData = {
    labels: categories,
    datasets: [
      {
        data: counts,
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
        ],
        hoverBackgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
        ],
      },
    ],
  };

  const barChartData = {
    labels: categories,
    datasets: [
      {
        label: 'Average Coverage ($)',
        data: coverages,
        backgroundColor: '#36A2EB',
      },
      {
        label: 'Total Premium ($)',
        data: premiums,
        backgroundColor: '#FF6384',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Coverage and Premium by Category',
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        beginAtZero: true,
        ticks: {
          callback: function(value: number | string) {
            if (typeof value === 'number') {
              return `$${value.toLocaleString()}`;
            }
            return value;
          },
        },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Insurance Distribution by Category',
      },
    },
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-white rounded-lg shadow">
          <Pie data={pieChartData} options={pieOptions} />
        </div>
        <div className="p-6 bg-white rounded-lg shadow">
          <Bar data={barChartData} options={barOptions} />
        </div>
      </div>
      
      {/* Summary Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Premium</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.category}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${item.totalPremium.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${item.avgCoverage.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Dummy data
const insuranceData = {
  labels: ['Life & Health', 'Property & Assets', 'Income Protection', 'Travel', 'Business'],
  datasets: [
    {
      data: [45, 25, 15, 10, 5], // Percentages
      backgroundColor: [
        '#FF6384', // Pink
        '#36A2EB', // Blue
        '#FFCE56', // Yellow
        '#4BC0C0', // Teal
        '#9966FF', // Purple
      ],
      hoverBackgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
      ],
    },
  ],
};

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: 'right' as const,
    },
    title: {
      display: true,
      text: 'Insurance Distribution by Category',
      font: {
        size: 16,
      },
    },
  },
};

export function InsurancePieChart() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <Pie data={insuranceData} options={options} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { PolicyVersion, getPolicyVersionHistory } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface PolicyVersionHistoryProps {
  policyId: string;
}

export function PolicyVersionHistory({ policyId }: PolicyVersionHistoryProps) {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const versionHistory = await getPolicyVersionHistory(policyId);
        setVersions(versionHistory);
      } catch (err) {
        setError("Failed to load policy version history");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [policyId]);

  if (loading) {
    return <div>Loading version history...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Policy Version History</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Effective Date</TableHead>
            <TableHead>Changes</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.version_id}>
              <TableCell>{version.version_id}</TableCell>
              <TableCell>
                {format(new Date(version.effective_date), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <ul className="list-disc list-inside">
                  {version.changes.map((change, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{change.field}:</span>{" "}
                      {typeof change.old_value === "object"
                        ? "Complex value changed"
                        : `${change.old_value} → ${change.new_value}`}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>{version.reason_for_change || "N/A"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { getPersonalDetails, updatePersonalDetails } from "@/lib/api";
import { PersonalDetails } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus } from "lucide-react";

export default function PersonalDetailsPage() {
  const [details, setDetails] = useState<PersonalDetails>({
    income: 0,
    familyMembers: [],
    medicalRecord: [],
    address: "",
    phoneNumber: "",
    email: "",
    occupation: "",
    emergencyContact: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPersonalDetails();
  }, []);

  const loadPersonalDetails = async () => {
    try {
      const data = await getPersonalDetails();
      setDetails(data);
    } catch (error) {
      console.error("Error loading personal details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePersonalDetails(details);
    } catch (error) {
      console.error("Error saving personal details:", error);
    } finally {
      setSaving(false);
    }
  };

  const addFamilyMember = () => {
    setDetails({
      ...details,
      familyMembers: [
        ...details.familyMembers,
        { name: "", relationship: "", age: 0 },
      ],
    });
  };

  const removeFamilyMember = (index: number) => {
    setDetails({
      ...details,
      familyMembers: details.familyMembers.filter((_, i) => i !== index),
    });
  };

  const addMedicalRecord = () => {
    setDetails({
      ...details,
      medicalRecord: [
        ...details.medicalRecord,
        { condition: "", diagnosisDate: "", medications: [] },
      ],
    });
  };

  const removeMedicalRecord = (index: number) => {
    setDetails({
      ...details,
      medicalRecord: details.medicalRecord.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Personal Details</h1>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="income">Annual Income</Label>
              <Input
                id="income"
                type="number"
                value={details.income}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDetails({ ...details, income: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                value={details.occupation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDetails({ ...details, occupation: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={details.address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDetails({ ...details, address: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={details.phoneNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDetails({ ...details, phoneNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={details.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDetails({ ...details, email: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency Contact</Label>
            <Input
              id="emergencyContact"
              value={details.emergencyContact}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDetails({ ...details, emergencyContact: e.target.value })
              }
              placeholder="Name and phone number of emergency contact"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Family Members</CardTitle>
          <Button onClick={addFamilyMember} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Member
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {details.familyMembers.map((member, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={member.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDetails({
                      ...details,
                      familyMembers: details.familyMembers.map((m, i) =>
                        i === index ? { ...m, name: e.target.value } : m
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Input
                  value={member.relationship}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDetails({
                      ...details,
                      familyMembers: details.familyMembers.map((m, i) =>
                        i === index ? { ...m, relationship: e.target.value } : m
                      ),
                    })
                  }
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Age</Label>
                  <Input
                    type="number"
                    value={member.age}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDetails({
                        ...details,
                        familyMembers: details.familyMembers.map((m, i) =>
                          i === index
                            ? { ...m, age: Number(e.target.value) }
                            : m
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="self-end"
                  onClick={() => removeFamilyMember(index)}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Medical Records</CardTitle>
          <Button onClick={addMedicalRecord} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Record
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {details.medicalRecord.map((record, index) => (
            <div
              key={index}
              className="space-y-4 p-4 border rounded-lg relative"
            >
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => removeMedicalRecord(index)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Input
                    value={record.condition}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDetails({
                        ...details,
                        medicalRecord: details.medicalRecord.map((r, i) =>
                          i === index ? { ...r, condition: e.target.value } : r
                        ),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Diagnosis Date</Label>
                  <Input
                    type="date"
                    value={record.diagnosisDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDetails({
                        ...details,
                        medicalRecord: details.medicalRecord.map((r, i) =>
                          i === index
                            ? { ...r, diagnosisDate: e.target.value }
                            : r
                        ),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Medications (comma-separated)</Label>
                <Input
                  value={record.medications.join(", ")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDetails({
                      ...details,
                      medicalRecord: details.medicalRecord.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              medications: e.target.value
                                .split(",")
                                .map((m) => m.trim()),
                            }
                          : r
                      ),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Details"}
        </Button>
      </div>
    </div>
  );
}

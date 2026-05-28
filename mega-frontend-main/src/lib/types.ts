export interface PersonalDetails {
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
  emergencyContact: string;
}

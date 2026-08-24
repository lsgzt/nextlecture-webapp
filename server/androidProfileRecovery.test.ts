import { describe, expect, it } from "vitest";
import { recoverAndroidRegistrationNumber, resetAndroidStudentDirectoryForTests } from "./androidProfileRecovery";

const directory = [
  { crn: "2621101", registrationNumber: "202600101", candidateName: "Lovepreet Singh", branch: "IT", subsection: "ITB2" },
  { crn: "2621102", registrationNumber: "202600102", candidateName: "Another Student", branch: "IT", subsection: "ITB1" },
];

describe("Android attendance profile recovery", () => {
  it("returns only the exact Android registration number for the saved web profile", async () => {
    resetAndroidStudentDirectoryForTests();
    const fetcher = async () => new Response(JSON.stringify(directory), { status: 200 });
    await expect(recoverAndroidRegistrationNumber({ crn: "2621101", branch: "it", studentName: "LOVEPREET  SINGH", subsection: "itb2" }, fetcher)).resolves.toEqual({ registrationNumber: "202600101" });
  });

  it("does not return a registration number when identity fields do not all match", async () => {
    resetAndroidStudentDirectoryForTests();
    const fetcher = async () => new Response(JSON.stringify(directory), { status: 200 });
    await expect(recoverAndroidRegistrationNumber({ crn: "2621101", branch: "IT", studentName: "Lovepreet Singh", subsection: "ITB1" }, fetcher)).resolves.toEqual({ registrationNumber: null });
  });
});

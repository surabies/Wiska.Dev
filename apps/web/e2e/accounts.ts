import type { Role } from "../prisma/index"

export const E2E_ACCOUNTS = [
  { role: "SUPER_ADMIN", username: "e2e-super-admin" },
  { role: "DIREKSI", username: "e2e-direksi" },
  { role: "SENIOR_MANAGER", username: "e2e-senior-manager" },
  { role: "MANAGER", username: "e2e-manager" },
  { role: "SUPERVISOR", username: "e2e-supervisor" },
  { role: "STAFF", username: "e2e-staff" },
  { role: "PELAKSANA", username: "e2e-pelaksana" },
  { role: "USER", username: "e2e-user" },
] as const satisfies readonly { role: Role; username: string }[]

export const E2E_PASSWORD_ENV = "E2E_TEST_PASSWORD"

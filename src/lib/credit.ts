export type CreditStatus = "open" | "partial" | "completed";

export interface CreditSummaryInput {
  amountDue?: number | string;
  paidAmount?: number | string;
  customerName?: string;
  dueDate?: string;
}

export interface CreditSummary {
  totalOutstanding: number;
  activeCustomers: number;
  dueTodayCount: number;
  overdueCount: number;
  paidCount: number;
}

export interface EmployeeLink {
  manager_user_id: string;
  employee_user_id: string;
}

export function getVisibleCreditUserIds(
  currentUserId: string,
  role: string | null,
  employeeLinks: EmployeeLink[] = []
): string[] | null {
  if (role === "admin") return null;

  if (role === "manager") {
    const visible = new Set<string>([currentUserId]);
    employeeLinks
      .filter((link) => link.manager_user_id === currentUserId)
      .forEach((link) => visible.add(link.employee_user_id));
    return Array.from(visible);
  }

  return [currentUserId];
}

export function getCreditStatus(
  amountDue: number | string = 0,
  paidAmount: number | string = 0
): CreditStatus {
  const totalDue = Number(amountDue || 0);
  const totalPaid = Number(paidAmount || 0);

  if (totalPaid >= totalDue && totalDue > 0) return "completed";
  if (totalPaid > 0 && totalPaid < totalDue) return "partial";
  return "open";
}

export function summarizeCustomerCredits(
  credits: CreditSummaryInput[] = []
): CreditSummary {
  const today = new Date().toISOString().slice(0, 10);

  const outstandingCredits = credits.filter(
    (credit) => Number(credit.amountDue || 0) > Number(credit.paidAmount || 0)
  );

  const totalOutstanding = outstandingCredits.reduce(
    (sum, credit) => sum + (Number(credit.amountDue || 0) - Number(credit.paidAmount || 0)),
    0
  );

  const activeCustomers = outstandingCredits.length;

  const dueTodayCount = outstandingCredits.filter((credit) => {
    const dueDate = credit.dueDate || today;
    return dueDate === today;
  }).length;

  const overdueCount = outstandingCredits.filter((credit) => {
    if (!credit.dueDate) return false;
    return credit.dueDate < today;
  }).length;

  const paidCount = credits.filter(
    (credit) => Number(credit.amountDue || 0) <= Number(credit.paidAmount || 0)
  ).length;

  return {
    totalOutstanding,
    activeCustomers,
    dueTodayCount,
    overdueCount,
    paidCount,
  };
}

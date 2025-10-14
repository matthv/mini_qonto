import { mountAgentClient } from "../agent-setup";

export const INCOME_COLLECTION = "Api__Income";
export const BANK_ACCOUNT_COLLECTION = "Api__BankAccount";
export const ORGANIZATION_COLLECTION = "Api__Organization";

export type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;

export const clearCollections = async (clientAgent: AgentClient) => {
  const incomes = clientAgent.collection(INCOME_COLLECTION);
  const bankAccounts = clientAgent.collection(BANK_ACCOUNT_COLLECTION);
  const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

  const allIncomes = await incomes.list();
  if (allIncomes.length > 0) {
    await incomes.delete(allIncomes.map((income) => String(income.id)));
  }
  const allBankAccounts = await bankAccounts.list();
  if (allBankAccounts.length > 0) {
    await bankAccounts.delete(
      allBankAccounts.map((bank) => String(bank.id))
    );
  }
  const allOrganizations = await organizations.list();
  if (allOrganizations.length > 0) {
    await organizations.delete(
      allOrganizations.map((org) => String(org.id))
    );
  }
}
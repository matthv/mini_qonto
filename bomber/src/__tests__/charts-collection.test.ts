import { mountAgentClient } from "../agent-setup";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type ChartContext = { recordId: number };

const BANK_ACCOUNT_COLLECTION = "Api__BankAccount";
const CHART_CONTEXT: ChartContext = { recordId: 1 };

describe("collection charts", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const bankAccounts = () => clientAgent.collection(BANK_ACCOUNT_COLLECTION);

  it("loads collection value chart", async () => {
    const chart = await bankAccounts().valueChart(
      "bank-accounts-total-incomes",
      CHART_CONTEXT
    );

    expect(chart).toEqual({ countCurrent: 4250, countPrevious: null });
  });

  it("fails to load the collection failing chart", async () => {
    let error = new Error();
    try {
      await bankAccounts().valueChart("failing-incomes-chart", CHART_CONTEXT);
    } catch (e) {
      error = e as Error;
    }
    expect(JSON.parse(error.message)).toEqual({
      body: {
        record_id: 1,
      },
      error: {
        status: 500,
        text: '{"errors":[{"name":"StandardError","detail":"Unexpected error","status":500}]}',
        method: "POST",
        path: "/forest/_charts/Api__BankAccount/failing-incomes-chart?timezone=Europe%2FParis"
      }
    });
  });

  it("loads collection objective chart", async () => {
    const chart = await bankAccounts().objectiveChart(
      "total-incomes-vs-objective",
      CHART_CONTEXT
    );

    expect(chart).toEqual({ value: 45_000, objective: 10_000 });
  });

  it("loads collection percentage chart", async () => {
    const chart = await bankAccounts().percentageChart(
      "total-incomes-progression",
      CHART_CONTEXT
    );

    expect(chart).toBe(44);
  });

  it("loads collection distribution chart", async () => {
    const chart = await bankAccounts().distributionChart(
      "income-distribution",
      CHART_CONTEXT
    );

    expect(chart).toEqual([
      { key: "Subscriptions", value: 48 },
      { key: "One-off sales", value: 32 },
      { key: "Affiliate", value: 15 },
      { key: "Other", value: 5 },
    ]);
  });

  it("loads collection leaderboard chart", async () => {
    const chart = await bankAccounts().leaderboardChart(
      "income-leaderboard",
      CHART_CONTEXT
    );

    expect(chart).toEqual([
      { key: "Enterprise plan", value: 180 },
      { key: "Business plan", value: 120 },
      { key: "Starter plan", value: 80 },
      { key: "Add-ons", value: 45 },
    ]);
  });

  it("loads collection yearly time-based chart", async () => {
    const chart = await bankAccounts().timeBasedChart(
      "yearly-incomes-trend",
      CHART_CONTEXT
    );

    expect(chart).toEqual([
      { label: "2021", values: { value: 120_000 } },
      { label: "2022", values: { value: 150_000 } },
      { label: "2023", values: { value: 185_000 } },
      { label: "2024", values: { value: 210_000 } },
    ]);
  });

  it("loads collection monthly time-based chart", async () => {
    const chart = await bankAccounts().timeBasedChart(
      "monthly-incomes-trend",
      CHART_CONTEXT
    );

    expect(chart).toEqual([
      { label: "Jan 24", values: { value: 16_500 } },
      { label: "Feb 24", values: { value: 18_200 } },
      { label: "Mar 24", values: { value: 19_750 } },
      { label: "Apr 24", values: { value: 20_300 } },
    ]);
  });

  it("loads collection weekly time-based chart", async () => {
    const chart = await bankAccounts().timeBasedChart(
      "weekly-incomes-trend",
      CHART_CONTEXT
    );

    expect(chart).toEqual([
      { label: "W14-2024", values: { value: 4_200 } },
      { label: "W15-2024", values: { value: 4_450 } },
      { label: "W16-2024", values: { value: 4_780 } },
      { label: "W17-2024", values: { value: 4_950 } },
    ]);
  });

  it("loads collection daily time-based chart", async () => {
    const chart = await bankAccounts().timeBasedChart(
      "daily-incomes-trend",
      CHART_CONTEXT
    );

    expect(chart).toEqual([
      { label: "22/04/2024", values: { value: 620 } },
      { label: "23/04/2024", values: { value: 680 } },
      { label: "24/04/2024", values: { value: 700 } },
      { label: "25/04/2024", values: { value: 710 } },
    ]);
  });

  it("loads collection multiple time-based chart", async () => {
    const chart = await bankAccounts().timeBasedChart(
      "income-trend-comparison",
      CHART_CONTEXT
    );

    expect(chart).toEqual({
      labels: ["Jan 24", "Feb 24", "Mar 24", "Apr 24"],
      values: [
        { key: "Enterprise plan", values: [120, 135, 150, 170] },
        { key: "Business plan", values: [95, 110, 118, 125] },
        { key: "Starter plan", values: [60, 72, 68, 75] },
      ],
    });
  });
});

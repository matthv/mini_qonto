import { mountAgentClient } from "../agent-setup";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;

describe("charts", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  it("loads value chart", async () => {
    const chart = await clientAgent.valueChart("total-incomes-amount");

    expect(chart).toEqual({ countCurrent: 4250, countPrevious: null });
  });

  it("loads objective chart", async () => {
    const chart = await clientAgent.objectiveChart(
      "total-incomes-vs-objective"
    );

    expect(chart).toEqual({ value: 45000, objective: 10_000 });
  });

  it("loads percentage chart", async () => {
    const chart = await clientAgent.percentageChart(
      "total-incomes-progression"
    );

    expect(chart).toBe(44);
  });

  it("fails to load the failing chart", async () => {
    await expect(
      clientAgent.valueChart("failing-incomes-chart")
    ).rejects.toThrow(/Unexpected chart failure/);
  });

  it("loads distribution chart", async () => {
    const chart = await clientAgent.distributionChart("income-distribution");

    expect(chart).toEqual([
      { key: "Subscriptions", value: 48 },
      { key: "One-off sales", value: 32 },
      { key: "Affiliate", value: 15 },
      { key: "Other", value: 5 },
    ]);
  });

  it("loads leaderboard chart", async () => {
    const chart = await clientAgent.leaderboardChart("income-leaderboard");

    expect(chart).toEqual([
      { key: "Enterprise plan", value: 180 },
      { key: "Business plan", value: 120 },
      { key: "Starter plan", value: 80 },
      { key: "Add-ons", value: 45 },
    ]);
  });

  it("loads yearly time-based chart", async () => {
    const chart = await clientAgent.timeBasedChart("yearly-incomes-trend");

    expect(chart).toEqual([
      { label: "2021", values: { value: 120_000 } },
      { label: "2022", values: { value: 150_000 } },
      { label: "2023", values: { value: 185_000 } },
      { label: "2024", values: { value: 210_000 } },
    ]);
  });

  it("loads monthly time-based chart", async () => {
    const chart = await clientAgent.timeBasedChart("monthly-incomes-trend");

    expect(chart).toEqual([
      { label: "Jan 24", values: { value: 16_500 } },
      { label: "Feb 24", values: { value: 18_200 } },
      { label: "Mar 24", values: { value: 19_750 } },
      { label: "Apr 24", values: { value: 20_300 } },
    ]);
  });

  it("loads weekly time-based chart", async () => {
    const chart = await clientAgent.timeBasedChart("weekly-incomes-trend");

    expect(chart).toEqual([
      { label: "W14-2024", values: { value: 4_200 } },
      { label: "W15-2024", values: { value: 4_450 } },
      { label: "W16-2024", values: { value: 4_780 } },
      { label: "W17-2024", values: { value: 4_950 } },
    ]);
  });

  it("loads daily time-based chart", async () => {
    const chart = await clientAgent.timeBasedChart("daily-incomes-trend");

    expect(chart).toEqual([
      { label: "22/04/2024", values: { value: 620 } },
      { label: "23/04/2024", values: { value: 680 } },
      { label: "24/04/2024", values: { value: 700 } },
      { label: "25/04/2024", values: { value: 710 } },
    ]);
  });

  it("loads multiple time-based chart", async () => {
    const chart = await clientAgent.timeBasedChart("income-trend-comparison");

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

import { mountAgentClient } from "../agent-setup";
import {
  clearCollections,
  ORGANIZATION_COLLECTION_VIEW,
  SEGMENT_NAME_ON_ORGANIZATION_VIEW,
} from "./helpers";
import fs from "fs";
type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type OrganizationRecord = { id: string; name: string };

describe("crud", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  const organizations = () =>
    clientAgent.collection(ORGANIZATION_COLLECTION_VIEW);

  it("export csv", async () => {
    for (let i = 1; i <= 10; i++) {
      await organizations().create<OrganizationRecord>({
        name: `Test Organization ${i}`,
      });
    }

    const csvFilePath = "/tmp/org.csv";
    const stream = fs.createWriteStream(csvFilePath);

    await organizations().exportCsv(stream, {
      filters: {
        conditionTree: {
          field: "name",
          operator: "Contains",
          value: "Test Organization",
        }, // returns all organizations
      },
      projection: ["name", "id"],
      search: "Test Organization 1", // it returns 1 and 10
      sort: {
        field: "name",
        ascending: false,
      },
    });

    const csvContent = fs.readFileSync(csvFilePath, "utf-8");
    const lines = csvContent.split("\n");
    expect(lines[0]).toContain("name,id");
    expect(lines[1]).toContain("Test Organization 10");
    expect(lines[2]).toContain("Test Organization 1");
    expect(lines[3]).toEqual("");
  });

  it("export on a segment", async () => {
    // create an organization without name
    await organizations().create<OrganizationRecord>({
      name: null,
    });
    await organizations().create<OrganizationRecord>({
      name: null,
    });
    for (let i = 1; i <= 10; i++) {
      await organizations().create<OrganizationRecord>({
        name: `Test Organization ${i}`,
      });
    }

    const csvFilePath = "/tmp/org_segment.csv";
    const stream = fs.createWriteStream(csvFilePath);

    await organizations()
      .segment(SEGMENT_NAME_ON_ORGANIZATION_VIEW)
      .exportCsv(stream, {
        projection: ["name", "id"],
      });

    const csvContent = fs.readFileSync(csvFilePath, "utf-8");
    const lines = csvContent.split("\n");
    expect(lines[0]).toContain("name,id");
    expect(lines[1]).toContain("Test Organization 1");
    expect(lines[2]).toContain("Test Organization 2");
    expect(lines[10]).toContain("Test Organization 10");
    expect(lines[11]).toEqual("");
  });
});

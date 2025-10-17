import { mountAgentClient } from "../agent-setup";
import {
  clearCollections,
  ORGANIZATION_COLLECTION_VIEW,
  SEGMENT_NAME_ON_ORGANIZATION_VIEW,
} from "./helpers";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type OrganizationRecord = { id: number | string; name: string | null };

describe("collection segments", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  const organizations = () =>
    clientAgent.collection(ORGANIZATION_COLLECTION_VIEW);

  it("filters organizations using custom segment", async () => {
    const [noNameOrg] = await organizations().list<OrganizationRecord>({
      filters: {
        conditionTree: {
          field: "name",
          operator: "Blank",
        },
      },
    });
    expect(noNameOrg).not.toBeDefined();

    const initialSegmentRecords = await organizations()
      .segment(SEGMENT_NAME_ON_ORGANIZATION_VIEW)
      .list<OrganizationRecord>();

    const namedOrganizationName = `Named organization ${Date.now()}`;

    const namedOrganization = await organizations().create<OrganizationRecord>({
      name: namedOrganizationName,
    });

    const unnamedOrganization =
      await organizations().create<OrganizationRecord>({ name: null });

    const segmentRecords = await organizations()
      .segment(SEGMENT_NAME_ON_ORGANIZATION_VIEW)
      .list<OrganizationRecord>();

    expect(segmentRecords.length).toBeGreaterThan(initialSegmentRecords.length);

    expect(segmentRecords.every((record) => Boolean(record.name))).toBe(true);

    expect(
      segmentRecords.some(
        (record) => String(record.id) === String(namedOrganization.id)
      )
    ).toBe(true);
    expect(
      segmentRecords.some(
        (record) => String(record.id) === String(unnamedOrganization.id)
      )
    ).toBe(false);

    const [organizationWithoutName] =
      await organizations().list<OrganizationRecord>({
        filters: {
          conditionTree: {
            field: "name",
            operator: "Blank",
          },
        },
      });
    expect(organizationWithoutName).toBeDefined();
  });

  it("filters organizations using live query segment", async () => {
    await organizations().create<OrganizationRecord>({ name: null });
    await organizations().create<OrganizationRecord>({ name: "not expected" });

    const initialSegmentRecords = await organizations()
      .liveQuerySegment({
        connectionName: "api",
        query: "SELECT * FROM organizations WHERE name IS NOT NULL",
      })
      .list<OrganizationRecord>();

    expect(initialSegmentRecords.length).toBe(1);
  });
});

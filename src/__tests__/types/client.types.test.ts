import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { entity, table } from "../../index.js";
import type { ItemForName, QueryParamsForItem } from "../../types.js";
import type { Agent, TestTable } from "../setup.js";
import { createDb } from "../setup.js";

type AgentIndexParams = QueryParamsForItem<
	ItemForName<[typeof Agent], "AGENT">,
	typeof TestTable.indexes.agent
>;

describe("Client Query Types", () => {
	it("enforces multi-key sort key rules", () => {
		void (null as unknown as AgentIndexParams);

		// Invalid: missing PK
		expectTypeOf<{
			price: number;
		}>().not.toExtend<AgentIndexParams>();

		// Invalid: skipping first SK (price), providing second (createdAt)
		expectTypeOf<{
			agentId: string;
			createdAt: string;
		}>().not.toExtend<AgentIndexParams>();

		// Invalid: range condition on first SK, providing second SK
		expectTypeOf<{
			agentId: string;
			price: { lte: number };
			createdAt: string;
		}>().not.toExtend<AgentIndexParams>();

		expectTypeOf<{
			agentId: string;
			price: string;
			createdAt: string;
		}>().not.toExtend<AgentIndexParams>();
	});

	it("restricts query index names to registered strings", () => {
		type IndexNames = keyof typeof TestTable.indexes;
		void (null as unknown as Extract<"listing", IndexNames>);
		void (null as unknown as Extract<"browse", IndexNames>);
		void (null as unknown as Exclude<"not-an-index", IndexNames>);
	});

	it("types index names on the client", () => {
		const db = createDb();
		type QueryIndex = Parameters<typeof db.index>[0];
		void (null as unknown as Extract<"listing", QueryIndex>);
		void (null as unknown as Extract<"browse", QueryIndex>);
		void (null as unknown as Extract<"agent", QueryIndex>);
		void (null as unknown as Exclude<"nope", QueryIndex>);
	});

	it("types the builder api and rejects invalid filter undefined values", () => {
		const db = createDb();
		const threads = db.index("browse", { zipCode: "90001", status: "ACTIVE" });
		const listingQuery = threads.entity("LISTING");
		const listingCollection = threads.collection();

		void listingQuery;
		void listingCollection;
		type ListingCollection = Awaited<typeof listingCollection>;

		const listingData = null as unknown as ListingCollection["data"];
		expectTypeOf(listingData).toHaveProperty("LISTING");
		expectTypeOf<typeof listingQuery>().toHaveProperty("pick");

		// @ts-expect-error undefined filter values should not be accepted
		listingQuery.filter({ beds: undefined });
		// @ts-expect-error asc and desc should be mutually exclusive
		listingQuery.asc().desc();
		// @ts-expect-error limit and page should be mutually exclusive
		listingQuery.limit(10).page({ cursor: "abc" });
		// @ts-expect-error page and limit should be mutually exclusive
		listingCollection.page({ limit: 10 }).limit(10);

		listingQuery.filter({ description: null });
	});

	it("allows put inputs to omit zod-defaulted fields", () => {
		const Board = entity({
			name: "BOARD",
			id: "boardId",
			schema: z.object({
				boardId: z.string(),
				name: z.string(),
				threadCount: z.number().default(0),
				lastActivityAt: z.string().default("now"),
			}),
		});

		const Forum = table({
			name: "ForumDefaults",
			entities: [Board],
			indexes: { board: { pk: ["boardId"] } },
		});

		const db = Forum.connect({ client: {} as never });
		type BoardPut = Parameters<typeof db.put<"BOARD">>[1];

		expectTypeOf<{
			boardId: string;
			name: string;
		}>().toExtend<BoardPut>();
	});

	it("returns required updatedAt from update", () => {
		const db = createDb();
		type UpdatedListing = Awaited<ReturnType<typeof db.update<"LISTING">>>;

		expectTypeOf<UpdatedListing["updatedAt"]>().toEqualTypeOf<string>();
	});
});

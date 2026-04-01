import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { entity, table } from "../../index.js";
import { createDb } from "../setup.js";

describe("type safety gaps", () => {
	it("preserves branded natural IDs across get/update/delete methods", () => {
		const Board = entity({
			name: "BOARD",
			id: "boardId",
			schema: z.object({
				boardId: z.string().brand<"BoardId">(),
				name: z.string(),
			}),
		});

		const Thread = entity({
			name: "THREAD",
			id: "threadId",
			schema: z.object({
				threadId: z.string().brand<"ThreadId">(),
				boardId: z.string().brand<"BoardId">(),
				title: z.string(),
				lastActivityAt: z.string(),
			}),
		});

		const Forum = table({
			name: "ForumTypes",
			entities: [Board, Thread],
			indexes: {
				threads: { pk: ["boardId"], sk: ["lastActivityAt"] },
			},
		});

		const db = Forum.connect({ client: {} as never });
		type BoardId = z.infer<typeof Board.schema>["boardId"];
		const boardId = "brd_123" as BoardId;

		const getBoard = () => db.get("BOARD", boardId);
		const updateBoard = () => db.update("BOARD", boardId, { name: "Updated" });
		const deleteBoard = () => db.delete("BOARD", boardId);

		void getBoard;
		void updateBoard;
		void deleteBoard;

		// @ts-expect-error cross-entity branded IDs should not be accepted
		const getThreadWithBoardId = () => db.get("THREAD", boardId);
		// @ts-expect-error raw strings should not be accepted for branded IDs
		const getBoardWithRawString = () => db.get("BOARD", "raw-string-id");

		void getThreadWithBoardId;
		void getBoardWithRawString;
	});

	it("rejects querying entities that cannot appear in an index", () => {
		const User = entity({
			name: "USER",
			id: "userId",
			schema: z.object({ userId: z.string(), username: z.string() }),
		});

		const Thread = entity({
			name: "THREAD",
			id: "threadId",
			schema: z.object({
				threadId: z.string(),
				lastActivityAt: z.string(),
				title: z.string(),
			}),
		});

		const Forum = table({
			name: "ForumEntitiesIndex",
			entities: [User, Thread],
			indexes: {
				entities: { pk: ["entityType"], sk: ["lastActivityAt"] },
			},
		});

		const db = Forum.connect({ client: {} as never });

		const queryThreads = () => db.index("entities", {}).entity("THREAD");
		// @ts-expect-error USER lacks lastActivityAt, so it can never appear in this index
		const queryUsers = () => db.index("entities", {}).entity("USER");

		void queryThreads;
		void queryUsers;
	});

	it("narrows collection result types to compatible entities", () => {
		const User = entity({
			name: "USER",
			id: "userId",
			schema: z.object({ userId: z.string(), username: z.string() }),
		});
		const Thread = entity({
			name: "THREAD",
			id: "threadId",
			schema: z.object({
				threadId: z.string(),
				boardId: z.string(),
				title: z.string(),
			}),
		});

		const Forum = table({
			name: "ForumCollections",
			entities: [User, Thread],
			indexes: {
				board: { pk: ["boardId"] },
			},
		});

		const db = Forum.connect({ client: {} as never });
		const loadBoard = () =>
			db.index("board", { boardId: "brd-1" }).collection();
		type ListingCollectionData = Awaited<ReturnType<typeof loadBoard>>["data"];

		const readThreadBucket = (data: ListingCollectionData) => data.THREAD;
		// @ts-expect-error board index cannot contain USER entities
		const readUserBucket = (data: ListingCollectionData) => data.USER;

		void readThreadBucket;
		void readUserBucket;
	});

	it("returns a non-optional id from put", () => {
		const db = createDb();
		const createAgent = () =>
			db.put("AGENT", {
				agentId: "agt-typed",
				listingId: "lst-typed",
				name: "Typed Agent",
				brokerage: "Typed Realty",
				phone: "555-1234",
				email: "typed@example.com",
				licenseNumber: "CA-TYPED",
			});

		type PutResult = Awaited<ReturnType<typeof createAgent>>;
		expectTypeOf<PutResult["id"]>().toEqualTypeOf<string>();
	});

	it("rejects duplicate entity names at the type level", () => {
		const One = entity({
			name: "DUPE",
			id: "id",
			schema: z.object({ id: z.string() }),
		});
		const Two = entity({
			name: "DUPE",
			id: "otherId",
			schema: z.object({ otherId: z.string() }),
		});

		const createDuplicateTable = () =>
			table({
				name: "DuplicateNames",
				// @ts-expect-error duplicate entity names should be rejected
				entities: [One, Two],
				indexes: {},
			});

		void createDuplicateTable;
	});
});

# debris

Type-safe DynamoDB single-table design with native multi-attribute GSI keys.

## Why debris?

Most DynamoDB single-table libraries were designed before DynamoDB added multi-attribute GSI keys. They usually flatten composite keys into opaque strings like `STATUS#2025-11-04#100`, which means:

- key data is harder to inspect in the AWS console
- numeric ordering becomes string ordering unless you hand-normalize values
- library metadata often leaks into every item

`debris` keeps indexed attributes as real DynamoDB attributes. `price` stays a number. `status` stays a string. Your table shape stays readable.

## Requirements

- Node.js 24+
- TypeScript 6+
- `@aws-sdk/client-dynamodb` v3
- `@aws-sdk/lib-dynamodb` v3
- `zod` v4
- DynamoDB Local 3.3.0+ if you want local multi-key GSI testing

## Install

```bash
npm install debris @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb zod
```

## Examples

- `examples/quick-start.ts` - minimal end-to-end setup including table creation
- `examples/real-estate.ts` - richer single-table real-estate model with shared indexes
- `examples/transactions.ts` - conditional writes and transaction flows

The `real-estate` and `transactions` examples export reusable table definitions plus an `example()` function you can wire to your own `DynamoDBDocumentClient`.

You can typecheck the examples locally with:

```bash
npm run examples:typecheck
```

## Quick Start

```ts
import {
	CreateTableCommand,
	DynamoDBClient,
	UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { entity, table } from "debris";
import { z } from "zod";

const Listing = entity({
	name: "LISTING",
	id: "listingId",
	schema: z.object({
		listingId: z.string(),
		address: z.string(),
		zipCode: z.string(),
		status: z.enum(["ACTIVE", "PENDING", "SOLD"]),
		price: z.number(),
		agentId: z.string(),
		expiresAt: z.string().optional(),
	}),
});

const Offer = entity({
	name: "OFFER",
	id: "offerId",
	schema: z.object({
		offerId: z.string(),
		listingId: z.string(),
		amount: z.number(),
		status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
		buyerName: z.string(),
	}),
});

const RealEstate = table({
	name: "RealEstate",
	entities: [Listing, Offer],
	ttl: "expiresAt",
	indexes: {
		listing: { pk: ["listingId"], sk: ["entityType", "id"] },
		browse: { pk: ["zipCode", "status"], sk: ["price"] },
	},
});

const baseClient = new DynamoDBClient({ region: "us-east-1" });
await baseClient.send(new CreateTableCommand(RealEstate.tableSchema()));

const ttlConfig = RealEstate.ttlConfig();
if (ttlConfig) {
	await baseClient.send(new UpdateTimeToLiveCommand(ttlConfig));
}

const docClient = DynamoDBDocumentClient.from(baseClient, {
	marshallOptions: { removeUndefinedValues: true },
});

const db = RealEstate.connect({ client: docClient });

await db.put("LISTING", {
	listingId: "lst-001",
	address: "123 Oak Street",
	zipCode: "90210",
	status: "ACTIVE",
	price: 425000,
	agentId: "agt-001",
});

const results = await db
	.index("browse", {
		zipCode: "90210",
		status: "ACTIVE",
		price: { lte: 500000 },
	})
	.entity("LISTING");

console.log(results.items[0]?.price);
```

## Core Ideas

- Every item lives in the base table as `{ id, entityType }`
- GSIs are declared with real attributes, not concatenated strings
- Read params are derived from the selected index and entity type
- `db.index(...).entity(...)` returns one entity type; `.collection()` groups all entity types from one index query

## API

### `entity()`

```ts
const Listing = entity({
	name: "LISTING",
	schema: listingSchema,
	id: "listingId",
});
```

- `name` becomes the stored `entityType`
- `id` points to the natural ID field copied into the base table partition key

### `table()`

```ts
const RealEstate = table({
	name: "RealEstate",
	entities: [Listing, Offer],
	indexes: {
		listing: { pk: ["listingId"], sk: ["entityType", "id"] },
		browse: { pk: ["zipCode", "status"], sk: ["price"] },
	},
});
```

- index definitions are validated when you call `tableSchema()`
- index attributes are type-checked against your entity schemas
- unknown indexed attributes throw early
- conflicting indexed attribute types across entities throw early
- non-scalar key attributes throw early
- `sk` is optional for PK-only indexes

PK-only index example:

```ts
const AdminTable = table({
	name: "AdminTable",
	entities: [Listing],
	indexes: {
		allListings: { pk: ["entityType"] },
	},
});
```

Then query all listings with:

```ts
const page = await db.index("allListings", {}).entity("LISTING");
```

### `db.put(entityName, item, options?)`

- validates with Zod before writing
- auto-populates `id`, `entityType`, `createdAt`, and `updatedAt`

```ts
const listing = await db.put("LISTING", {
	listingId: "lst-001",
	address: "123 Oak Street",
	zipCode: "90210",
	status: "ACTIVE",
	price: 425000,
	agentId: "agt-001",
});
```

### `db.get(entityName, id)`

```ts
const listing = await db.get("LISTING", "lst-001");
```

### `db.update(entityName, id, updates, options?)`

- partial update only
- rejects empty updates
- rejects unknown fields and invalid operation helpers
- throws `EntityNotFoundError` if the item does not exist

```ts
const updated = await db.update("LISTING", "lst-001", {
	price: 399000,
	status: "PENDING",
});
```

### Atomic update helpers

```ts
import { op } from "debris";

await db.update("LISTING", "lst-001", {
	viewCount: op.add(1),
	description: op.remove(),
	tags: op.append(["pool"]),
	history: op.prepend(["created"]),
});
```

- `op.add()` works on numeric fields
- `op.append()` and `op.prepend()` work on list fields
- `op.remove()` works on optional fields

### `db.delete(entityName, id, options?)`

- idempotent when no condition is supplied

### `db.index(indexName, params)`

```ts
const page = await db
	.index("browse", {
		zipCode: "90210",
		status: "ACTIVE",
		price: { between: [300000, 500000] },
	})
	.entity("LISTING");
```

- `indexName` must be one of the registered table index names, such as `"browse"`
- `entity(...)` narrows the query to one compatible entity type
- all PK attributes are required and use equality only
- sort key params must be supplied left-to-right
- range conditions are only valid on the last provided sort key attribute
- if the index does not include `entityType`, `entity(...)` adds a filter so only the requested entity type is returned

Range examples:

```ts
{ price: { lte: 500000 } }
{ price: { gt: 100000 } }
{ price: { between: [100000, 500000] } }
{ createdAt: { beginsWith: "2026-03" } }
```

Builder methods:

```ts
const page = await db
	.index("browse", params)
	.entity("LISTING")
	.filter({
		beds: { gte: 2 },
		OR: [{ status: "ACTIVE" }, { status: "PENDING" }],
	})
	.desc()
	.page({ cursor: previousCursor, limit: 10 })
	.pick(["listingId", "price"]);
```

- `pick` returns the selected fields plus base fields: `id`, `entityType`, `createdAt`, `updatedAt`
- `asc()` and `desc()` control sort order
- `page({ cursor, limit })` sets pagination in one step; `limit()` and `cursor()` are also available
- key attributes stay natively typed; numeric keys are still numbers in DynamoDB and in your query params

### `whereDefined(object)`

```ts
const page = await db
	.index("board", { boardId, threadId })
	.entity("POST")
	.page(whereDefined({ cursor, limit }))
	.filter(whereDefined({ userId }))
	.asc();
```

- removes keys whose values are `undefined`
- preserves `null` values so intentional null filters still work
- useful for optional builder inputs like `filter(...)` and `page(...)`

### `collection()`

```ts
const result = await db
	.index("listing", { listingId: "lst-001" })
	.collection();

result.data.LISTING;
result.data.OFFER;
```

- best for “get the whole partition and group it” flows
- if you only need one entity type, prefer `entity(...)`

### `db.batchPut()` and `db.batchDelete()`

- automatically chunk into batches of 25
- retries unprocessed items with backoff

### `db.transactWrite()` and `db.tx.*`

```ts
await db.transactWrite([
	db.tx.put("LISTING", {
		listingId: "lst-001",
		address: "123 Oak Street",
		zipCode: "90210",
		status: "ACTIVE",
		price: 425000,
		agentId: "agt-001",
	}),
	db.tx.update("LISTING", "lst-001", { status: "PENDING" }),
	db.tx.check("LISTING", "lst-001", {
		expression: "price > :min",
		values: { ":min": 0 },
	}),
]);
```

- `db.tx.*` validates typed inputs before building operations
- transaction updates also require the target item to already exist

## Conditions

`put`, `update`, `delete`, and transaction helpers accept a `condition` object:

```ts
await db.put("LISTING", listing, {
	condition: {
		expression: "attribute_not_exists(id)",
	},
});
```

You can also pass your own expression attribute names when needed:

```ts
await db.delete("LISTING", "lst-001", {
	condition: {
		expression: "#size = :sqft",
		names: { "#size": "sqft" },
		values: { ":sqft": 1200 },
	},
});
```

- regular field names are auto-aliased to avoid reserved-word conflicts
- explicit `names` are merged in and preserved

## Filters

`entity(...).filter()` and `collection().filter()` accept a recursive filter DSL:

```ts
const page = await db
	.index("browse", params)
	.entity("LISTING")
	.filter({
		NOT: { status: "SOLD" },
		OR: [
			{ price: { between: [100000, 200000] } },
			{ description: { contains: "pool" } },
		],
	});
```

Supported operators:

- `eq`, `neq`, `lt`, `lte`, `gt`, `gte`
- `between`, `in`
- `contains`, `beginsWith`
- `exists`
- `AND`, `OR`, `NOT`

Important:

- filter branches must not contain `undefined` values
- `null` is allowed when you intentionally want to match a DynamoDB null value
- build filters conditionally instead of passing `undefined`
- debris throws a clear error before calling DynamoDB if a filter value is `undefined`

Good:

```ts
const filter = {
	...(userId !== undefined ? { userId } : {}),
};

await db.index("users", { userId: someUserId }).entity("POST").filter(filter);

await db
	.index("users", { userId: someUserId })
	.entity("POST")
	.filter(whereDefined({ userId }));
```

Bad:

```ts
await db.index("users", { userId: someUserId }).entity("POST").filter({
	userId, // string | undefined
});
```

## Table Schema Generation

```ts
import { CreateTableCommand } from "@aws-sdk/client-dynamodb";

await baseClient.send(new CreateTableCommand(RealEstate.tableSchema()));
```

Generated from your declarative table definition:

- base table key schema
- attribute definitions
- global secondary indexes
- TTL config via `ttlConfig()` if configured

## Error Types

- `ConditionFailedError`
- `EntityNotFoundError`
- `UnknownEntityError`
- `IndexNotFoundError`

## Design Notes

### Natural IDs

The base `id` field is always stored as a DynamoDB string. If your natural ID field is numeric, it is converted with `String()`.

### Sparse indexes

If an item is missing any indexed key component, DynamoDB omits it from that GSI.

### Index key typing

Index definitions only accept known entity fields plus managed fields like `id`, `entityType`, `createdAt`, and `updatedAt`.

Supported scalar key inference currently includes:

- `z.string()`
- `z.number()`
- `z.enum(...)`
- scalar `z.literal(...)`
- compatible scalar `z.union(...)`

Non-scalar fields like arrays, objects, and ambiguous unions are rejected for index key definitions.

### Cursor pagination

Cursors are base64url-encoded `LastEvaluatedKey` objects. They are not signed or encrypted.

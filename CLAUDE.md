# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is debri?

Debri is a TypeScript DynamoDB single-table design library, supporting multi-key primary keys and secondary indexes. It provides a type-safe API for defining entities with Zod schemas, composing them into a table with GSI definitions, and performing CRUD, query, batch, and transactional operations through a generated client.

## Commands

- **Run all tests:** `npm test` (requires DynamoDB Local on port 8000)
- **Run tests in watch mode:** `npm run test:watch`
- **Run a single test:** `npx vitest run -t "test name pattern"`
- **Run a single test file:** `npx vitest run src/__tests__/client.test.ts`

Tests use Vitest and hit a real DynamoDB Local instance (not mocks). The `AWS_ENDPOINT` env var is set automatically by the test scripts.

## Architecture

The library has three layers, all under `src/`:

1. **`entity.ts`** — `entity()` factory that pairs a Zod schema with a name and natural ID field. Produces an `EntityDefinition` used by the other layers.

2. **`table.ts`** — `table()` factory that takes a name, an array of entities, and an index map (`{ indexName: { pk: [...], sk: [...] } }`). Returns a `Table` object with:
   - `tableSchema()` — generates `CreateTableCommandInput` (attribute definitions, GSIs) from entity schemas and index definitions.
   - `connect({ client })` — creates the `TableClient`.

3. **`client.ts`** — `createClient()` builds a `TableClient` with methods: `put`, `get`, `update`, `delete`, `index`, `batchPut`, `batchDelete`, `transactWrite`. Key design points:
   - Every item gets base fields: `id` (natural ID), `entityType`, `createdAt`, `updatedAt`.
   - The primary key is always `{ id (HASH), entityType (RANGE) }`.
	- `index(indexName, params)` starts a thenable read builder.
	- `.entity(name)` narrows to one entity type; `.collection()` queries an index and groups results by entity type.
   - Condition expressions, filter expressions, projections, and cursor-based pagination are built internally from user-facing types.
   - Filter expressions use a Prisma-like recursive object syntax (e.g. `{ filter: { beds: { gte: 2 }, OR: [...] } }`).
   - DynamoDB reserved words are handled via `ExpressionAttributeNames` using a hardcoded set.

## Testing

Tests live in `src/__tests__/`. `setup.ts` defines test entities (Listing, Agent, Offer), a table with three GSIs (listing, browse, agent), and helpers to create/teardown the DynamoDB table per test run. Tests run against DynamoDB Local — start it before running tests:

```
docker run -p 8000:8000 amazon/dynamodb-local
```

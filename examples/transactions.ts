import { z } from "zod";
import { entity, table } from "../src/index.js";

const Account = entity({
	name: "ACCOUNT",
	id: "accountId",
	schema: z.object({
		accountId: z.string(),
		customerId: z.string(),
		status: z.enum(["ACTIVE", "SUSPENDED"]),
		balance: z.number(),
	}),
});

const LedgerEntry = entity({
	name: "LEDGER_ENTRY",
	id: "entryId",
	schema: z.object({
		entryId: z.string(),
		accountId: z.string(),
		amount: z.number(),
		type: z.enum(["DEBIT", "CREDIT"]),
		description: z.string(),
	}),
});

export const Banking = table({
	name: "ExampleBanking",
	entities: [Account, LedgerEntry],
	indexes: {
		account: { pk: ["accountId"], sk: ["entityType", "id"] },
		customer: { pk: ["customerId"], sk: ["status"] },
	},
});

export async function example(db: ReturnType<typeof Banking.connect>) {
	await db.put("ACCOUNT", {
		accountId: "acct-001",
		customerId: "cust-001",
		status: "ACTIVE",
		balance: 1000,
	});

	await db.transactWrite([
		db.tx.update(
			"ACCOUNT",
			"acct-001",
			{ balance: 750 },
			{
				condition: {
					expression: "balance >= :amount",
					values: { ":amount": 250 },
				},
			},
		),
		db.tx.put("LEDGER_ENTRY", {
			entryId: "entry-001",
			accountId: "acct-001",
			amount: 250,
			type: "DEBIT",
			description: "ATM withdrawal",
		}),
		db.tx.check("ACCOUNT", "acct-001", {
			expression: "#status = :status",
			names: { "#status": "status" },
			values: { ":status": "ACTIVE" },
		}),
	]);

	return db.index("account", { accountId: "acct-001" }).collection();
}

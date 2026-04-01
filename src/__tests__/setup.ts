import {
	CreateTableCommand,
	DeleteTableCommand,
	DescribeTableCommand,
	DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { entity, table } from "../index.js";

// ─── Client ─────────────────────────────────────────────────

const baseClient = new DynamoDBClient({
	region: "us-east-1",
	endpoint: process.env.AWS_ENDPOINT ?? "http://localhost:8000",
	credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

export const docClient = DynamoDBDocumentClient.from(baseClient, {
	marshallOptions: { removeUndefinedValues: true },
});

// ─── Entities ───────────────────────────────────────────────

export const Listing = entity({
	name: "LISTING",
	schema: z.object({
		listingId: z.string(),
		address: z.string(),
		city: z.string(),
		state: z.string(),
		zipCode: z.string(),
		price: z.number(),
		beds: z.number(),
		baths: z.number(),
		sqft: z.number(),
		yearBuilt: z.number().optional(),
		propertyType: z.enum([
			"SINGLE_FAMILY",
			"CONDO",
			"TOWNHOUSE",
			"MULTI_FAMILY",
		]),
		status: z.enum(["ACTIVE", "PENDING", "SOLD", "WITHDRAWN"]),
		agentId: z.string(),
		description: z.string().optional(),
	}),
	id: "listingId",
});

export const Agent = entity({
	name: "AGENT",
	schema: z.object({
		agentId: z.string(),
		listingId: z.string(),
		name: z.string(),
		brokerage: z.string(),
		phone: z.string(),
		email: z.string(),
		licenseNumber: z.string(),
	}),
	id: "agentId",
});

export const Offer = entity({
	name: "OFFER",
	schema: z.object({
		offerId: z.string(),
		listingId: z.string(),
		agentId: z.string().optional(),
		zipCode: z.string().optional(),
		amount: z.number(),
		financingType: z.enum(["CONVENTIONAL", "FHA", "VA", "CASH"]),
		buyerName: z.string(),
		status: z.enum([
			"ACTIVE",
			"PENDING",
			"ACCEPTED",
			"REJECTED",
			"EXPIRED",
			"WITHDRAWN",
		]),
		expiresAt: z.string(),
		contingencies: z.array(z.string()).optional(),
	}),
	id: "offerId",
});

// ─── Table ──────────────────────────────────────────────────

export const TestTable = table({
	name: `Test_${process.pid}`,
	entities: [Listing, Agent, Offer],
	indexes: {
		allListings: {
			pk: ["entityType"],
		},
		listing: {
			pk: ["listingId"],
			sk: ["entityType", "id"],
		},
		browse: {
			pk: ["zipCode", "status"],
			sk: ["price"],
		},
		agent: {
			pk: ["agentId"],
			sk: ["price", "createdAt"],
		},
	},
});

// ─── Lifecycle ──────────────────────────────────────────────

async function tableExists(name: string): Promise<boolean> {
	try {
		await baseClient.send(new DescribeTableCommand({ TableName: name }));
		return true;
	} catch {
		return false;
	}
}

export async function setupTable() {
	const name = TestTable.name;
	if (await tableExists(name)) {
		await baseClient.send(new DeleteTableCommand({ TableName: name }));
		await new Promise((r) => setTimeout(r, 500));
	}
	await baseClient.send(new CreateTableCommand(TestTable.tableSchema()));
}

export async function teardownTable() {
	try {
		await baseClient.send(
			new DeleteTableCommand({ TableName: TestTable.name }),
		);
	} catch {
		// ignore
	}
}

export function createDb() {
	return TestTable.connect({ client: docClient });
}

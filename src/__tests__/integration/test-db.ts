import { afterAll, beforeAll } from "vitest";
import { createDb, setupTable, teardownTable } from "../setup.js";

export function useIntegrationDb() {
	const db = createDb();

	beforeAll(async () => {
		await setupTable();
	});

	afterAll(async () => {
		await teardownTable();
	});

	return db;
}

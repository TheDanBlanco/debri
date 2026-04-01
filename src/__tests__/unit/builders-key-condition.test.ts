import { describe, expect, it } from "vitest";
import { buildKeyCondition } from "../../builders.js";

describe("buildKeyCondition", () => {
	it("should throw if missing required partition key", () => {
		expect(() =>
			buildKeyCondition({ otherField: "val" }, { pk: ["myPk"], sk: [] }),
		).toThrow("Missing required partition key attribute: myPk");
	});

	it("should throw if partition key is given a range condition", () => {
		expect(() =>
			buildKeyCondition({ myPk: { lte: 100 } }, { pk: ["myPk"], sk: [] }),
		).toThrow("Partition key attribute myPk cannot have a range condition");
	});

	it("should build range conditions like <, >=, >, between", () => {
		const lessThan = buildKeyCondition(
			{ pk1: "test", sk1: { lt: 50 } },
			{ pk: ["pk1"], sk: ["sk1"] },
		);
		expect(lessThan.expression).toContain("#sk1 < :sk1");

		const gte = buildKeyCondition(
			{ pk1: "test", sk1: { gte: 50 } },
			{ pk: ["pk1"], sk: ["sk1"] },
		);
		expect(gte.expression).toContain("#sk1 >= :sk1");

		const gt = buildKeyCondition(
			{ pk1: "test", sk1: { gt: 50 } },
			{ pk: ["pk1"], sk: ["sk1"] },
		);
		expect(gt.expression).toContain("#sk1 > :sk1");

		const between = buildKeyCondition(
			{ pk1: "test", sk1: { between: [10, 20] } },
			{ pk: ["pk1"], sk: ["sk1"] },
		);
		expect(between.expression).toContain("#sk1 BETWEEN :sk1lo AND :sk1hi");
		expect(between.values[":sk1lo"]).toBe(10);
		expect(between.values[":sk1hi"]).toBe(20);
	});

	it("should handle beginsWith condition", () => {
		const beginsWith = buildKeyCondition(
			{ pk1: "test", sk1: { beginsWith: "prefix" } },
			{ pk: ["pk1"], sk: ["sk1"] },
		);
		expect(beginsWith.expression).toContain("begins_with(#sk1, :sk1)");
		expect(beginsWith.values[":sk1"]).toBe("prefix");
	});
});

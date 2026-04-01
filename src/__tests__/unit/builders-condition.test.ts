import { describe, expect, it } from "vitest";
import { buildConditionParams } from "../../builders.js";

describe("buildConditionParams", () => {
	it("should return empty params if condition is undefined", () => {
		const cond = buildConditionParams(undefined);
		expect(cond).toEqual({ values: {}, names: {} });
	});

	it("should handle condition parameter replacement with reserved words", () => {
		const cond = buildConditionParams({
			expression: "status = :status AND #type = :type",
			values: { ":status": "ACTIVE" },
		});

		expect(cond.expression).toBe(
			"#cond_status = :status AND #type = :type",
		);
		expect(cond.names["#cond_status"]).toBe("status");
		expect(cond.names["#cond_type"]).toBeUndefined();
	});

	it("should not alias field names that collide with expression keywords", () => {
		const cond = buildConditionParams({
			expression: "size = :val",
			values: { ":val": 100 },
		});

		expect(cond.expression).toBe("size = :val");
		expect(cond.names["#cond_size"]).toBeUndefined();
	});

	it("should preserve caller-provided expression attribute names", () => {
		const cond = buildConditionParams({
			expression: "#size = :val AND status = :status",
			values: { ":val": 100, ":status": "ACTIVE" },
			names: { "#size": "size" },
		});

		expect(cond.expression).toBe(
			"#size = :val AND #cond_status = :status",
		);
		expect(cond.names).toEqual({
			"#size": "size",
			"#cond_status": "status",
		});
	});
});

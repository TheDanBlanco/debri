import { describe, expect, it } from "vitest";
import { isOperation, OP_BRAND, op } from "../../operations.js";

describe("operations utilities", () => {
	it("creates valid operations", () => {
		expect(op.add(5)).toEqual({ [OP_BRAND]: "add", value: 5 });
		expect(op.remove()).toEqual({ [OP_BRAND]: "remove" });
		expect(op.append(["a", "b"])).toEqual({
			[OP_BRAND]: "append",
			value: ["a", "b"],
		});
		expect(op.prepend(["x"])).toEqual({ [OP_BRAND]: "prepend", value: ["x"] });
	});

	it("identifies operations correctly", () => {
		expect(isOperation(op.add(1))).toBe(true);
		expect(isOperation({ value: 1 })).toBe(false);
		expect(isOperation(null)).toBe(false);
		expect(isOperation("add")).toBe(false);
	});
});

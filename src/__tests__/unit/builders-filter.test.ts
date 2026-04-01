import { describe, expect, it } from "vitest";
import { buildFilterExpression } from "../../builders.js";

describe("buildFilterExpression", () => {
	it("returns empty for undefined or empty filter", () => {
		expect(buildFilterExpression(undefined)).toEqual({
			names: {},
			values: {},
		});
		expect(buildFilterExpression({})).toEqual({
			names: {},
			values: {},
		});
	});

	it("handles implicit AND", () => {
		const res = buildFilterExpression({ a: 1, b: 2 });
		expect(res.expression).toBe("#f_a = :fval1 AND #f_b = :fval2");
		expect(res.names).toEqual({ "#f_a": "a", "#f_b": "b" });
		expect(res.values).toEqual({ ":fval1": 1, ":fval2": 2 });
	});

	it("handles empty logical operators gracefully", () => {
		const res = buildFilterExpression({
			OR: [{}],
			AND: [],
			NOT: {},
			h: { in: [] },
			a: 1,
		});
		expect(res.expression).toBe("#f_a = :fval1");
	});

	it("handles logical operators", () => {
		const res = buildFilterExpression({
			OR: [{ a: 1 }, { b: 2 }],
			AND: [{ c: 3 }],
			NOT: { d: 4 },
		});
		expect(res.expression).toBe(
			"(#f_a = :fval1 OR #f_b = :fval2) AND (#f_c = :fval3) AND NOT (#f_d = :fval4)",
		);
	});

	it("handles operations", () => {
		const res = buildFilterExpression({
			a: { eq: 1 },
			b: { neq: 2 },
			c: { lt: 3 },
			d: { lte: 4 },
			e: { gt: 5 },
			f: { gte: 6 },
			g: { between: [1, 10] },
			h: { in: [1, 2, 3] },
			i: { exists: true },
			j: { exists: false },
			k: { contains: "foo" },
			l: { beginsWith: "bar" },
		});

		expect(res.expression).toBe(
			"#f_a = :fval1 AND #f_b <> :fval2 AND #f_c < :fval3 AND #f_d <= :fval4 AND #f_e > :fval5 AND #f_f >= :fval6 AND #f_g BETWEEN :fval7 AND :fval8 AND #f_h IN (:fval9, :fval10, :fval11) AND attribute_exists(#f_i) AND attribute_not_exists(#f_j) AND contains(#f_k, :fval12) AND begins_with(#f_l, :fval13)",
		);
	});

	it("throws a clear error for undefined filter values", () => {
		expect(() =>
			buildFilterExpression({
				a: undefined,
				f: 2,
			}),
		).toThrow(
			'Invalid filter at "filter.a": received undefined. Omit the field instead.',
		);

		expect(() =>
			buildFilterExpression({
				b: { eq: undefined },
			}),
		).toThrow(
			'Invalid filter at "filter.b.eq": received undefined. Omit the field instead.',
		);

		expect(() =>
			buildFilterExpression({
				c: { in: [1, undefined, 3] },
			}),
		).toThrow(
			'Invalid filter at "filter.c.in": received undefined. Omit the field instead.',
		);
	});
});

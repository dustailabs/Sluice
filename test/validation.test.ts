import {
	ClaudeOutputError,
	buildRetryMessage,
	parseClaudeJson,
	stripCodeFence,
	validateAgainstSchema,
} from '../nodes/ClaudeStructured/validation';

describe('stripCodeFence', () => {
	it('removes a ```json fence', () => {
		expect(stripCodeFence('```json\n{"a": 1}\n```')).toBe('{"a": 1}');
	});

	it('passes through unfenced text unchanged', () => {
		expect(stripCodeFence('{"a": 1}')).toBe('{"a": 1}');
	});
});

describe('parseClaudeJson', () => {
	it('parses valid JSON', () => {
		expect(parseClaudeJson('{"category": "billing"}')).toEqual({ category: 'billing' });
	});

	it('parses JSON wrapped in a markdown fence', () => {
		expect(parseClaudeJson('```json\n{"category": "billing"}\n```')).toEqual({
			category: 'billing',
		});
	});

	it('throws ClaudeOutputError on invalid JSON', () => {
		expect(() => parseClaudeJson('not json at all')).toThrow(ClaudeOutputError);
	});
});

describe('validateAgainstSchema', () => {
	const schema = {
		type: 'object',
		required: ['category', 'priority'],
		properties: {
			category: { type: 'string', enum: ['billing', 'technical', 'general'] },
			priority: { type: 'integer', minimum: 1, maximum: 5 },
		},
	};

	it('passes valid data', () => {
		const result = validateAgainstSchema({ category: 'billing', priority: 3 }, schema);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('rejects data missing a required field', () => {
		const result = validateAgainstSchema({ category: 'billing' }, schema);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it('rejects an out-of-enum value', () => {
		const result = validateAgainstSchema({ category: 'cooking', priority: 1 }, schema);
		expect(result.valid).toBe(false);
	});

	it('rejects an out-of-range number', () => {
		const result = validateAgainstSchema({ category: 'billing', priority: 99 }, schema);
		expect(result.valid).toBe(false);
	});
});

describe('buildRetryMessage', () => {
	it('lists each error as a bullet', () => {
		const message = buildRetryMessage(['missing field "x"', 'wrong type for "y"']);
		expect(message).toContain('missing field "x"');
		expect(message).toContain('wrong type for "y"');
		expect(message).toContain('JSON only');
	});
});

/**
 * Pure helpers for pulling structured output out of a Claude response and
 * validating it against a user-supplied JSON Schema.
 *
 * Deliberately framework-free (no n8n-workflow import) so these can be
 * unit tested directly, the same way Cairn's `crew/parsing.py` keeps its
 * output-parsing logic independent of the orchestration framework around
 * it. The node (`ClaudeStructured.node.ts`) is the only place these get
 * wired into n8n's `IExecuteFunctions`.
 */

import Ajv, { ErrorObject } from 'ajv';

export class ClaudeOutputError extends Error {}

const FENCE_RE = /```(?:json)?\s*([\s\S]*?)\s*```/;

/** Strip a ```json ... ``` fence if present, otherwise return as-is. */
export function stripCodeFence(raw: string): string {
	const match = FENCE_RE.exec(raw);
	return match ? match[1].trim() : raw.trim();
}

/**
 * Parse Claude's raw text response into a JSON value.
 * Throws `ClaudeOutputError` (never a raw SyntaxError) so callers have one
 * error type to handle.
 */
export function parseClaudeJson(raw: string): unknown {
	const cleaned = stripCodeFence(raw);
	try {
		return JSON.parse(cleaned);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new ClaudeOutputError(`Claude's output was not valid JSON: ${message}`);
	}
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

const ajv = new Ajv({ allErrors: true, strict: false });

/** Validate a parsed value against a JSON Schema object. */
export function validateAgainstSchema(data: unknown, schema: object): ValidationResult {
	const validateFn = ajv.compile(schema);
	const valid = validateFn(data) as boolean;
	if (valid) {
		return { valid: true, errors: [] };
	}
	const errors = (validateFn.errors ?? []).map(formatAjvError);
	return { valid: false, errors };
}

function formatAjvError(error: ErrorObject): string {
	const path = error.instancePath || '(root)';
	return `${path} ${error.message ?? 'failed validation'}`;
}

/**
 * Build the corrective follow-up message sent on a retry, telling Claude
 * exactly what was wrong with its previous attempt instead of just asking
 * it to "try again".
 */
export function buildRetryMessage(errors: string[]): string {
	return (
		'Your previous response did not match the required JSON schema. ' +
		'Fix the following issues and reply with corrected JSON only, no other text:\n' +
		errors.map((e) => `- ${e}`).join('\n')
	);
}

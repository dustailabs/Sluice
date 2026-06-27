import * as fs from 'fs';
import * as path from 'path';

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const workflowFiles = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.json'));

describe('bundled workflow exports', () => {
	it('has at least one workflow file', () => {
		expect(workflowFiles.length).toBeGreaterThan(0);
	});

	for (const file of workflowFiles) {
		describe(file, () => {
			const workflow = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8'));

			it('has the required top-level n8n workflow keys', () => {
				expect(workflow).toHaveProperty('name');
				expect(workflow).toHaveProperty('nodes');
				expect(workflow).toHaveProperty('connections');
				expect(Array.isArray(workflow.nodes)).toBe(true);
			});

			it('every node has a unique id and a connections entry or is a terminal node', () => {
				const ids = workflow.nodes.map((n: any) => n.id);
				expect(new Set(ids).size).toBe(ids.length);
			});

			it('every connection source references a node that actually exists in this workflow', () => {
				const nodeNames = new Set(workflow.nodes.map((n: any) => n.name));
				for (const sourceName of Object.keys(workflow.connections)) {
					expect(nodeNames.has(sourceName)).toBe(true);
				}
			});

			it('every connection target references a node that actually exists in this workflow', () => {
				const nodeNames = new Set(workflow.nodes.map((n: any) => n.name));
				for (const outputs of Object.values(workflow.connections) as any[]) {
					for (const branch of outputs.main ?? []) {
						for (const target of branch) {
							expect(nodeNames.has(target.node)).toBe(true);
						}
					}
				}
			});

			it('uses the claudeStructured node with the package-qualified type name', () => {
				const claudeNodes = workflow.nodes.filter(
					(n: any) => n.type === 'n8n-nodes-sluice.claudeStructured',
				);
				expect(claudeNodes.length).toBeGreaterThan(0);
				for (const node of claudeNodes) {
					// every Claude node must declare a valid JSON Schema string
					expect(() => JSON.parse(node.parameters.jsonSchema)).not.toThrow();
				}
			});
		});
	}
});

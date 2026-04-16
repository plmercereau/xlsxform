/**
 * Entity processing - ported from pyxform/entities/entities_parsing.py
 *
 * Handles:
 * 1. Parsing and validating entities sheet
 * 2. Processing save_to references from survey sheet
 * 3. Allocating entities to containers (survey/group/repeat)
 * 4. Injecting entity declarations into JSON structure
 */

import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";
import { isXmlTag } from "./parsing/expression.js";
import { getMetaGroup } from "./question-type-dictionary.js";

// --- Constants ---

const ENTITY_COLUMNS = new Set([
	"dataset",
	"list_name",
	"entity_id",
	"create_if",
	"update_if",
	"label",
]);

// --- Container Path ---

interface ContainerNode {
	name: string;
	type: string;
}

export class ContainerPath {
	nodes: ContainerNode[];

	constructor(nodes: ContainerNode[]) {
		this.nodes = nodes;
	}

	static default(): ContainerPath {
		return new ContainerPath([
			{ name: constants.SURVEY, type: constants.SURVEY },
		]);
	}

	pathAsStr(): string {
		return `/${this.nodes.map((n) => n.name).join("/")}`;
	}

	getScopeBoundary(): ContainerPath {
		for (let i = this.nodes.length - 1; i >= 0; i--) {
			if (
				this.nodes[i].type === constants.REPEAT ||
				this.nodes[i].type === constants.SURVEY
			) {
				return new ContainerPath(this.nodes.slice(0, i + 1));
			}
		}
		return ContainerPath.default();
	}

	getScopeBoundaryNodeCount(): number {
		let count = 0;
		for (let i = this.nodes.length - 1; i > 0; i--) {
			if (this.nodes[i].type === constants.REPEAT) {
				count++;
			}
		}
		return count;
	}

	getScopeBoundarySubpathNodeCount(): number {
		let count = 0;
		for (let i = this.nodes.length - 1; i >= 0; i--) {
			if (
				this.nodes[i].type === constants.REPEAT ||
				this.nodes[i].type === constants.SURVEY
			) {
				break;
			}
			count++;
		}
		return count;
	}

	equals(other: ContainerPath): boolean {
		if (this.nodes.length !== other.nodes.length) return false;
		for (let i = 0; i < this.nodes.length; i++) {
			if (
				this.nodes[i].name !== other.nodes[i].name ||
				this.nodes[i].type !== other.nodes[i].type
			) {
				return false;
			}
		}
		return true;
	}

	key(): string {
		return this.nodes.map((n) => `${n.name}:${n.type}`).join("/");
	}
}

// --- Reference Source ---

interface ReferenceSource {
	path: ContainerPath;
	row: number;
	property_name: string | null;
	question_name: string | null;
}

// --- Entity References ---

interface EntityReferences {
	dataset_name: string;
	row_number: number;
	references: ReferenceSource[];
}

// --- Allocation Request ---

interface AllocationRequest {
	scope_path: ContainerPath;
	dataset_name: string;
	requested_path: ContainerPath;
	requested_path_length: number;
	entity_row_number: number;
	saveto_lineages: Map<string, null>; // key = ContainerPath.key()
	saveto_lineage_paths: ContainerPath[];
}

// --- Pyxform reference extraction ---

const PYXFORM_REF_RE = /\$\{([^}]*)\}/g;

function extractPyxformReferences(value: string): string[] {
	const refs: string[] = [];
	PYXFORM_REF_RE.lastIndex = 0;
	let match: RegExpExecArray | null = PYXFORM_REF_RE.exec(value);
	while (match !== null) {
		refs.push(match[1]);
		match = PYXFORM_REF_RE.exec(value);
	}
	return refs;
}

// --- Entity declaration parsing ---

function validateDatasetName(
	datasetName: string | null | undefined,
	rowNumber: number,
): void {
	if (!datasetName) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the 'list_name' value is invalid. Entity lists must have a name.`,
		);
	}
	if (datasetName.startsWith(constants.ENTITIES_RESERVED_PREFIX)) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the 'dataset' value is invalid. Names used here must not begin with two underscores.`,
		);
	}
	if (datasetName.includes(".")) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the 'dataset' value is invalid. Names used here must not contain a period.`,
		);
	}
	if (!isXmlTag(datasetName)) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the 'dataset' value is invalid. Names must begin with a letter or underscore.`,
		);
	}
}

function getEntityDeclaration(
	row: Record<string, unknown>,
	rowNumber: number,
): Record<string, unknown> {
	// Check for unexpected columns
	const extra = Object.keys(row).filter((k) => !ENTITY_COLUMNS.has(k));
	if (extra.length > 0) {
		throw new PyXFormError(
			`[row : ${rowNumber - 1}] On the 'entities' sheet, one or more column names are invalid. The following column(s) are not supported by this version of pyxform: ${extra.map((k) => `'${k}'`).join(", ")}.`,
		);
	}

	const datasetName = (row.dataset ?? row.list_name ?? null) as string | null;
	const entityId = row.entity_id ?? null;
	const createIf = row.create_if ?? null;
	const updateIf = row.update_if ?? null;
	const label = row.label ?? null;

	validateDatasetName(datasetName, rowNumber);

	if (!entityId && updateIf) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the entity declaration is invalid. The entity list name '${datasetName}' does not have an 'entity_id' expression, but an 'entity_id' is required when updating entities. Updating entities is indicated by using 'entity_id' and/or 'update_if' expressions. Please either: add an 'entity_id' for this entity declaration, or to only create entities instead move the 'update_if' to 'create_if'.`,
		);
	}

	if (entityId && createIf && !updateIf) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the entity declaration is invalid. The entity list name '${datasetName}' does not have an 'update_if' expression, but an 'update_if' is required when upserting entities. Upserting entities is indicated by using 'create_if' and 'entity_id' expressions. Please either: add an 'update_if' for this entity declaration, or to only create entities instead remove the 'entity_id' expression.`,
		);
	}

	if (!entityId && !label) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'entities' sheet, the entity declaration is invalid. The entity list name '${datasetName}' does not have a label, but a 'label' is required when creating entities. Creating entities is indicated by using a 'create_if' expression, or by not using 'entity_id' expression. Please either: add a 'label' for this entity declaration, or to update entities instead provide an 'entity_id' (and optionally 'update_if') expression.`,
		);
	}

	// Collect variable references
	const variableReferences = new Set<string>();
	for (const column of [entityId, createIf, updateIf, label]) {
		if (column != null) {
			for (const ref of extractPyxformReferences(String(column))) {
				variableReferences.add(ref);
			}
		}
	}

	const entityChildren: Record<string, unknown>[] = [
		{
			[constants.NAME]: "dataset",
			type: "attribute",
			value: datasetName,
		},
	];
	const entity: Record<string, unknown> = {
		[constants.NAME]: constants.ENTITY,
		[constants.TYPE]: constants.ENTITY,
		[constants.CHILDREN]: entityChildren,
		__row_number: rowNumber,
		__variable_references: variableReferences,
	};

	const idAttrActions: Record<string, unknown>[] = [];
	const idAttrBind: Record<string, unknown> = {
		readonly: "true()",
		type: "string",
	};
	const idAttr: Record<string, unknown> = {
		[constants.NAME]: "id",
		type: "attribute",
		[constants.BIND]: idAttrBind,
		actions: idAttrActions,
	};

	// Create mode
	if (!entityId || createIf) {
		const createAttr: Record<string, unknown> = {
			[constants.NAME]: "create",
			type: "attribute",
			value: "1",
		};
		if (createIf) {
			createAttr[constants.BIND] = {
				calculate: createIf,
				readonly: "true()",
				type: "string",
			};
		}
		entityChildren.push(createAttr);

		if (!entityId) {
			idAttrActions.push({
				name: "setvalue",
				event: "odk-instance-first-load",
				value: "uuid()",
			});
		}
	}

	// Update mode
	if (entityId) {
		const updateAttr: Record<string, unknown> = {
			[constants.NAME]: "update",
			type: "attribute",
			value: "1",
		};
		if (updateIf) {
			updateAttr[constants.BIND] = {
				calculate: updateIf,
				readonly: "true()",
				type: "string",
			};
		}
		entityChildren.push(updateAttr);

		idAttrBind.calculate = entityId;

		const entityIdExpression = `instance('${datasetName}')/root/item[name=${entityId}]`;
		entityChildren.push(
			{
				[constants.NAME]: "baseVersion",
				type: "attribute",
				[constants.BIND]: {
					calculate: `${entityIdExpression}/__version`,
					readonly: "true()",
					type: "string",
				},
			},
			{
				[constants.NAME]: "trunkVersion",
				type: "attribute",
				[constants.BIND]: {
					calculate: `${entityIdExpression}/__trunkVersion`,
					readonly: "true()",
					type: "string",
				},
			},
			{
				[constants.NAME]: "branchId",
				type: "attribute",
				[constants.BIND]: {
					calculate: `${entityIdExpression}/__branchId`,
					readonly: "true()",
					type: "string",
				},
			},
		);
	}

	entityChildren.push(idAttr);

	if (label) {
		entityChildren.push({
			type: "label",
			[constants.NAME]: "label",
			[constants.BIND]: {
				calculate: label,
				readonly: "true()",
				type: "string",
			},
		});
	}

	return entity;
}

// --- Collect entity declarations ---

export function getEntityDeclarations(
	entitiesSheet: Record<string, unknown>[],
): Record<string, Record<string, unknown>> {
	const entities: Record<string, Record<string, unknown>> = {};
	for (let i = 0; i < entitiesSheet.length; i++) {
		const rowNumber = i + 2; // 1-based, after header
		const row = normalizeEntityRow(entitiesSheet[i]);
		const entity = getEntityDeclaration(row, rowNumber);
		const datasetName = (
			entity[constants.CHILDREN] as Record<string, unknown>[]
		).find((c: Record<string, unknown>) => c[constants.NAME] === "dataset")
			?.value as string;
		if (datasetName in entities) {
			throw new PyXFormError(
				`[row : ${rowNumber}] On the 'entities' sheet, the 'list_name' value is invalid. The 'list_name' column must not have any duplicate names.`,
			);
		}
		entities[datasetName] = entity;
	}
	return entities;
}

function normalizeEntityRow(
	row: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		// Map list_name to dataset
		if (k === "list_name") {
			result.dataset = v;
		} else {
			result[k] = v;
		}
	}
	return result;
}

// --- Get entity variable references ---

export function getEntityVariableReferences(
	entityDeclarations: Record<string, Record<string, unknown>>,
): Record<string, string[]> {
	const variableReferences: Record<string, string[]> = {};
	for (const [datasetName, declaration] of Object.entries(entityDeclarations)) {
		const references = declaration.__variable_references as
			| Set<string>
			| undefined;
		declaration.__variable_references = undefined;
		if (references) {
			for (const questionName of references) {
				if (!variableReferences[questionName]) {
					variableReferences[questionName] = [];
				}
				variableReferences[questionName].push(datasetName);
			}
		}
	}
	return variableReferences;
}

// --- Validate save_to ---

function validateSaveto(
	saveto: string | null,
	rowNumber: number,
	isContainerBegin: boolean,
	isContainerEnd: boolean,
	entityReferences: EntityReferences | null,
): void {
	if (!saveto) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. Names must begin with a letter or underscore.`,
		);
	}
	if (isContainerBegin || isContainerEnd) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. Groups and repeats can't be saved as entity properties. Either remove or move the save_to value in this row.`,
		);
	}
	if (saveto.toLowerCase() === "name" || saveto.toLowerCase() === "label") {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not be 'name' or 'label' (case-insensitive).`,
		);
	}
	if (saveto.startsWith(constants.ENTITIES_RESERVED_PREFIX)) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not begin with two underscores.`,
		);
	}
	if (!isXmlTag(saveto)) {
		throw new PyXFormError(
			`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. Names must begin with a letter or underscore.`,
		);
	}
	if (entityReferences) {
		for (const refSource of entityReferences.references) {
			if (refSource.property_name === saveto) {
				throw new PyXFormError(
					`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. The save_to property '${saveto}' is already assigned by row '${refSource.row}'. Either remove or change one of these duplicate save_to property names.`,
				);
			}
		}
	}
}

// --- Process entity references for a question ---

export function processEntityReferencesForQuestion(
	containerPath: ContainerPath,
	row: Record<string, unknown>,
	rowNumber: number,
	questionName: string,
	entityDeclarations: Record<string, Record<string, unknown>> | null,
	entityVariableReferences: Record<string, string[]> | null,
	entityReferencesByQuestion: Record<string, EntityReferences>,
	isContainerBegin: boolean,
	isContainerEnd: boolean,
): void {
	const saveto = (row[constants.BIND] as Record<string, unknown> | undefined)?.[
		constants.ENTITIES_SAVETO_NS
	] as string | undefined;
	if (saveto) {
		if (!entityDeclarations || Object.keys(entityDeclarations).length === 0) {
			throw new PyXFormError(
				`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. To save entity properties using the save_to column, add an entities sheet and declare an entity.`,
			);
		}

		const delimiterCount = (saveto.match(/#/g) || []).length;
		let datasetName: string;
		let actualSaveto: string;

		if (delimiterCount === 1) {
			[datasetName, actualSaveto] = saveto.split("#", 2);
			(row[constants.BIND] as Record<string, unknown>)[
				constants.ENTITIES_SAVETO_NS
			] = actualSaveto;
		} else if (delimiterCount > 1) {
			throw new PyXFormError(
				`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. A 'save_to' value must have at most one '#' delimiter character. Please check the spelling of this 'save_to' value.`,
			);
		} else {
			if (Object.keys(entityDeclarations).length > 1) {
				throw new PyXFormError(
					`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. When there is more than one entity declaration, 'save_to' names must be prefixed with the entity 'list_name' that the property belongs to. Please either: add the entity 'list_name' prefix separated with a '#' e.g. my_list#my_save_to (where 'my_list' is the entity 'list_name', and 'my_save_to' is the 'save_to' property name), or remove all but one entity declarations.`,
				);
			}
			datasetName = Object.keys(entityDeclarations)[0];
			actualSaveto = saveto;
		}

		if (!(datasetName in entityDeclarations)) {
			throw new PyXFormError(
				`[row : ${rowNumber}] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name '${datasetName}' was not found on the entities sheet.`,
			);
		}

		if (!entityReferencesByQuestion[datasetName]) {
			entityReferencesByQuestion[datasetName] = {
				dataset_name: datasetName,
				row_number: entityDeclarations[datasetName].__row_number as number,
				references: [],
			};
		}

		validateSaveto(
			actualSaveto,
			rowNumber,
			isContainerBegin,
			isContainerEnd,
			entityReferencesByQuestion[datasetName],
		);

		entityReferencesByQuestion[datasetName].references.push({
			path: containerPath,
			row: rowNumber,
			property_name: actualSaveto,
			question_name: null,
		});
	}

	if (entityVariableReferences && questionName in entityVariableReferences) {
		for (const datasetName of entityVariableReferences[questionName]) {
			if (!entityReferencesByQuestion[datasetName]) {
				entityReferencesByQuestion[datasetName] = {
					dataset_name: datasetName,
					row_number: (
						entityDeclarations as Record<string, Record<string, unknown>>
					)[datasetName].__row_number as number,
					references: [],
				};
			}
			entityReferencesByQuestion[datasetName].references.push({
				path: containerPath,
				row: rowNumber,
				property_name: null,
				question_name: questionName,
			});
		}
	}
}

// --- Validate entity label references ---

export function validateEntityLabelReferences(
	entityDeclarations: Record<string, Record<string, unknown>>,
	surveyQuestionNames: Set<string>,
): void {
	for (const [, entity] of Object.entries(entityDeclarations)) {
		const labelChild = (
			entity[constants.CHILDREN] as Record<string, unknown>[] | undefined
		)?.find(
			(c: Record<string, unknown>) =>
				c.type === "label" && c[constants.NAME] === "label",
		);
		const labelBind = labelChild?.[constants.BIND] as
			| Record<string, string>
			| undefined;
		if (labelBind?.calculate) {
			const refs = extractPyxformReferences(labelBind.calculate);
			for (const ref of refs) {
				if (!surveyQuestionNames.has(ref)) {
					throw new PyXFormError(
						`[row : ${entity.__row_number}] On the 'entities' sheet, the 'label' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${ref}'.`,
					);
				}
			}
		}
	}
}

// --- Get allocation request ---

function getEntityAllocationRequest(
	entityRefs: EntityReferences,
): AllocationRequest {
	let deepestScopeBoundary: ContainerPath | null = null;
	let deepestScopeBoundaryNodeCount: number | null = null;
	let deepestScopeRef: ReferenceSource | null = null;
	let deepestContainerRef: ReferenceSource | null = null;
	let deepestContainerRefSubpathNodeCount: number | null = null;
	let deepestSaveto: ReferenceSource | null = null;
	let deepestSavetoSubpathNodeCount: number | null = null;
	const savetoLineages = new Map<string, null>();
	const savetoLineagePaths: ContainerPath[] = [];
	const boundaries: [ReferenceSource, ContainerPath, number][] = [];

	for (const ref of entityRefs.references) {
		const refSubpathLength = ref.path.getScopeBoundarySubpathNodeCount();
		const boundary = ref.path.getScopeBoundary();
		const boundaryLength = boundary.getScopeBoundaryNodeCount();

		if (
			deepestScopeBoundary === null ||
			boundaryLength > (deepestScopeBoundaryNodeCount as number)
		) {
			if (!deepestScopeBoundary || !boundary.equals(deepestScopeBoundary)) {
				deepestContainerRef = ref;
				deepestContainerRefSubpathNodeCount = refSubpathLength;
				if (ref.property_name !== null) {
					deepestSaveto = ref;
					deepestSavetoSubpathNodeCount = refSubpathLength;
				}
			}
			deepestScopeBoundary = boundary;
			deepestScopeBoundaryNodeCount = boundaryLength;
			deepestScopeRef = ref;
		}

		boundaries.push([ref, boundary, boundary.nodes.length]);

		if (
			deepestContainerRef === null ||
			(boundary.equals(deepestScopeBoundary as ContainerPath) &&
				refSubpathLength > (deepestContainerRefSubpathNodeCount as number))
		) {
			deepestContainerRef = ref;
			deepestContainerRefSubpathNodeCount = refSubpathLength;
		}

		if (ref.property_name !== null) {
			const key = ref.path.key();
			if (!savetoLineages.has(key)) {
				savetoLineages.set(key, null);
				savetoLineagePaths.push(ref.path);
			}
			if (
				deepestSaveto === null ||
				(boundary.equals(deepestScopeBoundary as ContainerPath) &&
					refSubpathLength > (deepestSavetoSubpathNodeCount as number))
			) {
				deepestSaveto = ref;
				deepestSavetoSubpathNodeCount = refSubpathLength;
			}
		}
	}

	let requestedPath: ContainerPath;
	if (deepestSaveto) {
		requestedPath = deepestSaveto.path;
	} else {
		requestedPath = (deepestContainerRef as ReferenceSource).path;
	}

	if (savetoLineages.size > 0) {
		const pathArrays = savetoLineagePaths;
		const minLen = Math.min(...pathArrays.map((p) => p.nodes.length));
		const anyRef = pathArrays[0];
		let commonPath = new ContainerPath(anyRef.nodes.slice(0, minLen));

		if (pathArrays.length > 1) {
			for (let i = 0; i < minLen; i++) {
				const target = anyRef.nodes[i];
				let mismatch = false;
				for (const p of pathArrays) {
					if (
						p.nodes[i].name !== target.name ||
						p.nodes[i].type !== target.type
					) {
						commonPath = new ContainerPath(anyRef.nodes.slice(0, i));
						mismatch = true;
						break;
					}
				}
				if (mismatch) break;
			}

			const a = (deepestSaveto as ReferenceSource).path.getScopeBoundary();
			const b = commonPath;
			requestedPath =
				a.getScopeBoundaryNodeCount() > b.getScopeBoundaryNodeCount() ||
				(a.getScopeBoundaryNodeCount() === b.getScopeBoundaryNodeCount() &&
					a.getScopeBoundarySubpathNodeCount() >=
						b.getScopeBoundarySubpathNodeCount())
					? a
					: b;
		} else {
			requestedPath = commonPath;
		}
	}

	const requestedPathScopeBoundary = requestedPath.getScopeBoundary();

	// Validate each reference against the request constraints
	for (const [refSource, scopeBoundary, scopeBoundaryLength] of boundaries) {
		const deepestPrefix = (deepestScopeBoundary as ContainerPath).nodes.slice(
			0,
			scopeBoundaryLength,
		);
		let prefixMatch = scopeBoundary.nodes.length <= deepestPrefix.length;
		if (prefixMatch) {
			for (let i = 0; i < scopeBoundary.nodes.length; i++) {
				if (
					deepestPrefix[i].name !== scopeBoundary.nodes[i].name ||
					deepestPrefix[i].type !== scopeBoundary.nodes[i].type
				) {
					prefixMatch = false;
					break;
				}
			}
		} else {
			prefixMatch = false;
		}

		if (!prefixMatch) {
			if (refSource.property_name !== null) {
				throw new PyXFormError(
					`[row : ${refSource.row}] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name '${entityRefs.dataset_name}' has a reference in container scope '${(deepestScopeRef as ReferenceSource).path.pathAsStr()}' which is not compatible with this 'save_to' reference in scope '${refSource.path.pathAsStr()}'.`,
				);
			}
			throw new PyXFormError(
				`[row : ${entityRefs.row_number}] On the 'entities' sheet, the entity declaration is invalid. The entity list name '${entityRefs.dataset_name}' has a reference in container scope '${(deepestScopeRef as ReferenceSource).path.pathAsStr()}' which is not compatible with the variable reference to '${refSource.question_name}' in scope '${refSource.path.pathAsStr()}'.`,
			);
		}

		if (
			refSource.property_name !== null &&
			!requestedPathScopeBoundary.equals(scopeBoundary)
		) {
			throw new PyXFormError(
				`[row : ${refSource.row}] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name '${entityRefs.dataset_name}' has a reference in container scope '${requestedPath.pathAsStr()}' which is not compatible with this 'save_to' reference in scope '${refSource.path.pathAsStr()}'.`,
			);
		}
	}

	return {
		scope_path: deepestScopeBoundary as ContainerPath,
		dataset_name: entityRefs.dataset_name,
		requested_path: requestedPath,
		requested_path_length: requestedPath.nodes.length,
		entity_row_number: entityRefs.row_number,
		saveto_lineages: savetoLineages,
		saveto_lineage_paths: savetoLineagePaths,
	};
}

// --- Allocate entities to containers ---

function allocateEntitiesToContainers(
	entityDeclarations: Record<string, Record<string, unknown>>,
	entityReferencesByQuestion: Record<string, EntityReferences>,
): Map<string, string> {
	const allocations = new Map<string, string>(); // key = ContainerPath.key(), value = dataset_name
	const scopePaths = new Map<string, AllocationRequest[]>(); // key = scope ContainerPath.key()
	const surveyPath = ContainerPath.default();

	// Group requests by container scope
	for (const entityRefs of Object.values(entityReferencesByQuestion)) {
		const req = getEntityAllocationRequest(entityRefs);
		const key = req.scope_path.key();
		let scopeList = scopePaths.get(key);
		if (!scopeList) {
			scopeList = [];
			scopePaths.set(key, scopeList);
		}
		scopeList.push(req);
	}

	// For unreferenced declarations, default to the survey scope
	for (const [datasetName, declaration] of Object.entries(entityDeclarations)) {
		if (!(datasetName in entityReferencesByQuestion)) {
			const key = surveyPath.key();
			let scopeList = scopePaths.get(key);
			if (!scopeList) {
				scopeList = [];
				scopePaths.set(key, scopeList);
			}
			scopeList.push({
				scope_path: surveyPath,
				dataset_name: datasetName,
				requested_path: surveyPath,
				requested_path_length: 1,
				entity_row_number: declaration.__row_number as number,
				saveto_lineages: new Map(),
				saveto_lineage_paths: [],
			});
		}
	}

	// If there's only one entity, and its scope is the survey, just allocate to survey
	if (scopePaths.size === 1) {
		const [scopeKey, requests] = scopePaths.entries().next().value as [
			string,
			AllocationRequest[],
		];
		if (scopeKey === surveyPath.key() && requests.length === 1) {
			allocations.set(surveyPath.key(), requests[0].dataset_name);
			return allocations;
		}
	}

	// Assign the requests to available allowed container nodes
	const reservedPaths = new Map<string, string>();
	for (const [, requests] of scopePaths) {
		const scopePath = requests[0].scope_path;
		const scopePathDepthLimit = scopePath.nodes.length - 1;

		for (const req of requests.sort(
			(a, b) => a.entity_row_number - b.entity_row_number,
		)) {
			let conflictDataset: string | null = null;

			for (
				let depth = req.requested_path_length;
				depth > scopePathDepthLimit;
				depth--
			) {
				const currentPath = new ContainerPath(
					req.requested_path.nodes.slice(0, depth),
				);
				const currentKey = currentPath.key();

				conflictDataset =
					allocations.get(currentKey) ?? reservedPaths.get(currentKey) ?? null;
				if (conflictDataset !== null) {
					// Check if any saveto lineage is already reserved by another
					let conflictDatasetSaveto: string | null = null;
					for (const lineagePath of req.saveto_lineage_paths) {
						const reserved = reservedPaths.get(lineagePath.key());
						if (reserved) {
							conflictDatasetSaveto = reserved;
							break;
						}
					}
					if (conflictDatasetSaveto) {
						conflictDataset = conflictDatasetSaveto;
						break;
					}
				} else {
					allocations.set(currentKey, req.dataset_name);
					reservedPaths.set(currentKey, req.dataset_name);
					// Reserve all nodes between each lineage leaf and the assigned node
					for (const lineagePath of req.saveto_lineage_paths) {
						for (
							let i = lineagePath.nodes.length;
							i > currentPath.nodes.length - 1;
							i--
						) {
							const subPath = new ContainerPath(lineagePath.nodes.slice(0, i));
							reservedPaths.set(subPath.key(), req.dataset_name);
						}
					}
					conflictDataset = null;
					break;
				}
			}

			if (conflictDataset !== null) {
				throw new PyXFormError(
					`[row : ${req.entity_row_number}] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '${scopePath.pathAsStr()}', which has been allocated to the entity on row '${entityDeclarations[conflictDataset].__row_number}'.`,
				);
			}
		}
	}

	return allocations;
}

// --- Inject entities into JSON ---

function getSearchPrefixes(allocations: Map<string, string>): Set<string> {
	const active = new Set<string>();
	for (const pathKey of allocations.keys()) {
		// Add every prefix of the path
		const parts = pathKey.split("/");
		for (let i = 1; i <= parts.length; i++) {
			active.add(parts.slice(0, i).join("/"));
		}
	}
	return active;
}

function injectEntitiesIntoJson(
	jsonNode: Record<string, unknown>,
	allocations: Map<string, string>,
	entityDeclarations: Record<string, Record<string, unknown>>,
	currentPath: ContainerPath,
	searchPrefixes: Set<string>,
	entitiesAllocated: Set<string> = new Set(),
	hasRepeatAncestor = false,
): Record<string, unknown> {
	const datasetName = allocations.get(currentPath.key());
	if (datasetName && !entitiesAllocated.has(datasetName)) {
		const entityDecl = entityDeclarations[datasetName];

		if (hasRepeatAncestor) {
			const idAttr = (
				entityDecl[constants.CHILDREN] as Record<string, unknown>[]
			).find((c: Record<string, unknown>) => c[constants.NAME] === "id");
			const idAttrActions = idAttr?.actions as
				| Record<string, unknown>[]
				| undefined;
			if (idAttr && idAttrActions?.length === 1) {
				idAttrActions.push({
					name: "setvalue",
					event: "odk-new-repeat",
					value: idAttrActions[0].value,
				});
			}
		}

		if (!jsonNode[constants.CHILDREN]) {
			jsonNode[constants.CHILDREN] = [];
		}
		(jsonNode[constants.CHILDREN] as Record<string, unknown>[]).push(
			getMetaGroup([entityDecl], true),
		);
		entitiesAllocated.add(datasetName);
	}

	for (const child of (jsonNode[constants.CHILDREN] as
		| Record<string, unknown>[]
		| undefined) ?? []) {
		const childName = child[constants.NAME] as string | undefined;
		const childType = child[constants.TYPE] as string | undefined;
		if (
			childName &&
			(childType === constants.GROUP || childType === constants.REPEAT)
		) {
			const childPath = new ContainerPath([
				...currentPath.nodes,
				{ name: childName, type: childType },
			]);
			let childHasRepeatAncestor = hasRepeatAncestor;
			if (!childHasRepeatAncestor && childType === constants.REPEAT) {
				childHasRepeatAncestor = true;
			}
			if (searchPrefixes.has(childPath.key())) {
				injectEntitiesIntoJson(
					child,
					allocations,
					entityDeclarations,
					childPath,
					searchPrefixes,
					entitiesAllocated,
					childHasRepeatAncestor,
				);
			}
		}
	}

	return jsonNode;
}

// --- Apply entities declarations ---

export function applyEntitiesDeclarations(
	entityDeclarations: Record<string, Record<string, unknown>>,
	entityReferencesByQuestion: Record<string, EntityReferences>,
	jsonDict: Record<string, unknown>,
): void {
	const allocations = allocateEntitiesToContainers(
		entityDeclarations,
		entityReferencesByQuestion,
	);

	injectEntitiesIntoJson(
		jsonDict,
		allocations,
		entityDeclarations,
		ContainerPath.default(),
		getSearchPrefixes(allocations),
		new Set(),
		jsonDict[constants.TYPE] === constants.REPEAT,
	);

	// Determine entity version
	let hasRepeatScope = false;
	for (const pathKey of allocations.keys()) {
		const parts = pathKey.split("/");
		// Check if any node after the root is a repeat
		// (boundary node count > 0)
		const path = ContainerPath.default(); // just need to check
		// Actually, we just check if there are multiple entities or any allocation is in a repeat
		for (const part of parts) {
			if (part.includes(`:${constants.REPEAT}`)) {
				hasRepeatScope = true;
				break;
			}
		}
	}

	if (Object.keys(entityDeclarations).length > 1 || hasRepeatScope) {
		jsonDict[constants.ENTITY_VERSION] = "2025.1.0";
	} else {
		jsonDict[constants.ENTITY_VERSION] = "2024.1.0";
	}
}

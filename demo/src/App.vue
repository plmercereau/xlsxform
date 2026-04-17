<script setup lang="ts">
import { OdkWebForm } from "@getodk/web-forms";
import { ref } from "vue";
import * as XLSX from "xlsx";
import { type ConvertResult, convert } from "xlsxform";

const formXml = ref<string | null>(null);
const error = ref<string | null>(null);
const warnings = ref<string[]>([]);
const fileName = ref<string | null>(null);
const loading = ref(false);

function isCsv(name: string): boolean {
	return name.toLowerCase().endsWith(".csv");
}

async function handleFile(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;

	formXml.value = null;
	error.value = null;
	warnings.value = [];
	fileName.value = file.name;
	loading.value = true;

	try {
		let result: ConvertResult;
		if (isCsv(file.name)) {
			const text = await file.text();
			result = convert({
				xlsform: text,
				fileType: "csv",
				prettyPrint: true,
			});
		} else {
			const buffer = await file.arrayBuffer();
			const wb = XLSX.read(buffer, { cellDates: true });
			const formName = file.name.replace(/\.[^.]+$/, "");
			result = convert({ xlsform: wb, formName, prettyPrint: true });
		}
		formXml.value = result.xform;
		warnings.value = result.warnings;
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e);
	} finally {
		loading.value = false;
	}
}

const fileInputRef = ref<HTMLInputElement | null>(null);

function uploadAnother() {
	if (fileInputRef.value) {
		fileInputRef.value.value = "";
		fileInputRef.value.click();
	}
}

async function fetchFormAttachment(_url: string): Promise<Response> {
	return new Response(null, { status: 404 });
}
</script>

<template>
	<div class="app">
		<header>
			<h1>xlsxform Demo</h1>
			<p>
				Upload an XLSForm to preview it as a live ODK web form.
				Everything runs in your browser — no server, no data uploaded.
			</p>
			<p>
				<a href="https://github.com/plmercereau/xlsxform" target="_blank" rel="noopener">GitHub</a>
			</p>
		</header>

		<div v-if="!formXml" class="upload-section">
			<label class="upload-label">
				<input
					type="file"
					accept=".xls,.xlsx,.xlsm,.csv"
					@change="handleFile"
					:disabled="loading"
				/>
				<span v-if="loading">Converting...</span>
				<span v-else>Choose an XLSForm file (.xls, .xlsx, .xlsm, .csv)</span>
			</label>

			<div v-if="error" class="error">
				<strong>Conversion error:</strong>
				<pre>{{ error }}</pre>
			</div>

			<div v-if="warnings.length" class="warnings">
				<strong>Warnings:</strong>
				<ul>
					<li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
				</ul>
			</div>
		</div>

		<div v-else class="form-section">
			<div class="form-toolbar">
				<span>{{ fileName }}</span>
				<input
					ref="fileInputRef"
					type="file"
					accept=".xls,.xlsx,.xlsm,.csv"
					style="display: none"
					@change="handleFile"
				/>
				<button @click="uploadAnother">Upload another form</button>
			</div>

			<div v-if="warnings.length" class="warnings">
				<strong>Warnings:</strong>
				<ul>
					<li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
				</ul>
			</div>

			<OdkWebForm
				:form-xml="formXml"
				:fetch-form-attachment="fetchFormAttachment"
			/>
		</div>
	</div>
</template>

<style>
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

body {
	font-family: system-ui, -apple-system, sans-serif;
	background: #f5f5f5;
	color: #333;
}

.app {
	max-width: 960px;
	margin: 0 auto;
	padding: 2rem 1rem;
}

header {
	margin-bottom: 2rem;
}

header h1 {
	font-size: 1.5rem;
	margin-bottom: 0.5rem;
}

header p {
	color: #666;
}

.upload-section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.upload-label {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	padding: 3rem 2rem;
	border: 2px dashed #ccc;
	border-radius: 8px;
	background: #fff;
	cursor: pointer;
	transition: border-color 0.2s;
}

.upload-label:hover {
	border-color: #888;
}

.upload-label input {
	display: none;
}

.upload-label span {
	color: #666;
	font-size: 1rem;
}

.error {
	background: #fef2f2;
	border: 1px solid #fca5a5;
	border-radius: 8px;
	padding: 1rem;
}

.error pre {
	margin-top: 0.5rem;
	white-space: pre-wrap;
	font-size: 0.875rem;
}

.warnings {
	background: #fffbeb;
	border: 1px solid #fcd34d;
	border-radius: 8px;
	padding: 1rem;
}

.warnings ul {
	margin-top: 0.5rem;
	padding-left: 1.5rem;
}

.form-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1rem;
	padding: 0.75rem 1rem;
	background: #fff;
	border-radius: 8px;
	border: 1px solid #e5e7eb;
}

.form-toolbar button {
	padding: 0.5rem 1rem;
	border: 1px solid #d1d5db;
	border-radius: 6px;
	background: #fff;
	cursor: pointer;
	font-size: 0.875rem;
}

.form-toolbar button:hover {
	background: #f9fafb;
}

.form-section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}
</style>

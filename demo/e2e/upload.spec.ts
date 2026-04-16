import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(
	__dirname,
	"..",
	"..",
	"pyxform",
	"tests",
	"example_xls",
);

const xlsFiles = [
	"yes_or_no_question.xls",
	"text_and_integer.xls",
	"gps.xls",
	"group.xls",
	"specify_other.xls",
	"case_insensitivity.xls",
	"calculate.xls",
	"default_time_demo.xls",
	"tutorial.xls",
	"xml_escaping.xls",
	"widgets.xls",
];

const xlsxFiles = [
	"group.xlsx",
	"text_and_integer.xlsx",
	"yes_or_no_question.xlsx",
	"flat_xlsform_test.xlsx",
	"case_insensitivity.xlsx",
	"attribute_columns_test.xlsx",
	"choice_filter_test.xlsx",
	"or_other.xlsx",
	"xlsform_spec_test.xlsx",
	"survey_no_name.xlsx",
];

const csvFiles = [
	"yes_or_no_question.csv",
	"text_and_integer.csv",
	"group.csv",
	"case_insensitivity.csv",
];

for (const file of [...xlsFiles, ...xlsxFiles, ...csvFiles]) {
	test(`upload ${file} converts without error`, async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("h1")).toHaveText("jsxform Demo");

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles(path.join(FIXTURES, file));

		// Should show the form (OdkWebForm) or at least the toolbar with file name, not an error
		await expect(page.locator(".form-toolbar")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.locator(".form-toolbar")).toContainText(file);

		// No conversion error should be shown
		await expect(page.locator(".error")).not.toBeVisible();
	});
}

test("upload invalid file shows error", async ({ page }) => {
	await page.goto("/");

	// Create a fake file with bad content
	const fileInput = page.locator('input[type="file"]');
	await fileInput.setInputFiles({
		name: "bad.xlsx",
		mimeType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		buffer: Buffer.from("not a real xlsx"),
	});

	// Should show an error
	await expect(page.locator(".error")).toBeVisible({ timeout: 10_000 });
});

/// <reference types="vite/client" />

declare module "*.vue" {
	import type { DefineComponent } from "vue";
	const component: DefineComponent<
		Record<string, unknown>,
		Record<string, unknown>,
		unknown
	>;
	export default component;
}

declare module "@getodk/web-forms" {
	import type { DefineComponent, Plugin } from "vue";

	export const OdkWebForm: DefineComponent<{
		formXml: string;
		fetchFormAttachment: (url: string) => Promise<Response>;
	}>;

	export const webFormsPlugin: Plugin;

	export const POST_SUBMIT__NEW_INSTANCE: symbol;
}

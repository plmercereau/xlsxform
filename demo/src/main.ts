import { webFormsPlugin } from "@getodk/web-forms";
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);
app.use(webFormsPlugin);
app.mount("#app");

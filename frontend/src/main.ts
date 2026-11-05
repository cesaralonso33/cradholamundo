import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { useAuth } from "./auth";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import "primeicons/primeicons.css";
import "./style.css";

const app = createApp(App).use(router).use(PrimeVue, {
  theme: { preset: Aura, options: { prefix: "p", darkModeSelector: false } },
});
const auth = useAuth();
auth.init().finally(() => {
  app.mount("#app");
});

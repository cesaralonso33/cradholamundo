import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { useAuth } from "./auth";
import "./style.css";

const app = createApp(App).use(router);
const auth = useAuth();
auth.init().finally(() => {
  app.mount("#app");
});

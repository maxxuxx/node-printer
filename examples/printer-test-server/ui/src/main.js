import App from "./App.svelte";
import "./styles.css";
import { mount } from "svelte";

// Svelte 앱을 기존 app 컨테이너에 마운트
const app = mount(App, {
  target: document.getElementById("app")
});

export default app;

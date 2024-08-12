import { render } from "preact";
import { LocationProvider, Router, Route } from "preact-iso";

import { Header } from "./components/Header.jsx";

import { Home } from "./pages/Home/index.jsx";
import { Tasks } from "./pages/Tasks/index.jsx";
import { Processes } from "./pages/Processes/index.jsx";
import { NotFound } from "./pages/_404.jsx";

import "./css/fonts.css";
import "./css/form.css";
import "./css/vars.css";
import "./css/layout.css";
import "./css/components.css";
import "./css/main.css";

export function App() {
  return (
    <LocationProvider>
      <Header />
      <Router>
        <Route path="/" component={Home} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/processes" component={Processes} />
        <Route path="/processes/:id" component={Processes} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}

render(<App />, document.getElementById("app"));

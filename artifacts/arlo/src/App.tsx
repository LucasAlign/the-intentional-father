import { Switch, Route, Router as WouterRouter } from "wouter";
import Home from "@/pages/Home";
import Interview from "@/pages/Interview";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";
import PrototypePriorityStatus from "@/pages/prototype-priority-status";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/interview" component={Interview} />
      <Route path="/admin" component={Admin} />
      {/* PROTOTYPE — throwaway, exploring issue #9. Remove before merging to main. */}
      {import.meta.env.DEV && <Route path="/prototype/priority-status" component={PrototypePriorityStatus} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;

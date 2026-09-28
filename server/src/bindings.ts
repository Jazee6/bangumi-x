import type { AnonymousBindings } from "./anonymous-routes";
import type { AuthBindings } from "./auth";

export interface Bindings extends AnonymousBindings, AuthBindings {}

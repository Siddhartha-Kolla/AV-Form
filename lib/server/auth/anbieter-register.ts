import "server-only";
import { registriereAnbieter } from "./anbieter.ts";
import { passwortAnbieter } from "./anbieter-passwort.ts";

// Hier weitere Anbieter eintragen, zum Beispiel registriereAnbieter(oidcSchule).
registriereAnbieter(passwortAnbieter);

import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

// --- Environment shims: a DOM for rendering, a fetch that reads locale JSON ---

const localePath = fileURLToPath(new URL("../locales/pt-PT.json", import.meta.url));

const dom = new JSDOM('<!doctype html><html><body><div id="form-root"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.fetch = async (url) => {
  if (String(url).endsWith("locales/pt-PT.json")) {
    return { json: async () => JSON.parse(readFileSync(localePath, "utf8")) };
  }
  throw new Error(`unexpected fetch: ${url}`);
};

// Imported after the shims exist (engine touches `document` only inside functions,
// but init()/loadLocale need `fetch`).
const {
  state,
  init,
  renderStep,
  nextVisibleStep,
  prevVisibleStep,
  currentStepIndex,
} = await import("../js/formEngine.js");

before(async () => {
  await init(); // loads the locale so t() resolves real strings
});

beforeEach(() => {
  state.answers = {};
  state.currentStepId = "dados_basicos";
});

const root = () => document.getElementById("form-root");
const title = () => root().querySelector("h1").textContent;
const buttonByText = (text) =>
  [...root().querySelectorAll("button")].find((b) => b.textContent === text);

// --- Pure navigation --------------------------------------------------------

test("forward through the general-training branch", () => {
  state.answers = { objetivo_treino: ["perda_peso"] };
  assert.equal(nextVisibleStep(state.answers, "dados_basicos").id, "treino_geral");
  assert.equal(nextVisibleStep(state.answers, "treino_geral"), null);
});

test("forward through the gestação branch", () => {
  state.answers = { objetivo_treino: ["gestacao_posparto"], fase: "gestacao" };
  assert.equal(nextVisibleStep(state.answers, "dados_basicos").id, "fase_gestacao");
  assert.equal(nextVisibleStep(state.answers, "fase_gestacao").id, "gestacao");
  assert.equal(nextVisibleStep(state.answers, "gestacao"), null);
});

test("back from the fase splitter returns to dados_basicos", () => {
  state.answers = { objetivo_treino: ["gestacao_posparto"] };
  assert.equal(prevVisibleStep(state.answers, "fase_gestacao").id, "dados_basicos");
});

test("prevVisibleStep on the first step is null", () => {
  assert.equal(prevVisibleStep({}, "dados_basicos"), null);
});

test("changing objetivo away from gestação reroutes forward to treino_geral", () => {
  // User walked into the gestação branch, went back, and cleared the goal.
  state.answers = { objetivo_treino: [] };
  assert.equal(nextVisibleStep(state.answers, "dados_basicos").id, "treino_geral");
});

test("currentStepIndex clamps when the step is no longer visible", () => {
  // fase_gestacao is not visible without the gestação goal.
  assert.equal(currentStepIndex({}, "fase_gestacao"), 0);
});

// --- Rendering ------------------------------------------------------------------

test("renders the first step's title and field controls", () => {
  renderStep();
  assert.equal(title(), "Dados básicos");
  assert.equal(root().querySelector("input#nome").type, "text");
  assert.equal(root().querySelector("input#email").type, "email");
  assert.equal(root().querySelector("input#contacto_telefonico").type, "tel");
  // multi-checkbox group
  assert.ok(root().querySelectorAll('input[type="checkbox"][name="objetivo_treino"]').length > 1);
  // no "Voltar" on the first step, "Seguinte" present
  assert.equal(buttonByText("Voltar"), undefined);
  assert.ok(buttonByText("Seguinte"));
});

test("radio group renders one control per option, reflecting the stored answer", () => {
  state.answers = { objetivo_treino: ["perda_peso"], onde_treina: "ginasio" };
  state.currentStepId = "treino_geral";
  renderStep();
  const radios = root().querySelectorAll('input[type="radio"][name="onde_treina"]');
  assert.equal(radios.length, 2);
  const checked = [...radios].find((r) => r.checked);
  assert.equal(checked.value, "ginasio");
});

test("single checkbox field (aviso_contacto) renders one control", () => {
  state.answers = { objetivo_treino: ["gestacao_posparto"], fase: "gestacao" };
  state.currentStepId = "gestacao";
  renderStep();
  const boxes = root().querySelectorAll('input[type="checkbox"][name="aviso_contacto"]');
  assert.equal(boxes.length, 1);
});

test("field-level condition: como_chegou_outro appears only after 'outro' is checked", () => {
  renderStep();
  assert.equal(root().querySelector("input#como_chegou_outro"), null);

  const outro = [...root().querySelectorAll('input[name="como_chegou"]')].find(
    (i) => i.value === "outro",
  );
  outro.checked = true;
  outro.dispatchEvent(new dom.window.Event("change"));

  assert.ok(root().querySelector("input#como_chegou_outro"));
  assert.deepEqual(state.answers.como_chegou, ["outro"]);
});

test("clicking Seguinte advances to the next step with no reload", () => {
  state.answers = { objetivo_treino: ["perda_peso"] };
  renderStep();
  assert.equal(title(), "Dados básicos");
  buttonByText("Seguinte").click();
  assert.equal(title(), "Treino geral");
  assert.equal(state.currentStepId, "treino_geral");
});

test("Voltar returns to the previous visible step, answers intact", () => {
  state.answers = { nome: "Ana", objetivo_treino: ["perda_peso"] };
  state.currentStepId = "treino_geral";
  renderStep();
  buttonByText("Voltar").click();
  assert.equal(title(), "Dados básicos");
  assert.equal(root().querySelector("input#nome").value, "Ana");
});

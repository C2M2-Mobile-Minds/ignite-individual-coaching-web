import test, { before, beforeEach, afterEach } from "node:test";
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
  renderField,
  renderConfirmation,
  goSubmit,
  nextVisibleStep,
  prevVisibleStep,
  currentStepIndex,
  isFieldFilled,
  validateStep,
} = await import("../js/formEngine.js");

const { steps } = await import("../js/formSchema.js");
const stepById = (id) => steps.find((s) => s.id === id);

before(async () => {
  await init(); // loads the locale so t() resolves real strings
});

beforeEach(() => {
  state.answers = {};
  state.currentStepId = "dados_basicos";
  state.errors = new Set();
});

const root = () => document.getElementById("form-root");
const title = () => root().querySelector("h1").textContent;
const buttonByText = (text) =>
  [...root().querySelectorAll("button")].find((b) => b.textContent === text);

// --- Pure navigation --------------------------------------------------------

test("forward through the general-training branch", () => {
  state.answers = { objetivo_treino: ["ganho_massa"] };
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
  state.answers = { objetivo_treino: ["ganho_massa"], onde_treina: "ginasio" };
  state.currentStepId = "treino_geral";
  renderStep();
  const radios = root().querySelectorAll('input[type="radio"][name="onde_treina"]');
  assert.equal(radios.length, 2);
  const checked = [...radios].find((r) => r.checked);
  assert.equal(checked.value, "ginasio");
});

test("treino_geral renders all five fields with resolved (non-key) labels", () => {
  state.answers = { objetivo_treino: ["ganho_massa"] };
  state.currentStepId = "treino_geral";
  renderStep();
  assert.equal(title(), "Treino geral");
  for (const id of ["onde_treina", "dificuldade_atual", "frequencia_treino", "orientacao_nutricional", "comprometimento"]) {
    assert.ok(root().querySelector(`#${id}, [name="${id}"]`), `no control rendered for ${id}`);
  }
  assert.equal(root().querySelector("input#dificuldade_atual").type, "text");
  assert.equal(root().querySelectorAll('input[type="radio"][name="frequencia_treino"]').length, 3);
  assert.ok(!root().textContent.includes("form.field."), "unresolved locale key rendered");
});

test("treino_geral validation: 5 required errors when empty, none when filled", () => {
  const step = stepById("treino_geral");
  assert.deepEqual(
    validateStep(step, {}).map((e) => e.messageKey),
    Array(5).fill("validation.required"),
  );
  const filled = {
    onde_treina: "casa",
    dificuldade_atual: "Falta de tempo",
    frequencia_treino: "2_3x",
    orientacao_nutricional: "sim",
    comprometimento: "sim",
  };
  assert.deepEqual(validateStep(step, filled), []);
});

test("fase_gestacao renders the single radio with resolved labels", () => {
  state.answers = { objetivo_treino: ["gestacao_posparto"] };
  state.currentStepId = "fase_gestacao";
  renderStep();
  assert.equal(title(), "Em que fase te encontras");
  const radios = root().querySelectorAll('input[type="radio"][name="fase"]');
  assert.equal(radios.length, 2);
  assert.deepEqual([...radios].map((r) => r.value), ["gestacao", "posparto"]);
  assert.ok(root().textContent.includes("Gestação"));
  assert.ok(root().textContent.includes("Pós-parto"));
  assert.ok(!root().textContent.includes("form.field."), "unresolved locale key rendered");
});

test("fase_gestacao validation: 1 required error when empty, none when filled", () => {
  const step = stepById("fase_gestacao");
  assert.deepEqual(
    validateStep(step, {}).map((e) => e.messageKey),
    ["validation.required"],
  );
  assert.deepEqual(validateStep(step, { fase: "gestacao" }), []);
});

test("bare checkbox field (no options) renders a single box wired to a boolean answer", () => {
  state.answers = {};
  const field = { id: "_bare", type: "checkbox", required: true, labelKey: "form.nav.next" };
  const node = renderField(field);
  const boxes = node.querySelectorAll('input[type="checkbox"]');
  assert.equal(boxes.length, 1);
  boxes[0].checked = true;
  boxes[0].dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.answers._bare, true);
});

test("posparto renders all eight controls plus the read-only closing note", () => {
  state.answers = { objetivo_treino: ["gestacao_posparto"], fase: "posparto" };
  state.currentStepId = "posparto";
  renderStep();
  assert.equal(title(), "Pós-parto");
  for (const id of [
    "tipo_parto", "complicacoes_parto", "acomp_exercicio_gravidez", "acomp_fisio_gravidez",
    "tempo_posparto", "primeira_consulta_posparto", "preferencia_local", "disponibilidade_horario",
  ]) {
    assert.ok(root().querySelector(`#${id}, [name="${id}"]`), `no control rendered for ${id}`);
  }
  const note = root().querySelector("p.note");
  assert.ok(note);
  assert.ok(note.textContent.startsWith("Será contactada por parte da treinadora"));
  assert.equal(root().querySelectorAll('[name="nota_contacto"]').length, 0);
  assert.ok(!root().textContent.includes("form.field."), "unresolved locale key rendered");
});

test("posparto validation: 8 required errors when empty, none when filled; note never blocks", () => {
  const step = stepById("posparto");
  assert.deepEqual(
    validateStep(step, {}).map((e) => e.messageKey),
    Array(8).fill("validation.required"),
  );
  const filled = {
    tipo_parto: "normal",
    complicacoes_parto: "Nenhuma",
    acomp_exercicio_gravidez: "sim",
    acomp_fisio_gravidez: "nao",
    tempo_posparto: "3 meses",
    primeira_consulta_posparto: "sim",
    preferencia_local: "templo_fitness",
    disponibilidade_horario: "Fins de semana",
  };
  assert.deepEqual(validateStep(step, filled), []);
});

test("gestacao renders all five controls plus the read-only closing note", () => {
  state.answers = { objetivo_treino: ["gestacao_posparto"], fase: "gestacao" };
  state.currentStepId = "gestacao";
  renderStep();
  assert.equal(title(), "Gestação");
  for (const id of ["fisio_pelvica", "semanas_gravidez", "historial_risco", "preferencia_local", "disponibilidade_horario"]) {
    assert.ok(root().querySelector(`#${id}, [name="${id}"]`), `no control rendered for ${id}`);
  }
  assert.equal(root().querySelectorAll('input[type="radio"][name="preferencia_local"]').length, 2);
  // The note is plain text, not a form control.
  const note = root().querySelector("p.note");
  assert.ok(note);
  assert.ok(note.textContent.startsWith("Será contactada por parte da treinadora"));
  assert.equal(root().querySelectorAll('[name="nota_contacto"]').length, 0);
  assert.ok(!root().textContent.includes("form.note."), "unresolved locale key rendered");
});

test("gestacao validation: 5 required errors when empty, none when filled; note never blocks", () => {
  const step = stepById("gestacao");
  assert.deepEqual(
    validateStep(step, {}).map((e) => e.messageKey),
    Array(5).fill("validation.required"),
  );
  const filled = {
    fisio_pelvica: "sim",
    semanas_gravidez: "20",
    historial_risco: "Não",
    preferencia_local: "crossfit_4475",
    disponibilidade_horario: "2ª e 4ª de manhã",
  };
  assert.deepEqual(validateStep(step, filled), []);
});

test("tel field renders a country <select> and a number input", () => {
  renderStep();
  const select = root().querySelector('select[name="contacto_telefonico_country"]');
  const input = root().querySelector("input#contacto_telefonico");
  assert.ok(select);
  assert.equal(input.type, "tel");
  assert.ok(select.querySelectorAll("option").length >= 27);
  assert.equal(select.value, "+351"); // Portugal default
});

test("typing a number stores the combined dial code + number", () => {
  renderStep();
  const input = root().querySelector("input#contacto_telefonico");
  input.value = "912345678";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(state.answers.contacto_telefonico, "+351 912345678");
});

test("changing the country updates the stored prefix", () => {
  state.answers = { contacto_telefonico: "+351 912345678" };
  renderStep();
  const select = root().querySelector('select[name="contacto_telefonico_country"]');
  select.value = "+33";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.answers.contacto_telefonico, "+33 912345678");
});

test("validateStep flags a too-short phone number", () => {
  const answers = {
    nome: "Ana",
    contacto_telefonico: "+351 123",
    email: "ana@example.com",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  assert.deepEqual(validateStep(stepById("dados_basicos"), answers), [
    { id: "contacto_telefonico", messageKey: "validation.phone" },
  ]);
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

test("unchecking 'outro' hides the free-text input and clears its stored answer", () => {
  renderStep();
  const outro = () =>
    [...root().querySelectorAll('input[name="como_chegou"]')].find((i) => i.value === "outro");

  outro().checked = true;
  outro().dispatchEvent(new dom.window.Event("change"));
  const freeText = root().querySelector("input#como_chegou_outro");
  freeText.value = "Um evento";
  freeText.dispatchEvent(new dom.window.Event("input"));
  assert.equal(state.answers.como_chegou_outro, "Um evento");

  outro().checked = false;
  outro().dispatchEvent(new dom.window.Event("change"));
  assert.equal(root().querySelector("input#como_chegou_outro"), null);
  assert.equal(state.answers.como_chegou_outro, undefined);
});

test("page 1 renders the merged option counts (7 como_chegou, 9 objetivo_treino)", () => {
  renderStep();
  assert.equal(root().querySelectorAll('input[type="checkbox"][name="como_chegou"]').length, 7);
  assert.equal(root().querySelectorAll('input[type="checkbox"][name="objetivo_treino"]').length, 9);
});

test("clicking Seguinte advances to the next step with no reload", () => {
  state.answers = {
    nome: "Ana",
    contacto_telefonico: "912345678",
    email: "ana@example.com",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  renderStep();
  assert.equal(title(), "Dados básicos");
  buttonByText("Seguinte").click();
  assert.equal(title(), "Treino geral");
  assert.equal(state.currentStepId, "treino_geral");
});

test("Voltar returns to the previous visible step, answers intact", () => {
  state.answers = { nome: "Ana", objetivo_treino: ["ganho_massa"] };
  state.currentStepId = "treino_geral";
  renderStep();
  buttonByText("Voltar").click();
  assert.equal(title(), "Dados básicos");
  assert.equal(root().querySelector("input#nome").value, "Ana");
});

// --- Validation ---------------------------------------------------------------

const errorFor = (fieldId) => root().querySelector(`.error[data-for="${fieldId}"]`);

test("isFieldFilled covers every field type", () => {
  assert.equal(isFieldFilled({ type: "text" }, {}), false);
  assert.equal(isFieldFilled({ id: "x", type: "text" }, { x: "   " }), false);
  assert.equal(isFieldFilled({ id: "x", type: "text" }, { x: "Ana" }), true);
  assert.equal(isFieldFilled({ id: "r", type: "radio" }, {}), false);
  assert.equal(isFieldFilled({ id: "r", type: "radio" }, { r: "sim" }), true);
  assert.equal(isFieldFilled({ id: "b", type: "checkbox" }, {}), false);
  assert.equal(isFieldFilled({ id: "b", type: "checkbox" }, { b: true }), true);
  const group = { id: "g", type: "checkbox", options: [] };
  assert.equal(isFieldFilled(group, { g: [] }), false);
  assert.equal(isFieldFilled(group, { g: ["a"] }), true);
});

test("validateStep flags empty required fields and ignores hidden conditionals", () => {
  const ids = validateStep(stepById("dados_basicos"), {}).map((e) => e.id);
  assert.ok(ids.includes("nome"));
  assert.ok(ids.includes("como_chegou"));
  assert.ok(ids.includes("objetivo_treino"));
  // como_chegou_outro is hidden until "outro" is checked
  assert.ok(!ids.includes("como_chegou_outro"));
  // every entry carries a message key
  assert.ok(validateStep(stepById("dados_basicos"), {}).every((e) => e.messageKey === "validation.required"));
});

test("validateStep flags a filled-but-malformed email", () => {
  const answers = {
    nome: "Ana",
    contacto_telefonico: "912345678",
    email: "ana(at)example",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  assert.deepEqual(validateStep(stepById("dados_basicos"), answers), [
    { id: "email", messageKey: "validation.email" },
  ]);
});

test("an empty email reports 'required', not 'email'", () => {
  const entry = validateStep(stepById("dados_basicos"), {}).find((e) => e.id === "email");
  assert.equal(entry.messageKey, "validation.required");
});

test("validateStep passes once every visible required field is filled", () => {
  state.answers = {
    nome: "Ana",
    contacto_telefonico: "912345678",
    email: "ana@example.com",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  assert.deepEqual(validateStep(stepById("dados_basicos"), state.answers), []);
});

test("Seguinte with an empty required field shows an inline error and does not advance", () => {
  renderStep();
  buttonByText("Seguinte").click();
  assert.equal(title(), "Dados básicos");
  assert.equal(state.currentStepId, "dados_basicos");
  assert.ok(errorFor("nome"));
  assert.equal(root().querySelector("input#nome").getAttribute("aria-invalid"), "true");
});

test("error copy comes from the locale, not hardcoded", () => {
  renderStep();
  buttonByText("Seguinte").click();
  assert.equal(errorFor("email").textContent, "Este campo é obrigatório");
});

test("error clears on input without clicking Seguinte again", () => {
  renderStep();
  buttonByText("Seguinte").click();
  assert.ok(errorFor("nome"));
  const input = root().querySelector("input#nome");
  input.value = "Ana";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(errorFor("nome"), null);
  assert.equal(input.getAttribute("aria-invalid"), null);
});

test("required checkbox group is validated and clears when one box is checked", () => {
  renderStep();
  buttonByText("Seguinte").click();
  assert.ok(errorFor("objetivo_treino"));
  const box = [...root().querySelectorAll('input[name="objetivo_treino"]')][0];
  box.checked = true;
  box.dispatchEvent(new dom.window.Event("change"));
  assert.equal(errorFor("objetivo_treino"), null);
});

test("Seguinte with a malformed email shows the email error and blocks advance", () => {
  state.answers = {
    nome: "Ana",
    contacto_telefonico: "912345678",
    email: "not-an-email",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  renderStep();
  buttonByText("Seguinte").click();
  assert.equal(title(), "Dados básicos");
  assert.equal(errorFor("email").textContent, "Introduz um endereço de email válido");
});

test("fixing the email clears its error on input", () => {
  state.answers = {
    nome: "Ana",
    contacto_telefonico: "912345678",
    email: "bad",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  renderStep();
  buttonByText("Seguinte").click();
  assert.ok(errorFor("email"));
  const input = root().querySelector("input#email");
  input.value = "ana@example.com";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(errorFor("email"), null);
});

test("advancing is allowed once all required fields are valid", () => {
  state.answers = {
    nome: "Ana",
    contacto_telefonico: "912345678",
    email: "ana@example.com",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
  };
  renderStep();
  buttonByText("Seguinte").click();
  assert.equal(title(), "Treino geral");
  assert.equal(state.errors.size, 0);
});

// --- Submission: confirmation / error screens --------------------------------

const settle = () => new Promise((r) => setTimeout(r, 5));

// A fully valid last step (general-training branch ends on treino_geral).
const onFilledLastStep = () => {
  state.answers = {
    objetivo_treino: ["ganho_massa"],
    onde_treina: "casa",
    dificuldade_atual: "Falta de tempo",
    frequencia_treino: "2_3x",
    orientacao_nutricional: "sim",
    comprometimento: "sim",
  };
  state.currentStepId = "treino_geral";
  renderStep();
};

afterEach(() => {
  delete globalThis.__MOCK_SUBMIT_FAIL;
  state.submitting = false;
});

test("the last step offers a submit button, not 'Seguinte'", () => {
  onFilledLastStep();
  assert.ok(buttonByText("Enviar"));
  assert.equal(buttonByText("Seguinte"), undefined);
});

test("submit blocked while a required field on the last step is empty", () => {
  state.answers = { objetivo_treino: ["ganho_massa"] };
  state.currentStepId = "treino_geral";
  renderStep();
  buttonByText("Enviar").click();
  assert.equal(title(), "Treino geral");
  assert.ok(errorFor("onde_treina"));
});

test("a mocked successful submit shows the success screen with no retry", async () => {
  onFilledLastStep();
  buttonByText("Enviar").click();
  await settle();
  const confirmation = root().querySelector("p.confirmation");
  assert.ok(confirmation);
  assert.ok(confirmation.textContent.startsWith("A nossa equipa será informada"));
  assert.equal(buttonByText("Tentar novamente"), undefined);
});

test("a mocked failed submit shows the error screen with a working retry", async () => {
  globalThis.__MOCK_SUBMIT_FAIL = true;
  onFilledLastStep();
  buttonByText("Enviar").click();
  await settle();
  const confirmation = root().querySelector("p.confirmation");
  assert.ok(confirmation.textContent.startsWith("Não foi possível enviar"));
  const retry = buttonByText("Tentar novamente");
  assert.ok(retry);

  delete globalThis.__MOCK_SUBMIT_FAIL;
  retry.click();
  await settle();
  assert.ok(root().querySelector("p.confirmation").textContent.startsWith("A nossa equipa"));
});

test("the submit button is disabled while the request is in flight", async () => {
  onFilledLastStep();
  goSubmit();
  assert.equal(state.submitting, true);
  assert.equal(buttonByText("Enviar").disabled, true);
  // A second trigger while in flight is a no-op, not a duplicate submission.
  goSubmit();
  assert.equal(state.submitting, true);
  await settle();
  assert.equal(state.submitting, false);
  assert.ok(root().querySelector("p.confirmation"));
});

test("renderConfirmation('success') splits the copy on its line break", () => {
  renderConfirmation("success");
  const p = root().querySelector("p.confirmation");
  assert.equal(p.querySelectorAll("br").length, 1);
  assert.ok(p.textContent.includes("Obrigado!"));
});

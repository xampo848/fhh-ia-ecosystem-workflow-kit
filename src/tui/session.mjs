import {
  checkbox as promptCheckbox,
  input as promptInput,
  select as promptSelect
} from '@inquirer/prompts';
import { toInquirerChoices } from './model.mjs';

function valueOrDefault(value, fallback) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

// A yes/no answer in Spanish or English: true, false, or null when it is
// neither. NFC first, so a "sí" typed as s + i + a combining accent is "sí".
export function parseYesNo(value) {
  const answer = String(value ?? '').normalize('NFC').trim().toLowerCase();
  if (['s', 'si', 'sí', 'y', 'yes'].includes(answer)) return true;
  if (['n', 'no'].includes(answer)) return false;
  return null;
}

function isYes(value) {
  return parseYesNo(value) === true;
}

// The yes/no question of the interactive menu. @inquirer/confirm only knows
// y/yes and n/no and falls back to the default for anything else, so "sí"
// would mean the default. This one reads sí/si/s/y/yes and no/n, asks again
// for anything else, and shows the hint and the answer in Spanish.
export function confirmPromptConfig(message, defaultValue = false) {
  const answerOf = (value) => (String(value ?? '').trim() === '' ? defaultValue : parseYesNo(value));
  return {
    message: `${message} ${defaultValue ? '(S/n)' : '(s/N)'}`,
    validate: (value) => answerOf(value) !== null || 'Responde sí o no.',
    transformer: (value, { isFinal }) => (isFinal ? (answerOf(value) ? 'Sí' : 'No') : value),
    answerOf
  };
}

// The key hints of the select and checkbox prompts, in Spanish.
const keyActions = { navigate: 'navegar', select: 'elegir', all: 'todos', invert: 'invertir', submit: 'confirmar' };
const keyNames = { space: 'espacio' };
export const spanishPromptTheme = {
  style: {
    keysHelpTip: (keys) => keys.map(([key, action]) => `${keyNames[key] ?? key} ${keyActions[action] ?? action}`).join(' • ')
  }
};
// In a checkbox, space marks an option rather than choosing it.
const checkboxTheme = {
  style: {
    keysHelpTip: (keys) => spanishPromptTheme.style.keysHelpTip(keys.map(([key, action]) => [key, key === 'space' && action === 'select' ? 'marcar' : action]))
  }
};

async function chooseScriptedOption({ ask, write, paint, title, options, defaultIndex = 0 }) {
  write(`${paint.bold(title)}\n`);
  options.forEach((option, index) => {
    const defaultMark = index === defaultIndex ? paint.dim(' (por defecto)') : '';
    write(`  ${index + 1}) ${option.label}${defaultMark}\n`);
    if (option.description) write(`     ${paint.dim(option.description)}\n`);
  });

  while (true) {
    const answer = valueOrDefault(await ask(`Elige [${defaultIndex + 1}]: `), String(defaultIndex + 1));
    const numeric = Number.parseInt(answer, 10);

    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= options.length) {
      write('\n');
      return options[numeric - 1].value;
    }

    const byValue = options.find((option) => option.value === answer.trim());
    if (byValue) {
      write('\n');
      return byValue.value;
    }

    write(`${paint.copperInk('Opción no válida. Elige una de las opciones de la lista.')}\n`);
  }
}

async function chooseScriptedOptions({ ask, write, paint, title, options, defaultValues = [] }) {
  write(`${paint.bold(title)}\n`);
  options.forEach((option, index) => {
    const defaultMark = defaultValues.includes(option.value) ? paint.dim(' (por defecto)') : '';
    write(`  ${index + 1}) ${option.label}${defaultMark}\n`);
    if (option.description) write(`     ${paint.dim(option.description)}\n`);
  });

  while (true) {
    const fallback = defaultValues.length > 0 ? defaultValues.join(',') : '';
    const answer = valueOrDefault(await ask(`Elige una o más [${fallback || 'ninguna'}]: `), fallback);
    const tokens = answer.split(',').map((item) => item.trim()).filter(Boolean);
    const values = tokens.flatMap((token) => {
      const numeric = Number.parseInt(token, 10);
      if (!Number.isNaN(numeric) && String(numeric) === token && numeric >= 1 && numeric <= options.length) {
        return [options[numeric - 1].value];
      }
      return options.some((option) => option.value === token) ? [token] : [];
    });

    if (values.length === tokens.length) {
      write('\n');
      return [...new Set(values)];
    }

    write(`${paint.copperInk('Opción no válida. Usa uno o más números o valores de la lista, separados por comas.')}\n`);
  }
}

export function createScriptedPrompter({ ask, write, paint }) {
  return {
    promptText(message, fallback) {
      return ask(message).then((value) => valueOrDefault(value, fallback));
    },
    chooseOption({ title, options, defaultIndex = 0 }) {
      return chooseScriptedOption({ ask, write, paint, title, options, defaultIndex });
    },
    chooseOptions({ title, options, defaultValues = [] }) {
      return chooseScriptedOptions({ ask, write, paint, title, options, defaultValues });
    },
    confirm(message) {
      return ask(message).then((value) => isYes(value));
    }
  };
}

// `prompts` and `context` stand in for the @inquirer prompts and their
// input and output streams (tests drive the real prompts through them).
export function createInteractivePrompter({ prompts = {}, context } = {}) {
  const input = prompts.input ?? promptInput;
  const select = prompts.select ?? promptSelect;
  const checkbox = prompts.checkbox ?? promptCheckbox;
  return {
    promptText(message, fallback) {
      return input({
        message,
        default: fallback
      }, context).then((value) => valueOrDefault(value, fallback));
    },
    chooseOption({ title, options, defaultValue }) {
      return select({
        message: title,
        choices: toInquirerChoices(options),
        default: defaultValue,
        theme: spanishPromptTheme
      }, context);
    },
    chooseOptions({ title, options, defaultValues = [] }) {
      return checkbox({
        message: title,
        choices: toInquirerChoices(options).map((option) => ({
          ...option,
          checked: defaultValues.includes(option.value)
        })),
        // `required` would answer in English.
        validate: (selection) => selection.length > 0 || 'Elige al menos una opción.',
        theme: checkboxTheme
      }, context);
    },
    confirm(message, defaultValue = false) {
      const { answerOf, ...config } = confirmPromptConfig(message, defaultValue);
      return input(config, context).then(answerOf);
    }
  };
}

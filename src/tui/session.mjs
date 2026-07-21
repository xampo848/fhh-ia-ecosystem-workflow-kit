import {
  checkbox as promptCheckbox,
  confirm as promptConfirm,
  input as promptInput,
  select as promptSelect
} from '@inquirer/prompts';
import { toInquirerChoices } from './model.mjs';

function valueOrDefault(value, fallback) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isYes(value) {
  return ['y', 'yes', 's', 'si', 'sí'].includes(String(value ?? '').trim().toLowerCase());
}

async function chooseScriptedOption({ ask, write, paint, title, options, defaultIndex = 0 }) {
  write(`${paint.bold(title)}\n`);
  options.forEach((option, index) => {
    const defaultMark = index === defaultIndex ? paint.dim(' (default)') : '';
    write(`  ${index + 1}) ${option.label}${defaultMark}\n`);
    if (option.description) write(`     ${paint.dim(option.description)}\n`);
  });

  while (true) {
    const answer = valueOrDefault(await ask(`Choose [${defaultIndex + 1}]: `), String(defaultIndex + 1));
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

    write(`${paint.yellow('Invalid choice. Please select one of the listed options.')}\n`);
  }
}

async function chooseScriptedOptions({ ask, write, paint, title, options, defaultValues = [] }) {
  write(`${paint.bold(title)}\n`);
  options.forEach((option, index) => {
    const defaultMark = defaultValues.includes(option.value) ? paint.dim(' (default)') : '';
    write(`  ${index + 1}) ${option.label}${defaultMark}\n`);
    if (option.description) write(`     ${paint.dim(option.description)}\n`);
  });

  while (true) {
    const fallback = defaultValues.length > 0 ? defaultValues.join(',') : '';
    const answer = valueOrDefault(await ask(`Choose one or more [${fallback || 'none'}]: `), fallback);
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

    write(`${paint.yellow('Invalid choice. Use one or more listed numbers or values, separated by commas.')}\n`);
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

export function createInteractivePrompter() {
  return {
    promptText(message, fallback) {
      return promptInput({
        message,
        default: fallback
      }).then((value) => valueOrDefault(value, fallback));
    },
    chooseOption({ title, options, defaultValue }) {
      return promptSelect({
        message: title,
        choices: toInquirerChoices(options),
        default: defaultValue
      });
    },
    chooseOptions({ title, options, defaultValues = [] }) {
      return promptCheckbox({
        message: title,
        choices: toInquirerChoices(options).map((option) => ({
          ...option,
          checked: defaultValues.includes(option.value)
        })),
        required: true
      });
    },
    confirm(message, defaultValue = false) {
      return promptConfirm({
        message,
        default: defaultValue
      });
    }
  };
}
import { confirm as promptConfirm, input as promptInput, select as promptSelect } from '@inquirer/prompts';
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

export function createScriptedPrompter({ ask, write, paint }) {
  return {
    promptText(message, fallback) {
      return ask(message).then((value) => valueOrDefault(value, fallback));
    },
    chooseOption({ title, options, defaultIndex = 0 }) {
      return chooseScriptedOption({ ask, write, paint, title, options, defaultIndex });
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
    confirm(message, defaultValue = false) {
      return promptConfirm({
        message,
        default: defaultValue
      });
    }
  };
}
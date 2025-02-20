import path from 'path';
import chalk from 'chalk';
import {glob} from 'glob';
import fs from 'fs-extra';
import {URL, fileURLToPath} from 'url';

const TRANSLATION_INVOKE_PATTERN = /[\{|\s*|\(]t\('([^\)]*)'[,|\)]/g;
const dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFINED_KEYS_EN = getDefinedTranslationKeysFromRelativeFile(
  '../client/src/assets/i18n/en.json'
);
const DEFINED_KEYS_DE = getDefinedTranslationKeysFromRelativeFile(
  '../client/src/assets/i18n/de.json'
);

check().catch((err) => {
  console.error(err);
  process.exit(1);
});

function getDefinedTranslationKeysFromRelativeFile(relativePath) {
  const absolutPath = new URL(relativePath, import.meta.url).pathname;
  return Object.keys(fs.readJsonSync(absolutPath));
}

const findTranslationKeysInFileContent = (fileName, content) => {
  const fileMatches = {
    fileName,
    translationKeys: []
  };
  let match;
  while ((match = TRANSLATION_INVOKE_PATTERN.exec(content)) !== null) {
    fileMatches.translationKeys.push(match[1]);
  }
  return fileMatches;
};

const groupByKey = (fileResults) =>
  Object.values(
    fileResults
      .filter((r) => r.translationKeys.length)
      .reduce(
        (groupedByKey, currentFile) =>
          currentFile.translationKeys.reduce((innerGroupedByKey, translationKey) => {
            if (!innerGroupedByKey[translationKey]) {
              innerGroupedByKey[translationKey] = {
                files: [currentFile.fileName],
                key: translationKey
              };
            } else {
              innerGroupedByKey[translationKey].files.push(currentFile.fileName);
            }
            return innerGroupedByKey;
          }, groupedByKey),
        {}
      )
  );

async function getUsedKeysInAppFiles() {
  const files = await glob('../client/app/**/*.js', {cwd: dirname});

  console.log(chalk.blue.bold(`Getting all used translation keys in ${files.length} js files...`));

  const filePromises = files.map(async (fileName) => {
    const content = await fs.readFile(path.join(dirname, fileName), 'utf-8');
    return findTranslationKeysInFileContent(fileName, content);
  });
  const fileResults = await Promise.all(filePromises);
  const keys = groupByKey(fileResults);
  keys.sort((kA, kB) => kA.key.localeCompare(kB.key));

  console.log(`    Got ${keys.length} translation keys...`);
  return keys;
}

/**
 * check whether for all used keys, there exists a DE and EN translation
 */
function checkMissing(keys) {
  console.log(
    chalk.blue.bold(`(A) : Check if every used translation key has a EN & DE Translation...`)
  );

  const missingTranslations = keys
    .map((key) => {
      key.isTranslatedDE = DEFINED_KEYS_DE.includes(key.key);
      key.isTranslatedEN = DEFINED_KEYS_EN.includes(key.key);
      return key;
    })
    .filter((res) => !res.isTranslatedDE || !res.isTranslatedEN);

  missingTranslations.forEach((res) => {
    console.error(
      `Key "${res.key}" is missing at least one translation. Used in File(s) ${res.files.join()}: ${
        res.isTranslatedDE ? '' : 'Missing in DE'
      } ${res.isTranslatedEN ? '' : 'Missing in EN'}`
    );
  });

  if (missingTranslations.length < 1) {
    console.log(chalk.green(`    all keys are translated`));
  } else {
    throw new Error('Check failed');
  }
}

function checkUnused(keys) {
  console.log(chalk.blue.bold(`(B) : Check if every translation is used in the app...`));

  const usedKeyStrings = keys.map((k) => k.key);

  const unusedDE = DEFINED_KEYS_DE.filter((deKey) => !usedKeyStrings.includes(deKey));
  const unusedEN = DEFINED_KEYS_EN.filter((enKey) => !usedKeyStrings.includes(enKey));

  unusedDE.forEach((unusedDeKey) => {
    console.warn(`    Defined DE key "${unusedDeKey}" is not used`);
  });
  unusedEN.forEach((unusedEnKey) => {
    console.warn(`    Defined EN key "${unusedEnKey}" is not used`);
  });

  if (unusedDE.length > 0 || unusedEN.length) {
    console.warn(chalk.yellow.bold('!!=== there are unused translation keys ===!!'));
  }
}

async function check() {
  const keys = await getUsedKeysInAppFiles();

  checkMissing(keys);

  checkUnused(keys);
}

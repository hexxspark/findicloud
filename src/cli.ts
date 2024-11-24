import chalk from 'chalk';
import { findICloudPaths } from './finder';

function parseArgs(args: string[]) {
  const options = {
    showHelp: false,
    jsonOutput: false,
    noColor: false,
    silent: false,
  };

  for (const arg of args) {
    switch (arg) {
      case '--help':
      case '-h':
        options.showHelp = true;
        break;
      case '--json':
      case '-j':
        options.jsonOutput = true;
        break;
      case '--no-color':
      case '-n':
        options.noColor = true;
        break;
      case '--silent':
      case '-s':
        options.silent = true;
        break;
      default:
        console.error(chalk.red(`Unknown option: ${arg}`));
        process.exit(1);
    }
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const { showHelp, jsonOutput, noColor, silent } = parseArgs(args);

  // 禁用颜色
  if (noColor) {
    chalk.level = 0;
  }

  // 帮助信息
  if (showHelp) {
    console.log(`
${chalk.blue.bold('Usage:')} ${chalk.green('findicloud')} [options]

${chalk.blue.bold('Options:')}
  ${chalk.green('-j, --json')}       Output in JSON format
  ${chalk.green('-n, --no-color')}   Disable colorized output
  ${chalk.green('-s, --silent')}     Suppress all prompts, only output core results
  ${chalk.green('-h, --help')}       Display help information
`);
    process.exit(0);
  }

  // 查找路径
  if (!silent) console.log(chalk.blue('Finding iCloud Drive paths...'));

  try {
    const paths = await findICloudPaths();

    // 输出结果
    if (paths.length === 0) {
      if (!silent) {
        console.log(chalk.yellow('No iCloud Drive paths found.'));
      }
      process.exit(0);
    }

    if (jsonOutput) {
      console.log(JSON.stringify(paths, null, 2));
    } else {
      paths.forEach((path) => {
        const accessibility = path.isAccessible
          ? chalk.green.bold('Accessible')
          : chalk.red.bold('Not Accessible');
        console.log(
          `- ${chalk.cyan(path.path)} (Score: ${chalk.yellow(
            path.score
          )}, ${accessibility})`
        );
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (!silent) console.error(chalk.red('Error:'), error.message);
    } else {
      if (!silent) console.error(chalk.red('Unknown error occurred:'), error);
    }
    process.exit(1);
  }
}

// 顶层调用显式处理 Promise
main().catch((error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

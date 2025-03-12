import {FileCopier} from './core/file-copier';
import {PathFinder} from './core/path-finder';

/**
 * iCloudy - A library for interacting with iCloud Drive
 */
export * from './types';
// Export core functionality
export * from './core/file-copier';
export * from './core/path-finder';

// Export adapter interfaces
export {BaseCommand, CommandOptions} from './command';
export {default as CopyCommand} from './commands/copy';
export {default as FindCommand} from './commands/find';

export namespace icloudy {
  export const find = PathFinder.find.bind(PathFinder);
  export const copy = FileCopier.copy.bind(FileCopier);
}

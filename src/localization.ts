import * as vscode from 'vscode';

// Localization utility for the extension
export class Localization {
  private static localize = vscode.l10n.t;

  // Error messages
  static get errorInitializingTerminalConfig(): string {
    return this.localize('Could not initialize terminal configuration');
  }

  static get errorLoadingTerminalConfig(): string {
    return this.localize('Error loading terminal configurations');
  }

  static get errorSavingTerminalConfig(): string {
    return this.localize('Error saving terminal configurations');
  }

  static get errorUpdatingTerminalProperty(): string {
    return this.localize('Error updating terminal property');
  }

  static get errorOpeningTerminal(): string {
    return this.localize('Error opening terminal');
  }

  static get errorCreatingTerminal(): string {
    return this.localize('Error creating terminal');
  }

  static get errorConfiguringCommands(): string {
    return this.localize('Error configuring commands');
  }

  static get errorRenamingTerminal(): string {
    return this.localize('Error renaming terminal');
  }

  static get errorDeletingTerminal(): string {
    return this.localize('Error deleting terminal');
  }

  static get errorProcessingJsonConfig(): string {
    return this.localize('Error processing JSON configuration');
  }

  static get errorJsonFormat(): string {
    return this.localize('JSON format error');
  }

  // Success messages
  static get terminalCreatedSuccess(): string {
    return this.localize('Terminal "{0}" created successfully');
  }

  static get terminalOpenedAt(): string {
    return this.localize('Terminal{0} opened at: {1}');
  }

  static get terminalRenamed(): string {
    return this.localize('Terminal renamed to "{0}"');
  }

  static get terminalDeleted(): string {
    return this.localize('Terminal "{0}" deleted');
  }

  static get configurationUpdated(): string {
    return this.localize('Configuration updated for "{0}"');
  }

  // Input prompts and labels
  static get enterTerminalName(): string {
    return this.localize('Enter a name for the {0} terminal');
  }

  static get terminalNamePlaceholder(): string {
    return this.localize('Terminal name');
  }

  static get enterNewTerminalName(): string {
    return this.localize('Enter new name for the terminal');
  }

  static get selectWorkingDirectory(): string {
    return this.localize('Select working directory');
  }

  static get useProjectDirectory(): string {
    return this.localize('Use project directory');
  }

  static get specifyCustomDirectory(): string {
    return this.localize('Specify custom directory');
  }

  static get selectWorkingDirectoryLabel(): string {
    return this.localize('Select working directory');
  }

  // Confirmation messages
  static get terminalCreationCancelled(): string {
    return this.localize('Terminal creation cancelled');
  }

  static get confirmDeleteTerminal(): string {
    return this.localize('Are you sure you want to delete terminal "{0}"?');
  }

  static get yes(): string {
    return this.localize('Yes');
  }

  static get no(): string {
    return this.localize('No');
  }

  // Warning messages
  static get directoryNotExists(): string {
    return this.localize('Directory {0} does not exist. Project directory will be used.');
  }

  // Info messages
  static get editingConfiguration(): string {
    return this.localize('Editing configuration for "{0}". Look for the "comandos" section to add startup commands.');
  }

  static get terminalNotFound(): string {
    return this.localize('Terminal "{0}" not found');
  }

  static get commandsUpdated(): string {
    return this.localize('Commands updated for terminal "{0}": {1} commands');
  }

  static get commandsSaved(): string {
    return this.localize('Saved commands:');
  }

  static get terminalUpdated(): string {
    return this.localize('Terminal updated for "{0}"');
  }

  // Terminal execution messages
  static get executingTerminal(): string {
    return this.localize('=== EXECUTING VS CODE TERMINAL "{0}" ===');
  }

  static get system(): string {
    return this.localize('System');
  }

  static get shell(): string {
    return this.localize('Shell');
  }

  static get directory(): string {
    return this.localize('Directory');
  }

  static get commandsToExecute(): string {
    return this.localize('Commands to execute');
  }

  static get closeOnFinish(): string {
    return this.localize('Close on finish');
  }

  static get terminal(): string {
    return this.localize('Terminal');
  }

  static get executingConfiguredCommands(): string {
    return this.localize('Executing {0} configured commands:');
  }

  static get allCommandsExecuted(): string {
    return this.localize('All commands have been executed.');
  }

  static get terminalClosingIn3Seconds(): string {
    return this.localize('Terminal will close in 3 seconds...');
  }

  // Tree view labels
  static get openTerminalLabel(): string {
    return this.localize('Open {0}');
  }

  static get savedTerminals(): string {
    return this.localize('Saved terminals');
  }

  static get savedTerminalsTooltip(): string {
    return this.localize('Saved terminals for this project');
  }

  static get openTerminalTooltip(): string {
    return this.localize('Open a new {0} terminal');
  }

  static get openTerminalCommand(): string {
    return this.localize('Open terminal');
  }

  static get commandsTooltip(): string {
    return this.localize('Commands: {0}\nDirectory: {1}');
  }

  static get directoryTooltip(): string {
    return this.localize('Directory: {0}');
  }

  static get projectDirectory(): string {
    return this.localize('project directory');
  }

  static get commandsCount(): string {
    return this.localize('({0} cmds)');
  }

  // Platform-specific labels
  static getPlatformTerminalLabel(platform: string): string {
    const isWindows = platform === 'win32';
    const isMac = platform === 'darwin';
    
    if (isWindows) {
      return 'PowerShell';
    } else if (isMac) {
      return 'Terminal';
    } else {
      return 'Bash';
    }
  }
} 
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Localization } from './localization';

// Logger class for handling logs
class Logger {
  static error(message: string, error?: any): void {
    console.error(message, error);
  }
  
  static info(message: string): void {
    console.log(message);
  }
  
  static debug(message: string, data?: any): void {
    console.log(`DEBUG: ${message}`, data || '');
  }
}

// Interface to represent a saved terminal
interface SavedTerminal {
  name: string;
  workingDirectory?: string;
  commands?: string[]; // Unified name in English
  cerrar?: string;     // Property to indicate if terminal should close
}

// Interface for JSON file format
interface TerminalJsonConfig {
  name: string;
  workingDirectory?: string;
  comandos?: string[];
  startupCommands?: string[]; // Added for compatibility with old configurations
  cerrar?: string;            // Property to indicate if terminal should close
}

// Class for managing terminal configurations
export class TerminalConfigManager {
  public configFilePath: string | undefined;

  constructor() {
    this.initConfigPath();
  }

  private initConfigPath(): void {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const vscodePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.vscode');

      try {
        // Create .vscode directory if it doesn't exist
        if (!fs.existsSync(vscodePath)) {
          fs.mkdirSync(vscodePath, { recursive: true });
        }

        this.configFilePath = path.join(vscodePath, 'powershell-terminals.json');
      } catch (error) {
        console.error(`Error creating .vscode directory: ${error}`);
        vscode.window.showErrorMessage(Localization.errorInitializingTerminalConfig);
      }
    }
  }

  public loadTerminalsFromJson(): SavedTerminal[] {
    try {
      if (this.configFilePath && fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf8');
        const jsonTerminals = JSON.parse(data);

        console.log('Loading terminals from JSON:', jsonTerminals);

        // Transform with better command handling
        const terminals = jsonTerminals.map((terminal: any) => {
          const result: SavedTerminal = {
            name: terminal.name,
            workingDirectory: terminal.workingDirectory
          };

          // Detect commands and assign them to commands with higher priority to 'comandos'
          if (terminal.comandos && Array.isArray(terminal.comandos)) {
            result.commands = [...terminal.comandos]; // Use copy to avoid references
            console.log(`Terminal "${terminal.name}" has ${terminal.comandos.length} commands in 'comandos' property`);
          } else if (terminal.startupCommands && Array.isArray(terminal.startupCommands)) {
            result.commands = [...terminal.startupCommands];
            console.log(`Terminal "${terminal.name}" has ${terminal.startupCommands.length} commands in 'startupCommands'`);
          }

          // Load the cerrar property (default "no")
          result.cerrar = terminal.cerrar || 'no';

          return result;
        });

        console.log('Terminals loaded and transformed:', terminals);
        return terminals;
      }
    } catch (error) {
      console.error('Error loading terminal configurations:', error);
    }
    return [];
  }

  public saveTerminals(terminals: SavedTerminal[]): void {
    try {
      if (this.configFilePath) {
        // Convert in-memory format to JSON format
        const jsonTerminals = terminals.map(terminal => {
          const jsonTerminal: any = {
            name: terminal.name,
            workingDirectory: terminal.workingDirectory,
            cerrar: terminal.cerrar || 'no' // Default "no" if not defined
          };

          // Use 'comandos' instead of 'commands' for JSON file
          if (terminal.commands && terminal.commands.length > 0) {
            jsonTerminal.comandos = terminal.commands;
          }

          return jsonTerminal;
        });

        fs.writeFileSync(this.configFilePath, JSON.stringify(jsonTerminals, null, 2), 'utf8');
        console.log('Terminals saved to JSON:', jsonTerminals);
      }
    } catch (error) {
      console.error('Error saving terminal configurations:', error);
    }
  }

  public addTerminal(name: string, workingDirectory?: string): SavedTerminal[] {
    const terminals = this.loadTerminalsFromJson();
    terminals.push({ name, workingDirectory });
    this.saveTerminals(terminals);
    return terminals;
  }

  public removeTerminal(name: string): SavedTerminal[] {
    let terminals = this.loadTerminalsFromJson();
    terminals = terminals.filter(t => t.name !== name);
    this.saveTerminals(terminals);
    return terminals;
  }

  public renameTerminal(oldName: string, newName: string): SavedTerminal[] {
    const terminals = this.loadTerminalsFromJson();
    const terminal = terminals.find(t => t.name === oldName);
    if (terminal) {
      terminal.name = newName;
      this.saveTerminals(terminals);
    }
    return terminals;
  }

  public updateTerminalCommands(name: string, commands: string[]): SavedTerminal[] {
    const terminals = this.loadTerminalsFromJson();
    const terminal = terminals.find(t => t.name === name);

    if (terminal) {
      // Save commands explicitly, even if it's an empty array
      terminal.commands = commands.length > 0 ? commands : undefined;

      // Save to JSON file
      this.saveTerminals(terminals);
      console.log(vscode.l10n.t(Localization.commandsUpdated, name, commands.length.toString()));

      // If there are commands, show them in console for debugging
      if (commands.length > 0) {
        console.log(Localization.commandsSaved);
        commands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
      }
    } else {
      console.error(vscode.l10n.t(Localization.terminalNotFound, name));
    }

    return terminals;
  }

  public updateTerminalConfigProperty(name: string, property: string, value: any): void {
    try {
      if (this.configFilePath && fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf8');
        const config = JSON.parse(data);
        
        const terminalIndex = config.findIndex((t: any) => t.name === name);
        if (terminalIndex >= 0) {
          config[terminalIndex][property] = value;
          fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2), 'utf8');
          return;
        }
      }
      throw new Error(vscode.l10n.t(Localization.terminalNotFound, name));
    } catch (error) {
      Logger.error(Localization.errorUpdatingTerminalProperty, error);
      throw error;
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
    // Create configuration manager instance
    const terminalConfigManager = new TerminalConfigManager();

    // Create data provider for tree view
    const treeDataProvider = new TerminalTreeDataProvider(terminalConfigManager);

    // Command to open PowerShell
    let openTerminalCommand = vscode.commands.registerCommand('vscode-terminal.openTerminal', async (terminal?: SavedTerminal) => {
      try {
        // If a terminal was received, look for its updated configuration (in case it changed)
        if (terminal && terminal.name) {
          // Save the name in a local constant to use later
          const terminalName = terminal.name;

          const updatedTerminals = terminalConfigManager.loadTerminalsFromJson();
          const freshTerminal = updatedTerminals.find(t => t.name === terminalName);

          if (freshTerminal) {
            // Use the local constant instead of terminal.name
            console.log(vscode.l10n.t(Localization.terminalUpdated, terminalName));
            terminal = freshTerminal;
          }
        }

        // Get current workspace path
        let workspaceFolder = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
          workspaceFolder = os.homedir();
        }

        // If a specific terminal is provided, use its custom directory if it exists
        if (terminal && terminal.workingDirectory) {
          if (fs.existsSync(terminal.workingDirectory)) {
            workspaceFolder = terminal.workingDirectory;
          } else {
            vscode.window.showWarningMessage(vscode.l10n.t(Localization.directoryNotExists, terminal.workingDirectory));
          }
        }

        // Show detailed information for debugging
        if (terminal && terminal.commands) {
          console.log(`Opening terminal "${terminal.name}" with ${terminal.commands.length} commands:`);
          terminal.commands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
        }

        // Execute PowerShell in VS Code integrated terminal
        executeTerminal(terminal, workspaceFolder);

        // Show information message
        const terminalName = terminal ? ` "${terminal.name}"` : '';
        vscode.window.showInformationMessage(vscode.l10n.t(Localization.terminalOpenedAt, terminalName, workspaceFolder));
      } catch (error) {
        vscode.window.showErrorMessage(`${Localization.errorOpeningTerminal}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Command to create new terminal
    let createTerminalCommand = vscode.commands.registerCommand('vscode-terminal.createTerminal', async () => {
      try {
        // Detect operating system for labels
        const platform = os.platform();
        const terminalLabel = Localization.getPlatformTerminalLabel(platform);
        
        // Show dialog to enter name
        const name = await vscode.window.showInputBox({
          prompt: vscode.l10n.t(Localization.enterTerminalName, terminalLabel),
          placeHolder: Localization.terminalNamePlaceholder
        });

        if (!name) {
          vscode.window.showInformationMessage(Localization.terminalCreationCancelled);
          return;
        }

        // Ask if user wants to specify a custom working directory
        const useCustomDir = await vscode.window.showQuickPick([Localization.useProjectDirectory, Localization.specifyCustomDirectory], {
          placeHolder: Localization.selectWorkingDirectory
        });

        let workingDirectory: string | undefined = undefined;

        if (useCustomDir === Localization.specifyCustomDirectory) {
          const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: Localization.selectWorkingDirectoryLabel
          });

          if (folderUri && folderUri.length > 0) {
            workingDirectory = folderUri[0].fsPath;
          }
        }

        // Save the terminal
        terminalConfigManager.addTerminal(name, workingDirectory);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(vscode.l10n.t(Localization.terminalCreatedSuccess, name));
      } catch (error) {
        vscode.window.showErrorMessage(`${Localization.errorCreatingTerminal}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Command to configure startup commands by editing JSON directly
    let configureTerminalCommandsCommand = vscode.commands.registerCommand('vscode-terminal.configureTerminalCommands', async (item: TerminalItem) => {
      try {
        if (item.terminal && terminalConfigManager.configFilePath) {
          // Save a safe reference to the terminal
          const terminal = item.terminal;

          // Load current JSON or create new one if it doesn't exist
          let currentConfig: TerminalJsonConfig[] = [];
          try {
            if (fs.existsSync(terminalConfigManager.configFilePath)) {
              const jsonContent = fs.readFileSync(terminalConfigManager.configFilePath, 'utf8');
              currentConfig = JSON.parse(jsonContent);
            }
          } catch (err) {
            // If there's an error reading, start with empty array
            currentConfig = [];
          }

          // Find current terminal in configuration
          const terminalIndex = currentConfig.findIndex(t => t.name === terminal.name);

          // If it doesn't exist, add it
          if (terminalIndex === -1) {
            currentConfig.push({
              name: terminal.name,
              workingDirectory: terminal.workingDirectory,
              comandos: [] // Use 'comandos' instead of 'commands'
            });
          }
          // If it doesn't have 'comandos' property, add it
          else if (!currentConfig[terminalIndex].comandos) {
            currentConfig[terminalIndex].comandos = [];
          }
          // If it has startupCommands but not comandos, migrate
          else if (currentConfig[terminalIndex].startupCommands && !currentConfig[terminalIndex].comandos) {
            currentConfig[terminalIndex].comandos = currentConfig[terminalIndex].startupCommands;
            delete currentConfig[terminalIndex].startupCommands;
          }

          // Save updated configuration
          fs.writeFileSync(terminalConfigManager.configFilePath, JSON.stringify(currentConfig, null, 2), 'utf8');

          // Show file for editing
          const doc = await vscode.workspace.openTextDocument(terminalConfigManager.configFilePath);
          const editor = await vscode.window.showTextDocument(doc);

          // Show informative message
          vscode.window.showInformationMessage(
            vscode.l10n.t(Localization.editingConfiguration, terminal.name),
            'OK'
          );

          // Listen for document close
          const disposable = vscode.workspace.onDidCloseTextDocument(async (closedDoc: vscode.TextDocument) => {
            if (closedDoc.uri.fsPath === terminalConfigManager.configFilePath) {
              try {
                // Reload terminals after editing
                terminalConfigManager.loadTerminalsFromJson();
                treeDataProvider.refresh();

                // Show success message
                vscode.window.showInformationMessage(
                  vscode.l10n.t(Localization.configurationUpdated, terminal.name)
                );
              } catch (error) {
                console.error('Error processing JSON configuration:', error);
                vscode.window.showErrorMessage(`${Localization.errorJsonFormat}: ${error instanceof Error ? error.message : String(error)}`);
              }

              // Remove event listener
              disposable.dispose();
            }
          });

          // Add disposable to context for cleanup
          context.subscriptions.push(disposable);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`${Localization.errorConfiguringCommands}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Command to rename terminal
    let renameTerminalCommand = vscode.commands.registerCommand('vscode-terminal.renameTerminal', async (item: TerminalItem) => {
      try {
        if (item.terminal) {
          const newName = await vscode.window.showInputBox({
            prompt: Localization.enterNewTerminalName,
            value: item.terminal.name
          });

          if (newName && newName !== item.terminal.name) {
            terminalConfigManager.renameTerminal(item.terminal.name, newName);
            treeDataProvider.refresh();
            vscode.window.showInformationMessage(vscode.l10n.t(Localization.terminalRenamed, newName));
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`${Localization.errorRenamingTerminal}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Command to delete terminal
    let deleteTerminalCommand = vscode.commands.registerCommand('vscode-terminal.deleteTerminal', async (item: TerminalItem) => {
      try {
        if (item.terminal) {
          const confirmed = await vscode.window.showQuickPick([Localization.yes, Localization.no], {
            placeHolder: vscode.l10n.t(Localization.confirmDeleteTerminal, item.terminal.name)
          });

          if (confirmed === Localization.yes) {
            terminalConfigManager.removeTerminal(item.terminal.name);
            treeDataProvider.refresh();
            vscode.window.showInformationMessage(vscode.l10n.t(Localization.terminalDeleted, item.terminal.name));
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`${Localization.errorDeletingTerminal}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Register commands
    context.subscriptions.push(openTerminalCommand);
    context.subscriptions.push(createTerminalCommand);
    context.subscriptions.push(configureTerminalCommandsCommand);
    context.subscriptions.push(renameTerminalCommand);
    context.subscriptions.push(deleteTerminalCommand);

    // Register view for container
    const terminalView = vscode.window.createTreeView('openTerminalView', {
      treeDataProvider: treeDataProvider
    });

    context.subscriptions.push(terminalView);
}

// Simplified function to execute commands directly
function executeTerminal(terminal?: SavedTerminal, workspaceFolder?: string): void {
  // Get terminal name and directory
  const windowTitle = terminal ? terminal.name : Localization.terminal;
  const targetPath = workspaceFolder || '';

  // Get configured commands for this terminal
  const commands = terminal?.commands || [];
  
  // Check if terminal should close when finished (default "no")
  const closeTerminal = terminal?.cerrar === 'si';

  // Detect operating system
  const platform = os.platform();
  let shellPath: string;
  let isWindows = platform === 'win32';
  let isMac = platform === 'darwin';
  let isLinux = !isWindows && !isMac;

  // Configure appropriate shell based on operating system
  if (isWindows) {
    shellPath = 'powershell.exe';
  } else if (isMac) {
    // On macOS, try to use zsh first; if not available, use bash
    try {
      if (fs.existsSync('/bin/zsh')) {
        shellPath = '/bin/zsh';
      } else {
        shellPath = '/bin/bash';
      }
    } catch (error) {
      shellPath = '/bin/bash'; // Default
    }
  } else {
    // For Linux and other systems, use bash
    shellPath = '/bin/bash';
  }

  console.log(vscode.l10n.t(Localization.executingTerminal, windowTitle));
  console.log(`${Localization.system}: ${platform}`);
  console.log(`${Localization.shell}: ${shellPath}`);
  console.log(`${Localization.directory}: ${targetPath}`);
  console.log(`${Localization.commandsToExecute}: ${commands.length}`);
  console.log(`${Localization.closeOnFinish}: ${closeTerminal ? Localization.yes : Localization.no}`);

  // Create new integrated terminal in VS Code
  const vsCodeTerminal = vscode.window.createTerminal({
    name: windowTitle,
    shellPath: shellPath,
    cwd: targetPath
  });

  // Show terminal
  vsCodeTerminal.show();

  // Wait a moment for terminal to fully initialize
  setTimeout(() => {
    // Change title and show message according to operating system
    if (isWindows) {
      vsCodeTerminal.sendText(`$host.UI.RawUI.WindowTitle = '${windowTitle}'`, true);
      vsCodeTerminal.sendText(`clear`, true);
      vsCodeTerminal.sendText(`Write-Host "${Localization.terminal}: ${windowTitle}"`, true);
    } else {
      // For macOS and Linux
      vsCodeTerminal.sendText(`echo -e "\\033]0;${windowTitle}\\007"`, true);
      vsCodeTerminal.sendText(`clear`, true);
      vsCodeTerminal.sendText(`echo "${Localization.terminal}: ${windowTitle}"`, true);
    }

    // Execute configured commands if they exist
    if (commands.length > 0) {
      if (isWindows) {
        vsCodeTerminal.sendText(`Write-Host "${vscode.l10n.t(Localization.executingConfiguredCommands, commands.length.toString())}"`, true);
      } else {
        vsCodeTerminal.sendText(`echo "${vscode.l10n.t(Localization.executingConfiguredCommands, commands.length.toString())}"`, true);
      }

      // Execute each command directly
      commands.forEach((command, i) => {
        if (isWindows) {
          vsCodeTerminal.sendText(`Write-Host "[${i + 1}/${commands.length}] > ${command}"`, true);
        } else {
          vsCodeTerminal.sendText(`echo "[${i + 1}/${commands.length}] > ${command}"`, true);
        }
        vsCodeTerminal.sendText(command, true);
      });

      if (isWindows) {
        vsCodeTerminal.sendText(`Write-Host "${Localization.allCommandsExecuted}"`, true);
      } else {
        vsCodeTerminal.sendText(`echo "${Localization.allCommandsExecuted}"`, true);
      }
      
      // Close terminal if configured to do so
      if (closeTerminal) {
        if (isWindows) {
          vsCodeTerminal.sendText(`Write-Host "${Localization.terminalClosingIn3Seconds}" -ForegroundColor Yellow`, true);
        } else {
          vsCodeTerminal.sendText(`echo -e "\\033[33m${Localization.terminalClosingIn3Seconds}\\033[0m"`, true);
        }
        vsCodeTerminal.sendText(`exit`, true);
        // Wait a moment for user to see results before closing
        setTimeout(() => {
          vsCodeTerminal.dispose();
        }, 3000); // 3 seconds wait before closing
      }
    }
  }, 1000); // Wait 1 second to ensure terminal is ready
}

class TerminalTreeDataProvider implements vscode.TreeDataProvider<TerminalItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TerminalItem | undefined | null> = new vscode.EventEmitter<TerminalItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<TerminalItem | undefined | null> = this._onDidChangeTreeData.event;

  constructor(private terminalConfigManager: TerminalConfigManager) { }

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: TerminalItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TerminalItem[] {
    const items: TerminalItem[] = [];
    
    // Detect operating system for labels
    const platform = os.platform();
    const terminalLabel = Localization.getPlatformTerminalLabel(platform);

    // Add general terminal
    const openTerminalItem = new TerminalItem(
      vscode.l10n.t(Localization.openTerminalLabel, terminalLabel),
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-terminal.openTerminal',
        title: vscode.l10n.t(Localization.openTerminalLabel, terminalLabel),
        tooltip: vscode.l10n.t(Localization.openTerminalTooltip, terminalLabel),
        arguments: []
      }
    );
    openTerminalItem.iconPath = new vscode.ThemeIcon('terminal');
    items.push(openTerminalItem);

    // Add saved terminals
    const savedTerminals = this.terminalConfigManager.loadTerminalsFromJson();

    if (savedTerminals.length > 0) {
      // Add separator
      const separator = new TerminalItem(Localization.savedTerminals, vscode.TreeItemCollapsibleState.None);
      separator.tooltip = Localization.savedTerminalsTooltip;
      items.push(separator);

      // Add each saved terminal
      savedTerminals.forEach(terminal => {
        const terminalItem = new TerminalItem(
          terminal.name,
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'vscode-terminal.openTerminal',
            title: Localization.openTerminalCommand,
            tooltip: terminal.commands && terminal.commands.length > 0
              ? vscode.l10n.t(Localization.commandsTooltip, terminal.commands.join(', '), terminal.workingDirectory || Localization.projectDirectory)
              : vscode.l10n.t(Localization.directoryTooltip, terminal.workingDirectory || Localization.projectDirectory),
            arguments: [terminal]
          }
        );

        // If it has configured commands, show count as description
        if (terminal.commands && terminal.commands.length > 0) {
          terminalItem.description = vscode.l10n.t(Localization.commandsCount, terminal.commands.length.toString());
          // Use specific icon based on OS
          const isWindows = platform === 'win32';
          terminalItem.iconPath = new vscode.ThemeIcon(isWindows ? 'terminal-powershell' : 'terminal');
        } else {
          terminalItem.iconPath = new vscode.ThemeIcon('terminal-view-icon');
        }

        terminalItem.contextValue = 'openNamedTerminal';
        terminalItem.terminal = terminal;
        items.push(terminalItem);
      });
    }

    return items;
  }
}

class TerminalItem extends vscode.TreeItem {
  terminal?: SavedTerminal;
  declare iconPath?: vscode.ThemeIcon;
  declare tooltip?: string;
  declare description?: string;
  declare contextValue?: string;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = command?.tooltip || label;
    this.contextValue = 'openItem';
  }
}

export function deactivate() {
  // Clean up resources if necessary
}
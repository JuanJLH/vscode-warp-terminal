import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Clase Logger para manejar logs
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

// Interfaz para representar una terminal guardada
interface SavedTerminal {
  name: string;
  workingDirectory?: string;
  commands?: string[]; // Nombre unificado en inglés
  cerrar?: string;     // Nueva propiedad para indicar si cerrar la terminal
}

// Crear una interfaz para el formato del archivo JSON
interface TerminalJsonConfig {
  name: string;
  workingDirectory?: string;
  comandos?: string[];
  startupCommands?: string[]; // Añadido para compatibilidad con configuraciones antiguas
  cerrar?: string;            // Nueva propiedad para indicar si cerrar la terminal
}

// Clase para manejar la configuración de terminales
class TerminalConfigManager {
  public configFilePath: string | undefined;

  constructor() {
    this.initConfigPath();
  }

  private initConfigPath(): void {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const vscodePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.vscode');

      try {
        // Crear directorio .vscode si no existe
        if (!fs.existsSync(vscodePath)) {
          fs.mkdirSync(vscodePath, { recursive: true });
        }

        this.configFilePath = path.join(vscodePath, 'powershell-terminals.json');
      } catch (error) {
        console.error(`Error al crear directorio .vscode: ${error}`);
        vscode.window.showErrorMessage('No se pudo inicializar la configuración de terminales');
      }
    }
  }

  public loadTerminalsFromJson(): SavedTerminal[] {
    try {
      if (this.configFilePath && fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf8');
        const jsonTerminals = JSON.parse(data);

        console.log('Cargando terminales desde JSON:', jsonTerminals);

        // Transformar con mejor manejo de los comandos
        const terminals = jsonTerminals.map((terminal: any) => {
          const result: SavedTerminal = {
            name: terminal.name,
            workingDirectory: terminal.workingDirectory
          };

          // Detectar comandos y asignarlos a commands con mayor prioridad a 'comandos'
          if (terminal.comandos && Array.isArray(terminal.comandos)) {
            result.commands = [...terminal.comandos]; // Usar copia para evitar referencias
            console.log(`Terminal "${terminal.name}" tiene ${terminal.comandos.length} comandos en propiedad 'comandos'`);
          } else if (terminal.startupCommands && Array.isArray(terminal.startupCommands)) {
            result.commands = [...terminal.startupCommands];
            console.log(`Terminal "${terminal.name}" tiene ${terminal.startupCommands.length} comandos en 'startupCommands'`);
          }

          // Cargar la propiedad cerrar (por defecto "no")
          result.cerrar = terminal.cerrar || 'no';

          return result;
        });

        console.log('Terminales cargadas y transformadas:', terminals);
        return terminals;
      }
    } catch (error) {
      console.error('Error al cargar las configuraciones de terminales:', error);
    }
    return [];
  }

  public saveTerminals(terminals: SavedTerminal[]): void {
    try {
      if (this.configFilePath) {
        // Convertir el formato en memoria al formato JSON
        const jsonTerminals = terminals.map(terminal => {
          const jsonTerminal: any = {
            name: terminal.name,
            workingDirectory: terminal.workingDirectory,
            cerrar: terminal.cerrar || 'no' // Por defecto "no" si no está definido
          };

          // Usar 'comandos' en lugar de 'commands' para el archivo JSON
          if (terminal.commands && terminal.commands.length > 0) {
            jsonTerminal.comandos = terminal.commands;
          }

          return jsonTerminal;
        });

        fs.writeFileSync(this.configFilePath, JSON.stringify(jsonTerminals, null, 2), 'utf8');
        console.log('Terminales guardadas en JSON:', jsonTerminals);
      }
    } catch (error) {
      console.error('Error al guardar las configuraciones de terminales:', error);
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
      // Guardar los comandos explícitamente, incluso si es un array vacío
      terminal.commands = commands.length > 0 ? commands : undefined;

      // Guardar en el archivo JSON
      this.saveTerminals(terminals);
      console.log(`Comandos actualizados para terminal "${name}": ${commands.length} comandos`);

      // Si hay comandos, mostrarlos en la consola para depuración
      if (commands.length > 0) {
        console.log('Comandos guardados:');
        commands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
      }
    } else {
      console.error(`No se encontró la terminal "${name}" para actualizar comandos`);
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
      throw new Error(`Terminal "${name}" no encontrado`);
    } catch (error) {
      Logger.error('Error al actualizar propiedad de terminal', error);
      throw error;
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Crear instancia del administrador de configuraciones
  const terminalConfigManager = new TerminalConfigManager();

  // Crear proveedor de datos para la vista de árbol
  const treeDataProvider = new TerminalTreeDataProvider(terminalConfigManager);

  // Comando para abrir PowerShell
  let openTerminalCommand = vscode.commands.registerCommand('vscode-terminal.openTerminal', async (terminal?: SavedTerminal) => {
    try {
      // Si se recibió un terminal, buscar su configuración actualizada (por si cambió)
      if (terminal && terminal.name) {
        // Guardar el nombre en una constante local para usarlo después
        const terminalName = terminal.name;

        const updatedTerminals = terminalConfigManager.loadTerminalsFromJson();
        const freshTerminal = updatedTerminals.find(t => t.name === terminalName);

        if (freshTerminal) {
          // Usar la constante local en lugar de terminal.name
          console.log(`Terminal actualizado para "${terminalName}"`);
          terminal = freshTerminal;
        }
      }

      // Obtener la ruta del espacio de trabajo actual
      let workspaceFolder = '';
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
      } else {
        workspaceFolder = os.homedir();
      }

      // Si se proporciona una terminal específica, usar su directorio personalizado si existe
      if (terminal && terminal.workingDirectory) {
        if (fs.existsSync(terminal.workingDirectory)) {
          workspaceFolder = terminal.workingDirectory;
        } else {
          vscode.window.showWarningMessage(`El directorio ${terminal.workingDirectory} no existe. Se usará el directorio del proyecto.`);
        }
      }

      // Mostrar información detallada para depuración
      if (terminal && terminal.commands) {
        console.log(`Abriendo terminal "${terminal.name}" con ${terminal.commands.length} comandos:`);
        terminal.commands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
      }

      // Ejecutar PowerShell en el terminal integrado de VS Code
      executeTerminal(terminal, workspaceFolder);

      // Mostrar mensaje de información
      const terminalName = terminal ? ` "${terminal.name}"` : '';
      vscode.window.showInformationMessage(`Terminal${terminalName} abierto en: ${workspaceFolder}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error al abrir terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Comando para crear nueva terminal
  let createTerminalCommand = vscode.commands.registerCommand('vscode-terminal.createTerminal', async () => {
    try {
      // Detectar sistema operativo para etiquetas
      const platform = os.platform();
      const isWindows = platform === 'win32';
      const terminalLabel = isWindows ? 'PowerShell' : (platform === 'darwin' ? 'Terminal' : 'Bash');
      
      // Mostrar diálogo para ingresar nombre
      const name = await vscode.window.showInputBox({
        prompt: `Ingrese un nombre para la terminal ${terminalLabel}`,
        placeHolder: 'Nombre de la terminal'
      });

      if (!name) {
        vscode.window.showInformationMessage('Creación de terminal cancelada');
        return;
      }

      // Preguntar si desea especificar un directorio de trabajo personalizado
      const useCustomDir = await vscode.window.showQuickPick(['Usar directorio del proyecto', 'Especificar directorio personalizado'], {
        placeHolder: 'Seleccione el directorio de trabajo'
      });

      let workingDirectory: string | undefined = undefined;

      if (useCustomDir === 'Especificar directorio personalizado') {
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Seleccionar directorio de trabajo'
        });

        if (folderUri && folderUri.length > 0) {
          workingDirectory = folderUri[0].fsPath;
        }
      }

      // Guardar la terminal
      terminalConfigManager.addTerminal(name, workingDirectory);
      treeDataProvider.refresh();
      vscode.window.showInformationMessage(`Terminal "${name}" creada con éxito`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error al crear terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Comando para configurar comandos de inicio editando directamente el JSON
  let configureTerminalCommandsCommand = vscode.commands.registerCommand('vscode-terminal.configureTerminalCommands', async (item: TerminalItem) => {
    try {
      if (item.terminal && terminalConfigManager.configFilePath) {
        // Guardar una referencia segura al terminal
        const terminal = item.terminal;

        // Cargar el JSON actual o crear uno nuevo si no existe
        let currentConfig: TerminalJsonConfig[] = [];
        try {
          if (fs.existsSync(terminalConfigManager.configFilePath)) {
            const jsonContent = fs.readFileSync(terminalConfigManager.configFilePath, 'utf8');
            currentConfig = JSON.parse(jsonContent);
          }
        } catch (err) {
          // Si hay error en la lectura, comenzar con un array vacío
          currentConfig = [];
        }

        // Buscar el terminal actual en la configuración
        const terminalIndex = currentConfig.findIndex(t => t.name === terminal.name);

        // Si no existe, agregarlo
        if (terminalIndex === -1) {
          currentConfig.push({
            name: terminal.name,
            workingDirectory: terminal.workingDirectory,
            comandos: [] // Usar 'comandos' en lugar de 'commands'
          });
        }
        // Si no tiene la propiedad 'comandos', agregarla
        else if (!currentConfig[terminalIndex].comandos) {
          currentConfig[terminalIndex].comandos = [];
        }
        // Si tiene startupCommands pero no comandos, migrar
        else if (currentConfig[terminalIndex].startupCommands && !currentConfig[terminalIndex].comandos) {
          currentConfig[terminalIndex].comandos = currentConfig[terminalIndex].startupCommands;
          delete currentConfig[terminalIndex].startupCommands;
        }

        // Guardar la configuración actualizada
        fs.writeFileSync(terminalConfigManager.configFilePath, JSON.stringify(currentConfig, null, 2), 'utf8');

        // Mostrar el archivo para edición
        const doc = await vscode.workspace.openTextDocument(terminalConfigManager.configFilePath);
        const editor = await vscode.window.showTextDocument(doc);

        // Mostrar mensaje informativo
        vscode.window.showInformationMessage(
          `Editando configuración para "${terminal.name}". Busca la sección "comandos" para agregar comandos de inicio.`,
          'OK'
        );

        // Escuchar cuando se cierra el documento
        const disposable = vscode.workspace.onDidCloseTextDocument(async closedDoc => {
          if (closedDoc.uri.fsPath === terminalConfigManager.configFilePath) {
            try {
              // Recargar las terminales después de la edición
              terminalConfigManager.loadTerminalsFromJson();
              treeDataProvider.refresh();

              // Mostrar mensaje de éxito
              vscode.window.showInformationMessage(
                `Configuración actualizada para "${terminal.name}"`
              );
            } catch (error) {
              console.error('Error al procesar configuración JSON:', error);
              vscode.window.showErrorMessage(`Error en el formato JSON: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Eliminar el event listener
            disposable.dispose();
          }
        });

        // Agregar el disposable al contexto para limpieza
        context.subscriptions.push(disposable);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error al configurar comandos: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Comando para renombrar terminal
  let renameTerminalCommand = vscode.commands.registerCommand('vscode-terminal.renameTerminal', async (item: TerminalItem) => {
    try {
      if (item.terminal) {
        const newName = await vscode.window.showInputBox({
          prompt: 'Ingrese nuevo nombre para la terminal',
          value: item.terminal.name
        });

        if (newName && newName !== item.terminal.name) {
          terminalConfigManager.renameTerminal(item.terminal.name, newName);
          treeDataProvider.refresh();
          vscode.window.showInformationMessage(`Terminal renombrada a "${newName}"`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error al renombrar terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Comando para eliminar terminal
  let deleteTerminalCommand = vscode.commands.registerCommand('vscode-terminal.deleteTerminal', async (item: TerminalItem) => {
    try {
      if (item.terminal) {
        const confirmed = await vscode.window.showQuickPick(['Sí', 'No'], {
          placeHolder: `¿Está seguro de eliminar la terminal "${item.terminal.name}"?`
        });

        if (confirmed === 'Sí') {
          terminalConfigManager.removeTerminal(item.terminal.name);
          treeDataProvider.refresh();
          vscode.window.showInformationMessage(`Terminal "${item.terminal.name}" eliminada`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error al eliminar terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Registrar los comandos
  context.subscriptions.push(openTerminalCommand);
  context.subscriptions.push(createTerminalCommand);
  context.subscriptions.push(configureTerminalCommandsCommand);
  context.subscriptions.push(renameTerminalCommand);
  context.subscriptions.push(deleteTerminalCommand);

  // Registrar vista para el contenedor
  const terminalView = vscode.window.createTreeView('openTerminalView', {
    treeDataProvider: treeDataProvider
  });

  context.subscriptions.push(terminalView);
}

// Función simplificada para ejecutar comandos directamente
function executeTerminal(terminal?: SavedTerminal, workspaceFolder?: string): void {
  // Obtener el nombre y directorio de la terminal
  const tituloVentana = terminal ? terminal.name : "Terminal";
  const rutaDestino = workspaceFolder || '';

  // Obtener los comandos configurados para esta terminal
  const comandos = terminal?.commands || [];
  
  // Verificar si se debe cerrar la terminal al terminar (por defecto "no")
  const cerrarTerminal = terminal?.cerrar === 'si';

  // Detectar sistema operativo
  const platform = os.platform();
  let shellPath: string;
  let isWindows = platform === 'win32';
  let isMac = platform === 'darwin';
  let isLinux = !isWindows && !isMac;

  // Configurar la shell adecuada según el sistema operativo
  if (isWindows) {
    shellPath = 'powershell.exe';
  } else if (isMac) {
    // En macOS, intentar usar zsh primero; si no está disponible, usar bash
    try {
      if (fs.existsSync('/bin/zsh')) {
        shellPath = '/bin/zsh';
      } else {
        shellPath = '/bin/bash';
      }
    } catch (error) {
      shellPath = '/bin/bash'; // Por defecto
    }
  } else {
    // Para Linux y otros sistemas, usar bash
    shellPath = '/bin/bash';
  }

  console.log(`=== EJECUTANDO TERMINAL VS CODE "${tituloVentana}" ===`);
  console.log(`Sistema: ${platform}`);
  console.log(`Shell: ${shellPath}`);
  console.log(`Directorio: ${rutaDestino}`);
  console.log(`Comandos a ejecutar: ${comandos.length}`);
  console.log(`Cerrar al terminar: ${cerrarTerminal ? 'Sí' : 'No'}`);

  // Crear una nueva terminal integrada en VS Code
  const vsCodeTerminal = vscode.window.createTerminal({
    name: tituloVentana,
    shellPath: shellPath,
    cwd: rutaDestino
  });

  // Mostrar la terminal
  vsCodeTerminal.show();

  // Esperar un momento para que la terminal se inicialice completamente
  setTimeout(() => {
    // Cambiar título y mostrar mensaje según el sistema operativo
    if (isWindows) {
      vsCodeTerminal.sendText(`$host.UI.RawUI.WindowTitle = '${tituloVentana}'`, true);
      vsCodeTerminal.sendText(`clear`, true);
      vsCodeTerminal.sendText(`Write-Host "Terminal: ${tituloVentana}"`, true);
    } else {
      // Para macOS y Linux
      vsCodeTerminal.sendText(`echo -e "\\033]0;${tituloVentana}\\007"`, true);
      vsCodeTerminal.sendText(`clear`, true);
      vsCodeTerminal.sendText(`echo "Terminal: ${tituloVentana}"`, true);
    }

    // Ejecutar comandos configurados si existen
    if (comandos.length > 0) {
      if (isWindows) {
        vsCodeTerminal.sendText(`Write-Host "Ejecutando ${comandos.length} comandos configurados:"`, true);
      } else {
        vsCodeTerminal.sendText(`echo "Ejecutando ${comandos.length} comandos configurados:"`, true);
      }

      // Ejecutar cada comando directamente
      comandos.forEach((comando, i) => {
        if (isWindows) {
          vsCodeTerminal.sendText(`Write-Host "[${i + 1}/${comandos.length}] > ${comando}"`, true);
        } else {
          vsCodeTerminal.sendText(`echo "[${i + 1}/${comandos.length}] > ${comando}"`, true);
        }
        vsCodeTerminal.sendText(comando, true);
      });

      if (isWindows) {
        vsCodeTerminal.sendText(`Write-Host "Todos los comandos han sido ejecutados."`, true);
      } else {
        vsCodeTerminal.sendText(`echo "Todos los comandos han sido ejecutados."`, true);
      }
      
      // Cerrar la terminal si está configurado para hacerlo
      if (cerrarTerminal) {
        if (isWindows) {
          vsCodeTerminal.sendText(`Write-Host "La terminal se cerrará en 3 segundos..." -ForegroundColor Yellow`, true);
        } else {
          vsCodeTerminal.sendText(`echo -e "\\033[33mLa terminal se cerrará en 3 segundos...\\033[0m"`, true);
        }
        vsCodeTerminal.sendText(`exit`, true);
        // Esperar un momento para que el usuario vea los resultados antes de cerrar
        setTimeout(() => {
          vsCodeTerminal.dispose();
        }, 3000); // 3 segundos de espera antes de cerrar
      }
    }
  }, 1000); // Esperar 1 segundo para asegurar que la terminal esté lista
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
    
    // Detectar sistema operativo para etiquetas
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const terminalLabel = isWindows ? 'PowerShell' : (platform === 'darwin' ? 'Terminal' : 'Bash');

    // Añadir terminal general
    const openTerminalItem = new TerminalItem(
      `Abrir ${terminalLabel}`,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'vscode-terminal.openTerminal',
        title: `Abrir ${terminalLabel}`,
        tooltip: `Abrir una nueva terminal ${terminalLabel}`,
        arguments: []
      }
    );
    openTerminalItem.iconPath = new vscode.ThemeIcon('terminal');
    items.push(openTerminalItem);

    // Añadir terminales guardadas
    const savedTerminals = this.terminalConfigManager.loadTerminalsFromJson();

    if (savedTerminals.length > 0) {
      // Añadir separador
      const separator = new TerminalItem('Terminales guardadas', vscode.TreeItemCollapsibleState.None);
      separator.tooltip = 'Terminales guardadas para este proyecto';
      items.push(separator);

      // Añadir cada terminal guardada
      savedTerminals.forEach(terminal => {
        const terminalItem = new TerminalItem(
          terminal.name,
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'vscode-terminal.openTerminal',
            title: 'Abrir terminal',
            tooltip: terminal.commands && terminal.commands.length > 0
              ? `Comandos: ${terminal.commands.join(', ')}\nDirectorio: ${terminal.workingDirectory || 'directorio del proyecto'}`
              : `Directorio: ${terminal.workingDirectory || 'directorio del proyecto'}`,
            arguments: [terminal]
          }
        );

        // Si tiene comandos configurados, mostrar la cantidad como descripción
        if (terminal.commands && terminal.commands.length > 0) {
          terminalItem.description = `(${terminal.commands.length} cmds)`;
          // Usar el icono específico según el SO
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
  // Limpiar recursos si es necesario
}
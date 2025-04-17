# Terminal Manager

Manage terminals with predefined commands in VS Code for Windows, macOS, and Linux.

## Features

- Create and save named terminals
- Configure commands that run automatically on terminal launch
- Support for Windows (PowerShell), macOS (zsh/bash), and Linux (bash)
- Option to automatically close the terminal after execution
- Multi-platform support with automatic OS detection

## Usage

1. Click on the Terminal icon in the sidebar
2. Create a new terminal with the "+" button
3. Configure the commands you want to execute
4. Optionally, configure whether you want the terminal to close automatically by adding `"cerrar": "si"` to your configuration

## Configuration Example

```json
[
  {
    "name": "Start Project",
    "workingDirectory": "${workspaceFolder}",
    "comandos": [
      "npm install",
      "npm start"
    ],
    "cerrar": "no"
  },
  {
    "name": "Build and Test",
    "workingDirectory": "${workspaceFolder}/src",
    "comandos": [
      "dotnet build",
      "dotnet test"
    ],
    "cerrar": "si"
  }
]
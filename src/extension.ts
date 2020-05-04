import { Connection } from './remote/Connection';
import { FitkitSerial } from './serial/FitkitSerial';
import { Authentication } from './auth/Authentication';
/**
 * Vstupní bod rozšíření
 */

import { Project } from './project/Project';
import { Repository } from './repository/repository';
import { ExtensionContext, window, commands } from 'vscode';

/**
 * Hlavní vstupní bod rozšíření.
 *
 * Je zavolán, pokud jsou splněny podmínky aktivace v package.json
 */
export function activate(context: ExtensionContext) {
	console.log('FITkit extension activated!');

	Authentication.Context = context;

	try{
		FitkitSerial.UpdateSerialPathByArch(context.extensionPath);
	}catch(e){
		window.showWarningMessage("Failed to init module for serial communication. " + e.toString());
	}

	commands.registerCommand("fitkit.disconnect", () => {
		Connection.DisconnectFromServer();
	});

	Repository.Init();
	Project.Init();

	commands.registerCommand("fitkit.auth.invalidate", () => {
		Authentication.Invalidate();
		window.showInformationMessage("Your auth token was successfully invalidated");
	});
}

/**
 * Dekativace rozšíření, pokud VSCode usoudí že již není potřeba
 */
export function deactivate() {
	console.log('FITkit extension deactivated.');
}

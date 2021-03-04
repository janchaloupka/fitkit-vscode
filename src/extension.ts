import { Connection } from './remote/connection';
import { FitkitSerial } from './serial/fitkit-serial';
import { Authentication } from './auth/authentication';
import { Project } from './project/project';
import { Repository } from './repository/repository';
import { ExtensionContext, window, commands } from 'vscode';

/**
 * Hlavní vstupní bod rozšíření.
 *
 * Je zavolán, pokud jsou splněny podmínky aktivace v package.json
 */
export function activate(context: ExtensionContext) {
    console.log('FITkit extension activated!');

    Authentication.context = context;

    try{
        FitkitSerial.updateSerialPathByArch(context.extensionPath);
    }catch(e){
        window.showWarningMessage("Failed to init module for serial communication. " + e.toString());
    }

    commands.registerCommand("fitkit.disconnect", () => {
        Connection.disconnectFromServer();
    });

    Repository.init();
    Project.init();

    commands.registerCommand("fitkit.auth.invalidate", () => {
        Authentication.invalidate();
        window.showInformationMessage("Your auth token was successfully invalidated");
    });
}

/**
 * Deaktivace rozšíření, pokud VSCode usoudí že již není potřeba
 */
export function deactivate() {
    console.log('FITkit extension deactivated.');
}

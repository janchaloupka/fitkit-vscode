import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";

/**
 * Uživatelská konfigurace tohoto rozšíření
 */
export class ExtensionConfig{
    private static listeningForChange = false;

    private static _fitkitConfig?: vscode.WorkspaceConfiguration;
    private static get fitkitConfig(): vscode.WorkspaceConfiguration{
        if(!this._fitkitConfig){
            this._fitkitConfig = vscode.workspace.getConfiguration("fitkit");
        }

        if(!this.listeningForChange){
            vscode.workspace.onDidChangeConfiguration(() => this.onConfigurationChange());
            this.listeningForChange = true;
        }

        return this._fitkitConfig;
    }

    private static onConfigurationChange(){
        // Konfigurace změněna, resetovat cache konfigurace
        console.log("Config changed");
        this._fitkitConfig = undefined;
    }

    /**
     * Absolutní cesta k lokálnímu repositáři projektů
     */
    public static get repositoryPath() : string {
        return path.join(os.homedir(), this.fitkitConfig.get("projectRepository.path") ?? "");
    }

    /**
     * Adresa pro stažení repositáře
     */
    public static get repositoryUrl() : string {
        return this.fitkitConfig.get("projectRepository.cloneUrl") ?? "";
    }

    /**
     * Adresa pro vytvoření nového požadavku na autorizační server
     */
    public static get authRequestUrl() : string {
        return this.fitkitConfig.get("authServer.requestUrl") ?? "";
    }

    /**
     * Adresa pro ověření uživatele a vytvoření tokenu
     */
    public static get authGenerateUrl() : string {
        return this.fitkitConfig.get("authServer.generateUrl") ?? "";
    }

    /**
     * Adresa serveru pro vzdálený překlad
     */
    public static get remoteServerIp() : string {
        return this.fitkitConfig.get("remoteBuild.serverAddress") ?? "";
    }

    /**
     * Mají se všechny rozpracované soubory uložit, pokud se spustí překlad/simulace
     */
    public static get saveOnBuild() : boolean{
        console.log(this.fitkitConfig.get("saveOnBuild"));
        return !!this.fitkitConfig.get("saveOnBuild");
    }

    /**
     * Má se ukládat do souboru informace o průběhu posledního překladu/simulace
     */
    public static get logDebugInfo() : boolean{
        console.log(this.fitkitConfig.get("logDebugInfo"));
        return !!this.fitkitConfig.get("logDebugInfo");
    }
}

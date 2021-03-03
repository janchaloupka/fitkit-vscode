import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";

/**
 * Uživatelská konfigurace tohoto rozšíření
 */
export class ExtensionConfig{
	private static ListeningForChange = false;

	private static _FitkitConfig?: vscode.WorkspaceConfiguration;
	private static get FitkitConfig(): vscode.WorkspaceConfiguration{
		if(!this._FitkitConfig){
			this._FitkitConfig = vscode.workspace.getConfiguration("fitkit");
		}

		if(!this.ListeningForChange){
			vscode.workspace.onDidChangeConfiguration(() => this.OnConfigurationChange());
			this.ListeningForChange = true;
		}

		return this._FitkitConfig;
	}

	private static OnConfigurationChange(){
		// Konfigurace změněna, resetovat cache konfigurace
		console.log("Config changed");
		this._FitkitConfig = undefined;
	}

	/**
	 * Absolutní cesta k lokálnímu repozitáři projektů
	 */
	public static get RepositoryPath() : string {
		return path.join(os.homedir(), this.FitkitConfig.get("projectRepository.path") ?? "");
	}

	/**
	 * Adresa pro stažení repozitáře
	 */
	public static get RepositoryUrl() : string {
		return this.FitkitConfig.get("projectRepository.cloneUrl") ?? "";
	}

	/**
	 * Adresa pro vytvoření nového požadavku na autorizační server
	 */
	public static get AuthRequestUrl() : string {
		return this.FitkitConfig.get("authServer.requestUrl") ?? "";
	}

	/**
	 * Adresa pro ověření uživatele a vytvoření tokenu
	 */
	public static get AuthGenerateUrl() : string {
		return this.FitkitConfig.get("authServer.generateUrl") ?? "";
	}

	/**
	 * Adresa serveru pro vzdálený překlad
	 */
	public static get RemoteServerIp() : string {
		return this.FitkitConfig.get("remoteBuild.serverAddress") ?? "";
	}

	/**
	 * Mají se všechny rozpracované soubory uložit, pokud se spustí překlad/simulace
	 */
	public static get SaveOnBuild() : boolean{
		console.log(this.FitkitConfig.get("saveOnBuild"));
		return !!this.FitkitConfig.get("saveOnBuild");
	}

	/**
	 * Má se ukládat do souboru informace o průběhu posledního překladu/simulace
	 */
	public static get LogDebugInfo() : boolean{
		console.log(this.FitkitConfig.get("logDebugInfo"));
		return !!this.FitkitConfig.get("logDebugInfo");
	}
}

import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";

/**
 * Uživatelská konfigurace tohoto rozšíření
 */
export class ExtensionConfig{
	private static _FitkitConfig?: vscode.WorkspaceConfiguration;
	private static get FitkitConfig(): vscode.WorkspaceConfiguration{
		if(!this._FitkitConfig)
			this._FitkitConfig = vscode.workspace.getConfiguration("fitkit");

		return this._FitkitConfig;
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
}

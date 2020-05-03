import { Progress, CancellationToken } from 'vscode';
import { ProgressLocation } from 'vscode';
import { window } from 'vscode';
import * as request from "request-promise-native";
import * as open from "open";
import { ExtensionConfig } from "../ExtensionConfig";

/**
 * Třída pro vytvoření požadavku a získání nového autorizačního tokenu
 */
export class TokenRequest{
	/** Identifikační číslo požadavku */
	private Id = "";

	/**
	 * Získat nový autorizační token.
	 * Pokud se nepodaří token získat, metoda zkončí výjimkou
	 */
	public async RequestToken(): Promise<string>{
		// Pro detailní specifikaci získání tokenu viz dokumentace autentizačního serveru

		const dialogContinue = "Continue (Open web browser)";
		let dialogRes = await window.showWarningMessage(
			"For this action you need to be authenticated. If you continue, you will be required to login using your school account.",
			"Cancel", dialogContinue
		);

		if(dialogRes !== dialogContinue)
			throw new Error("Cannot get auth token. Action cancelled by user");

		try{
			this.Id = await request(`${ExtensionConfig.AuthRequestUrl}?new`);
		}catch(e){
			throw new Error("Cannot request new token. Failed to connect to auth server.");
		}

		if(this.Id.length === 0)
			throw new Error("Invalid response from auth server. Request id is empty");

		// Otevřít uživateli stránku pro potvrzení požadavku
		open(`${ExtensionConfig.AuthGenerateUrl}?request=${this.Id}&appname=FITkit+Extension+for+VSCode`);

		const token = await window.withProgress<string>({
			location: ProgressLocation.Notification,
			title: "FITkit Authentication",
			cancellable: true
		}, (progress, cancelToken) => this.GetToken(progress, cancelToken));

		window.showInformationMessage("You were successfully authenticated");
		return token;
	}

	/**
	 * Pravidelně se dotazovat, zda již byl požadavek na autorizační token
	 * vyžízen. Musí být zavoláno jako task metody `vscode.window.withProgess`
	 *
	 * V přípdaě, že se nepodaří získat token metoda skončí výjimkou.
	 *
	 * @param progress Informuje o stavu vyřízení požadavku
	 * @param cancel Token pro indikace, že byla akce zrušená uživatelem
	 */
	private GetToken(progress: Progress<{message: string}>, cancel: CancellationToken): Promise<string>{
		progress.report({message: "Waiting for user verification..."});

		return new Promise<string>((resolve, reject) =>{
			// Dotazovat se každých 5s na stav požadavku
			const interval = setInterval(async () => {
				if(cancel.isCancellationRequested){
					clearInterval(interval);
					reject("Action was cancelled by user");
					return;
				}

				try{
					const token = await request(`${ExtensionConfig.AuthRequestUrl}?request=${this.Id}`);
					if(typeof token !== "string" || token.trim().length === 0) return;

					resolve(token.trim());
					clearInterval(interval);
				}catch(e){
					reject("Failed to get token. Auth server denied the request");
				}

			}, 5000);
		});
	}
}

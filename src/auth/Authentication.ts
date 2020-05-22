import { Connection } from './../remote/Connection';
import { TokenRequest } from './TokenRequest';
import { ExtensionContext } from 'vscode';

/**
 * Singleton třída zajišťující autorizaci uživatele
 * pro spojení s překladovým serverem
 */
export class Authentication{
	/** Aktuální JWT token, načtený z disku nebo získaný ze serveru */
	private static CachedToken?: string;

	/** Kontext ve kterém rozšíření běží */
	public static Context: ExtensionContext;

	/**
	 * Vrátí JWT token pro autentizaci na překladovém serveru.
	 *
	 * Metoda neprovádí kontrolu platnosti (napřiklad vypršení časové platnosti)
	 * Pokud se nepodaří získat token, metoda skončí výjimkou
	 *
	 * @param invalidate Vyžádat nový JWT token
	 */
	public static async GetToken(invalidate = false): Promise<string>{
		if(invalidate) this.Invalidate();

		if(this.CachedToken) return this.CachedToken;

		let token = this.Context.globalState.get<string>("jwtAuthToken");
		if(typeof token !== "string" || token.length === 0){
			const request = new TokenRequest();
			token = await request.RequestToken();
			this.Context.globalState.update("jwtAuthToken", token);
		}

		this.CachedToken = token;
		return token;
	}

	/**
	 * Znevalidnit aktuální token uložený v mezipaměti a na disku
	 */
	public static Invalidate(){
		this.CachedToken = undefined;
		this.Context.globalState.update("jwtAuthToken", undefined);

		// Zavřít spojení, pokud existuje
		Connection.DisconnectFromServer();
	}
}

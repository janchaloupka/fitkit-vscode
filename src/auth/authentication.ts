import { Connection } from './../remote/connection';
import { TokenRequest } from './token-request';
import { ExtensionContext } from 'vscode';

/**
 * Singleton třída zajišťující autorizaci uživatele
 * pro spojení s překladovým serverem
 */
export class Authentication{
    /** Aktuální JWT token, načtený z disku nebo získaný ze serveru */
    private static cachedToken?: string;

    /** Kontext ve kterém rozšíření běží */
    public static context: ExtensionContext;

    /**
     * Vrátí JWT token pro autentizaci na překladovém serveru.
     *
     * Metoda neprovádí kontrolu platnosti (napřiklad vypršení časové platnosti)
     * Pokud se nepodaří získat token, metoda skončí výjimkou
     *
     * @param invalidate Vyžádat nový JWT token
     */
    public static async getToken(invalidate = false): Promise<string>{
        if(invalidate) this.invalidate();

        if(this.cachedToken) return this.cachedToken;

        let token = this.context.globalState.get<string>("jwtAuthToken");
        if(typeof token !== "string" || token.length === 0){
            const request = new TokenRequest();
            token = await request.requestToken();
            this.context.globalState.update("jwtAuthToken", token);
        }

        this.cachedToken = token;
        return token;
    }

    /**
     * Znevalidnit aktuální token uložený v mezipaměti a na disku
     */
    public static invalidate(){
        this.cachedToken = undefined;
        this.context.globalState.update("jwtAuthToken", undefined);

        // Zavřít spojení, pokud existuje
        Connection.disconnectFromServer();
    }
}

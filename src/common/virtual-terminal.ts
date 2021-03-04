import { Pseudoterminal, EventEmitter } from "vscode";
import * as colors from "colors/safe";

/**
 * Virtuální terminál pro zobrazení informací o překladu/simulaci
 */
export class VirtualTerminal implements Pseudoterminal{
    private static opened: VirtualTerminal[] = [];

    /** Slovník pro mapovaní souborů ("docasny_soubor": "original") */
    private filesMapping?: {[term: string]: string};

    protected waitingForAnyKey = false;

    private onDidCloseEmitter = new EventEmitter<void|number>();
    private onDidWriteEmitter = new EventEmitter<string>();
    private onInputEmitter = new EventEmitter<string>();

    /** Event, která je vyvolán po zavření terminálu */
    public readonly onDidClose = this.onDidCloseEmitter.event;

    /** Event, která je vyvolán po výstupu programu na terminál */
    public readonly onDidWrite = this.onDidWriteEmitter.event;

    /** Event, která je vyvolán po uživatelském vstupu */
    public readonly onInput = this.onInputEmitter.event;

    public ready = false;
    public closed = false;

    private lineQueue: string[] = [];

    public open(){
        this.ready = true;

        // Zavřít terminály čekající na ukončení
        VirtualTerminal.opened.forEach(t => {
            if(t.waitingForAnyKey) t.handleInput(" ");
        });

        VirtualTerminal.opened.push(this);

        while(this.lineQueue.length > 0){
            this.onDidWriteEmitter.fire(this.lineQueue.shift() ?? "");
        }
    }

    public close(){
        this.ready = false;
        this.closed = true;
        VirtualTerminal.opened = VirtualTerminal.opened.filter(t => t !== this);
        this.onDidCloseEmitter.fire();
    }

    public handleInput(data: string){
        if(this.closed) return;

        if(!this.waitingForAnyKey){
            this.onInputEmitter.fire(data);
            return;
        }

        this.waitingForAnyKey = false;
        this.close();
    }

    public anyKeyToClose(){
        if(this.waitingForAnyKey) return;

        this.waitingForAnyKey = true;
        this.writeLine(colors.gray("\r\n\r\nTerminal is inactive. Press any key to close..."));
    }

    /**
     * Zobrazit řádek na výstup terminálu
     *
     * @param line Řádek textu na výstup
     */
    public writeLine(line: string){
        if(this.closed) return;

        if(this.filesMapping){
            for (const temp in this.filesMapping) {
                if (!this.filesMapping.hasOwnProperty(temp)) continue;
                const orig = this.filesMapping[temp];

                line = line.replace(temp, orig);
            }
        }

        line = line.replace(/\n/g, "\r\n");

        if(!this.ready) this.lineQueue.push(line + "\r\n");
        else this.onDidWriteEmitter.fire(line + "\r\n");
    };

    // Zápis části znaků na výstup
    public write(chunk: any){
        if(this.closed) return;

        // Převést buffer na string
        if(chunk instanceof Buffer){
            chunk = chunk.toString("utf8");
        }

        if(typeof chunk !== "string") chunk = chunk.toString();

        // Normalizovat řádky
        chunk = chunk.replace(/\n/g, "\r\n");

        if(!this.ready) this.lineQueue.push(chunk);
        else this.onDidWriteEmitter.fire(chunk);
    }

    /**
     * Zobrazit chybuvou hlášku na výstup terminálu
     *
     * @param line Chybová hláška
     */
    public errorLine(line: string){
        this.writeLine(colors.red(line));
    }

    /**
     * Načte slovník pro mapování dočasných serverových souborů na lokální
     * soubory
     *
     * @param mapping Slovník pro mapovaní ("docasny_soubor": "original")
     */
    public loadFilesMapping(mapping?: {[term: string]: string}){
        this.filesMapping = mapping;
    }

    /**
     * Zruší mapování souborů(výstup se vypisuje tak, jak přichází)
     */
    public removeFileMapping(){
        this.loadFilesMapping();
    }
}

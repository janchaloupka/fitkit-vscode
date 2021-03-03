import { Pseudoterminal, EventEmitter } from "vscode";
import * as colors from "colors/safe";

/**
 * Virtuální terminál pro zobrazení informací o překladu/simulaci
 */
export class VirtualTerminal implements Pseudoterminal{
    private static Opened: VirtualTerminal[] = [];

    /** Slovník pro mapovaní souborů ("docasny_soubor": "original") */
    private FilesMapping?: {[term: string]: string};

    protected WaitingForAnyKey = false;

    private onDidCloseEmitter = new EventEmitter<void|number>();
    private onDidWriteEmitter = new EventEmitter<string>();
    private onInputEmitter = new EventEmitter<string>();

    /** Event, která je vyvolán po zavření terminálu */
    public readonly onDidClose = this.onDidCloseEmitter.event;

    /** Event, která je vyvolán po výtupu programu na terminál */
    public readonly onDidWrite = this.onDidWriteEmitter.event;

    /** Event, která je vyvolán po uživatelském vstupu */
    public readonly onInput = this.onInputEmitter.event;

    public Ready = false;
    public Closed = false;

    private lineQueue: string[] = [];

    public open(){
        this.Ready = true;

        // Zavřít terminály čekající na ukončení
        VirtualTerminal.Opened.forEach(t => {
            if(t.WaitingForAnyKey) t.handleInput(" ");
        });

        VirtualTerminal.Opened.push(this);

        while(this.lineQueue.length > 0){
            this.onDidWriteEmitter.fire(this.lineQueue.shift());
        }
    }

    public close(){
        this.Ready = false;
        this.Closed = true;
        VirtualTerminal.Opened = VirtualTerminal.Opened.filter(t => t !== this);
        this.onDidCloseEmitter.fire();
    }

    public handleInput(data: string){
        if(this.Closed) return;

        if(!this.WaitingForAnyKey){
            this.onInputEmitter.fire(data);
            return;
        }

        this.WaitingForAnyKey = false;
        this.close();
    }

    public AnyKeyToClose(){
        if(this.WaitingForAnyKey) return;

        this.WaitingForAnyKey = true;
        this.WriteLine(colors.gray("\r\n\r\nTerminal is inactive. Press any key to close..."));
    }

    /**
     * Zobrazit řádek na výstup terminálu
     *
     * @param line Řádek textu na výstup
     */
    public WriteLine(line: string){
        if(this.Closed) return;

        if(this.FilesMapping){
            for (const temp in this.FilesMapping) {
                if (!this.FilesMapping.hasOwnProperty(temp)) continue;
                const orig = this.FilesMapping[temp];

                line = line.replace(temp, orig);
            }
        }

        line = line.replace(/\n/g, "\r\n");

        if(!this.Ready) this.lineQueue.push(line + "\r\n");
        else this.onDidWriteEmitter.fire(line + "\r\n");
    };

    // Zápis části znaků na výstup
    public Write(chunk: any){
        if(this.Closed) return;

        // Převést buffer na string
        if(chunk instanceof Buffer){
            chunk = chunk.toString("utf8");
        }

        if(typeof chunk !== "string") chunk = chunk.toString();

        // Normalizovat řádky
        chunk = chunk.replace(/\n/g, "\r\n");

        if(!this.Ready) this.lineQueue.push(chunk);
        else this.onDidWriteEmitter.fire(chunk);
    }

    /**
     * Zobrazit chybuvou hlášku na výstup terminálu
     *
     * @param line Chybová hláška
     */
    public ErrorLine(line: string){
        this.WriteLine(colors.red(line));
    }

    /**
     * Načte slovník pro mapování dočasných serverových souborů na lokální
     * soubory
     *
     * @param mapping Slovník pro mapovaní ("docasny_soubor": "original")
     */
    public LoadFilesMapping(mapping?: {[term: string]: string}){
        this.FilesMapping = mapping;
    }

    /**
     * Zruší mapování souborů(výstup se vypisuje tak, jak přichází)
     */
    public RemoveFileMapping(){
        this.LoadFilesMapping();
    }
}

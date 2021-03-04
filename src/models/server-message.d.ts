import { File } from './project-data';
interface MessageString {
	type: "job_stdout" | "job_stderr" | "error";
	data: string;
}

interface MessageJobReady {
    type: "job_ready";
    requiredFiles: string[];
}

interface MessageJobStart {
    type: "job_begin";
    vncUrl?: string;

    fileMapping: {[serverFile: string]: string};
}

export interface MessageServerStats {
	type: "server_stats";
	queue: {
        /** Platforma, pro kterou je úloha určena */
        [platform: string]: {
            /** Typ úlohy */
            [name: string]: {
                /** Zobrazovaný název typu úlohy */
                displayName: string;

                /** Počet běžících úloh */
                running: number;

                /** Počet čekajících úloh */
                queue: number;
            }
        }
	}
}

interface MessageAvailableJobs {
    type: "available_jobs";
    jobs: {
        /** Typ úlohy */
		name: string;

        /** Zobrazovaný název typu úlohy */
        displayName: string;

        /** Platforma, pro kterou je úloha určena */
        platform: string;

        /** Uživatelské parametry pro spuštění úlohy */
        userArgs: string[];

        /** Typy zdrojových souborů, které jsou potřebné pro spuštění */
        requiredFiles: string[];
    }
}

interface MessageJobQueue {
    type: "job_queue_status";

    /** Aktuální délka fronty (počet čekajících úloh) */
    size: number;

    /** Pozice v globální frontě (od 1 - první na řadě) */
    pos: number;
}

interface MessageBuildResult{
	type: "job_end";

    /** Návratový kód úlohy */
	exitCode?: number;

    /** Soubory vytvořené úlohou */
    files?: File[];
}

/**
 * Websocket zpráva server -> klient
 */
export type ServerMessage = MessageString | MessageJobStart | MessageJobQueue |
    MessageServerStats | MessageAvailableJobs | MessageBuildResult | MessageJobReady;

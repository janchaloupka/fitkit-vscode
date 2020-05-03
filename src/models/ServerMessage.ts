import { BuildResult } from './BuildResult';

interface MessageString{
	type: "isim-begin" | "isim-stdout" | "isim-stderr" |
		"build-stdout" | "build-stderr" | "error";
	data: string;
}

interface MessageQueue{
	type: "isim-queue" | "build-queue";
	data: {
		/** Aktuální délka fronty (počet čekajících úloh) */
		size: number;

		/** Pozice ve frontě (od 1 - první na řadě) */
		pos: number;
	};
}

interface MessageVoid{
	type: "build-begin" | "isim-end";
}

interface MessageBuildResult{
	type: "build-end";
	data: BuildResult;
}

interface MessageFileMapping{
	type: "project-mapping";
	data: {[serverFile: string]: string}
}

/**
 * Websocket zpráva server -> klient
 */
export type ServerMessage = MessageString | MessageVoid |
	MessageQueue | MessageBuildResult | MessageFileMapping;
